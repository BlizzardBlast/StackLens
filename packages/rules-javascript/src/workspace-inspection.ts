import { minimatch } from "minimatch";

import type { FactRule } from "@stacklens/analyzer-core";
import type {
  AnalysisFact,
  AnalysisLimitation,
  InspectionCheckDetails,
  ScoreCategory,
} from "@stacklens/contracts";

import { normalizeAdvisorySeverity, advisoryAliasGroup } from "./advisory-severity.js";
import type { JavaScriptAnalysisMetadata } from "./analysis-metadata.js";
import { inspectTypeScriptConfiguration } from "./json-configuration.js";
import { resolveNpmObservation, packageVersion } from "./npm-rule-support.js";
import type { JavaScriptProjectSnapshot } from "./project-snapshot.js";
import { effectiveDependencyVersion } from "./rule-support.js";
import { traceScripts, declaredTool, type ScriptExecution } from "./script-graph.js";
import { parseExactSemanticVersion } from "./semver.js";
import { stableHash } from "./stable-id.js";
import { inspectStaticConfiguration } from "./static-configuration-parser.js";
import { isRecord } from "./static-data.js";
import { packageEvidenceId, packagePrefix } from "./workspace-rules.js";
import { workspacePackages, externalDeclarations } from "./workspace.js";

const RULE_ID = "JS-INSPECTION-018";
type State = InspectionCheckDetails["state"];
const CATEGORY_ORDER = [
  "dependencies",
  "security",
  "maintainability",
  "testing",
  "tooling",
] as const;
const CODE = /\.[cm]?[jt]sx?$|\.mdx$/u;
const TEST = /(?:^|\/)__tests__\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;

function testFileState(
  project: JavaScriptProjectSnapshot,
  executions: readonly ScriptExecution[],
): State {
  const runners = new Set(executions.map((item) => item.executable));
  if (runners.size > 1) return "unknown";
  // Selection flags, positional filters and external config paths can change the matching scope.
  // Keep those unknown until their semantics are supported instead of claiming unrelated tests match.
  const neutralOptions = new Set([
    "run",
    "--run",
    "--passWithNoTests",
    "--coverage",
    "--coverage.enabled",
    "--runInBand",
    "--ci",
    "--watch=false",
    "--watchAll=false",
    "--test",
    "test",
    "--ui",
    "--headed",
    "--watch",
  ]);
  if (
    executions.some(
      (item) =>
        item.packagePath !== (project.packagePath ?? ".") ||
        !["vitest", "jest", "node", "playwright"].includes(item.executable) ||
        item.arguments.some(
          (arg) =>
            !neutralOptions.has(arg) &&
            !/^--(?:reporter|outputFile(?:\.[\w-]+)?|maxWorkers)=\S+$/u.test(arg),
        ),
    )
  )
    return "unknown";
  let files = (project.files ?? []).filter((file) => CODE.test(file.path));
  let candidates = files.filter((file) => TEST.test(file.path));
  const config =
    project.files?.find((file) =>
      [...runners].some(
        (runner) =>
          file.path.startsWith(runner + ".config.") && /\.(?:[cm]?[jt]s|json)$/u.test(file.path),
      ),
    ) ??
    (runners.has("vitest")
      ? project.files?.find((file) => /^vite\.config\.[cm]?[jt]s$/u.test(file.path))
      : undefined);
  const inlineJest = runners.has("jest") ? project.jestConfiguration : undefined;
  if (config !== undefined && inlineJest !== undefined) return "unknown";
  if (config !== undefined || inlineJest !== undefined) {
    const fullPath =
      project.packagePath === undefined || project.packagePath === "."
        ? (config?.path ?? "package.json")
        : project.packagePath + "/" + (config?.path ?? "package.json");
    const inspected =
      config === undefined
        ? { value: inlineJest, unresolvedFields: [] }
        : inspectStaticConfiguration(
            fullPath,
            config.content,
            project.repositoryFiles ?? project.files,
          );
    if (!isRecord(inspected.value)) return "unknown";
    const vitest = runners.has("vitest");
    const playwright = runners.has("playwright");
    const root = isRecord(inspected.value) ? inspected.value : {};
    const settings = vitest ? (isRecord(root.test) ? root.test : {}) : root;
    const includeKey = vitest ? "include" : "testMatch";
    const excludeKey = vitest ? "exclude" : playwright ? "testIgnore" : "testPathIgnorePatterns";
    const prefix = vitest ? "$.test" : "$";
    if (
      inspected.unresolvedFields.some(
        (field) =>
          field === "$" ||
          field === "$.*" ||
          field === "$.root" ||
          field === prefix ||
          field === prefix + ".*" ||
          ["preset", "testRegex", "rootDir", "roots", "dir", "workspace", "projects"].some(
            (key) => (!playwright || key !== "projects") && field.startsWith(prefix + "." + key),
          ) ||
          field.startsWith(prefix + "." + includeKey) ||
          field.startsWith(prefix + "." + excludeKey),
      ) ||
      settings.testRegex !== undefined ||
      settings.preset !== undefined ||
      root.root !== undefined ||
      settings.root !== undefined ||
      settings.dir !== undefined ||
      (!playwright && settings.projects !== undefined) ||
      settings.workspace !== undefined ||
      settings.rootDir !== undefined ||
      settings.roots !== undefined
    )
      return "unknown";
    if (playwright) {
      const fields = ["testDir", "testMatch", "testIgnore"];
      if (
        inspected.unresolvedFields.some(
          (field) =>
            field === "$.projects" ||
            field.startsWith("$.testDir") ||
            /^\$\.projects\[\d+\](?:\.\*|\.(?:testDir|testMatch|testIgnore))/u.test(field),
        )
      )
        return "unknown";
      if (
        settings.projects !== undefined &&
        (!Array.isArray(settings.projects) ||
          settings.projects.some(
            (item) => !isRecord(item) || fields.some((key) => item[key] !== undefined),
          ))
      )
        return "unknown";
      if (settings.testDir !== undefined) {
        if (
          typeof settings.testDir !== "string" ||
          settings.testDir.includes("..") ||
          settings.testDir.startsWith("/")
        )
          return "unknown";
        const directory = settings.testDir.replace(/^\.\//u, "").replace(/\/$/u, "");
        if (directory !== "." && directory !== "")
          files = files.filter((file) => file.path.startsWith(directory + "/"));
        candidates = candidates.filter((file) => files.includes(file));
      }
    }
    const includes =
      playwright && typeof settings[includeKey] === "string"
        ? [settings[includeKey]]
        : settings[includeKey];
    const excludes =
      playwright && typeof settings[excludeKey] === "string"
        ? [settings[excludeKey]]
        : settings[excludeKey];
    const matches = (file: string, pattern: string) =>
      minimatch(file, playwright && !pattern.startsWith("**/") ? "**/" + pattern : pattern, {
        dot: true,
      });
    if (
      [includes, excludes].some(
        (patterns) =>
          Array.isArray(patterns) &&
          patterns.some(
            (pattern) =>
              typeof pattern === "string" &&
              (pattern.startsWith("/") || pattern.includes("<rootDir>")),
          ),
      )
    )
      return "unknown";
    if (includes !== undefined) {
      if (!Array.isArray(includes) || includes.some((item) => typeof item !== "string"))
        return "unknown";
      candidates = files.filter((file) =>
        includes.some((pattern: string) => matches(file.path, pattern)),
      );
    } else if (runners.has("vitest") || playwright)
      candidates = files.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/u.test(file.path));
    if (excludes !== undefined) {
      // Jest ignore patterns are regexes; arbitrary regex execution is outside this bounded matcher.
      if (
        (!vitest && !playwright) ||
        !Array.isArray(excludes) ||
        excludes.some((item) => typeof item !== "string")
      )
        return "unknown";
      candidates = candidates.filter(
        (file) => !excludes.some((pattern: string) => matches(file.path, pattern)),
      );
    }
  } else if (runners.has("vitest") || runners.has("playwright"))
    candidates = files.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/u.test(file.path));
  return candidates.length > 0 ? "pass" : project.repositoryCoverage?.complete ? "fail" : "unknown";
}

export const workspaceInspectionRule: FactRule<
  JavaScriptProjectSnapshot,
  JavaScriptAnalysisMetadata
> = {
  kind: "fact",
  id: RULE_ID,
  version: "1",
  requirementIds: [
    "FR-005",
    "FR-007",
    "FR-011",
    "FR-013",
    "FR-018",
    "FR-019",
    "FR-020",
    "FR-021",
    "FR-023",
    "SCORE-003",
    "DATA-003",
    "SEC-001",
    "SEC-002",
  ],
  evaluate(context) {
    const facts: AnalysisFact[] = [];
    const limitations: AnalysisLimitation[] = [];
    const packages = workspacePackages(context.project);
    const knownEvidence = new Set(context.evidence.map((item) => item.id));
    function check(
      member: JavaScriptProjectSnapshot,
      category: ScoreCategory,
      key: string,
      state: State,
      statement: string,
      evidenceIds: readonly string[] = [],
      reasonCode = "check_evidence_unavailable",
      details: Partial<Pick<InspectionCheckDetails, "observedSeverity" | "packageName">> = {},
    ) {
      const path = member.packagePath ?? ".";
      const id = packagePrefix(path) + "check-" + stableHash(category + ":" + key);
      const evidence = [...new Set([packageEvidenceId(path), ...evidenceIds])].filter((item) =>
        knownEvidence.has(item),
      );
      const limitationIds: string[] = [];
      if (state === "unknown") {
        const limitationId = id + "-unknown";
        limitationIds.push(limitationId);
        limitations.push({
          id: limitationId,
          kind: "insufficient_evidence",
          message: statement,
          reasonCode,
          packagePaths: [path],
          checkKeys: [key],
          paths: [path === "." ? "package.json" : path + "/package.json"],
          affectedCategories: [category],
          sourceIds: [],
          ruleIds: [RULE_ID],
        });
      }
      facts.push({
        id,
        type: "project.inspection.check",
        subject: {
          type: "project_setup",
          name: key,
          path: path === "." ? "package.json" : path + "/package.json",
        },
        statement,
        details: {
          kind: "inspection_check",
          key,
          packagePath: path,
          category,
          state,
          limitationIds,
          ...details,
        },
        rule: { id: RULE_ID, version: "1" },
        requirementIds: ["FR-018", "FR-019", "FR-020", "FR-023", "SCORE-003"],
        evidenceIds: evidence,
      });
    }
    for (const member of packages) {
      const path = member.packagePath ?? ".";
      const manifestPath = path === "." ? "package.json" : path + "/package.json";
      facts.push({
        id: packagePrefix(path) + "workspace",
        type: "project.workspace.package",
        subject: { type: "project", name: member.packageName ?? path, path: manifestPath },
        statement: "Inspected package manifest at " + manifestPath + ".",
        details: {
          kind: "workspace_package",
          package: {
            id: packagePrefix(path) + "identity",
            path,
            ...(member.packageName === undefined ? {} : { name: member.packageName }),
            manifestPath,
            role: member.role ?? "package",
          },
        },
        rule: { id: RULE_ID, version: "1" },
        requirementIds: ["FR-005", "FR-021"],
        evidenceIds: [packageEvidenceId(path)],
      });
      for (const declaration of member.dependencies.filter(
        (item) => item.internalPackagePath !== undefined,
      )) {
        facts.push({
          id:
            packagePrefix(path) +
            "internal-" +
            stableHash(declaration.group + ":" + declaration.name),
          type: "dependency.workspace.internal",
          subject: { type: "dependency", name: declaration.name, path: manifestPath },
          statement:
            declaration.name +
            " is an internal workspace reference; it is not an external installed version.",
          details: {
            kind: "dependency_resolution",
            packagePath: path,
            dependencyGroup: declaration.group,
            declaredSpecifier: declaration.declaredSpecifier,
            effectiveSpecifier: declaration.effectiveSpecifier ?? declaration.declaredSpecifier,
            internalPackagePath: declaration.internalPackagePath!,
          },
          rule: { id: RULE_ID, version: "1" },
          requirementIds: ["FR-005", "FR-023"],
          evidenceIds: [packageEvidenceId(path)],
        });
      }
      const external = externalDeclarations(member);
      if (external.length === 0)
        for (const category of ["dependencies", "security"] as const)
          check(
            member,
            category,
            "external-dependencies",
            "not_applicable",
            "No external installation declarations apply in this package.",
          );
      for (const dependency of external) {
        const key =
          dependency.group + "." + stableHash(dependency.name + ":" + dependency.declaredSpecifier);
        const effective = effectiveDependencyVersion(
          member,
          dependency.name,
          dependency.declaredSpecifier,
        );
        const npm = resolveNpmObservation({
          ruleId: RULE_ID,
          packageName: dependency.name,
          metadata: context.metadata,
          sources: context.sources,
          evidence: context.evidence,
        });
        const version =
          npm.ok && effective !== undefined
            ? packageVersion(npm.observation.snapshot, effective.version)
            : undefined;
        check(
          member,
          "dependencies",
          "deprecation." + key,
          version === undefined ? "unknown" : version.deprecatedMessage ? "fail" : "pass",
          version === undefined
            ? "Explicit deprecation status is unknown for " +
                dependency.name +
                "; an exact version and source-bound current npm record are required."
            : version.deprecatedMessage
              ? dependency.name + "@" + version.version + " has an explicit npm deprecation."
              : dependency.name +
                "@" +
                version.version +
                " has no explicit deprecation in its inspected npm version record.",
          npm.ok ? npm.observation.evidence.map((item) => item.id) : [],
          "deprecation_evidence_unavailable",
          { packageName: dependency.name },
        );
        const osv = context.metadata.osv;
        const source =
          osv === undefined
            ? undefined
            : context.sources.find(
                (item) =>
                  item.id === osv.sourceId &&
                  item.provider === "osv" &&
                  item.status !== "unavailable",
              );
        const queries =
          effective === undefined
            ? []
            : (osv?.snapshot.queryResults.filter(
                (item) =>
                  item.packageName === dependency.name && item.version === effective.version,
              ) ?? []);
        const queryEvidence =
          source === undefined || effective === undefined
            ? []
            : context.evidence.filter(
                (item) =>
                  item.kind === "external" &&
                  item.sourceId === source.id &&
                  item.reference === "npm:" + dependency.name + "@" + effective.version,
              );
        let securityState: State =
          source !== undefined &&
          queries.length > 0 &&
          queries.every((query) => query.complete) &&
          queryEvidence.length > 0
            ? "pass"
            : "unknown";
        let activeCount = 0;
        let observedSeverity: InspectionCheckDetails["observedSeverity"] = "none";
        const advisoryEvidenceIds: string[] = [];
        for (const id of new Set(
          queries.flatMap((query) => query.matches.map((match) => match.id)),
        )) {
          const advisory = osv?.snapshot.vulnerabilities.find((item) => item.id === id);
          if (
            advisory === undefined ||
            !advisory.affected.some(
              (item) => item.ecosystem === "npm" && item.packageName === dependency.name,
            )
          ) {
            securityState = "unknown";
            continue;
          }
          if (advisory.withdrawnAt !== undefined) continue;
          activeCount += 1;
          const evidence = context.evidence.filter(
            (item) =>
              item.kind === "external" && item.sourceId === source?.id && item.reference === id,
          );
          advisoryEvidenceIds.push(...evidence.map((item) => item.id));
          const severity = normalizeAdvisorySeverity(
            advisoryAliasGroup(osv!.snapshot.vulnerabilities, id),
            dependency.name,
          ).severity;
          if (evidence.length === 0 || severity === "unknown") securityState = "unknown";
          else if (
            ["none", "low", "medium", "high", "critical"].indexOf(severity) >
            ["none", "low", "medium", "high", "critical"].indexOf(observedSeverity)
          )
            observedSeverity = severity;
        }
        if (securityState !== "unknown" && activeCount > 0) securityState = "fail";
        check(
          member,
          "security",
          "advisories." + key,
          securityState,
          securityState === "unknown"
            ? "Exact-version advisory coverage or supported CVSS severity is unknown for " +
                dependency.name +
                "."
            : "Completed exact-version OSV inspection for " +
                dependency.name +
                "; " +
                activeCount +
                " active advisory record(s). This does not establish application exploitability or universal security.",
          [...queryEvidence.map((item) => item.id), ...advisoryEvidenceIds],
          "advisory_evidence_unavailable",
          { packageName: dependency.name, observedSeverity },
        );
      }
      const lint = traceScripts(context.project, member, "lint");
      const typecheck = traceScripts(context.project, member, "typecheck");
      const tests = traceScripts(context.project, member, "test");
      const repositoryKnown = member.repositoryCoverage !== undefined;
      const applicable =
        member.role !== "orchestrator" &&
        ((member.files ?? []).some((file) => CODE.test(file.path)) ||
          (member.scripts?.length ?? 0) > 0 ||
          !member.repositoryCoverage?.complete);
      const lintConfig = (member.files ?? []).some((file) =>
        /(?:^|\/)(?:eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.json)?|biome\.jsonc?)$/u.test(
          file.path,
        ),
      );
      const configuredLint =
        lintConfig &&
        ["eslint", "@biomejs/biome"].some((tool) => declaredTool(member, context.project, tool));
      check(
        member,
        "maintainability",
        "lint",
        !applicable
          ? "not_applicable"
          : !repositoryKnown
            ? "unknown"
            : lint.state === "pass" || configuredLint
              ? "pass"
              : lint.state,
        "Static lint safeguard: " +
          (!applicable
            ? "orchestration-only or code-free package."
            : configuredLint || lint.state === "pass"
              ? "a declared lint tool/configuration or supported execution path is present; it was not run."
              : "a supported lint safeguard was not established."),
      );
      const tsFiles = (member.files ?? []).some((file) => /\.[cm]?tsx?$/u.test(file.path));
      let checkedJs = typecheck.executions.some((item) => item.arguments.includes("--checkJs"));
      let noCheck = false;
      let noCheckUnknown = false;
      for (const config of (member.files ?? []).filter((file) =>
        /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/u.test(file.path),
      )) {
        const full = path === "." ? config.path : path + "/" + config.path;
        const inspected = inspectTypeScriptConfiguration(
          full,
          config.content,
          member.repositoryFiles ?? member.files,
        );
        const options =
          isRecord(inspected.value) && isRecord(inspected.value.compilerOptions)
            ? inspected.value.compilerOptions
            : {};
        checkedJs ||= options.checkJs === true;
        noCheck ||= options.noCheck === true;
        noCheckUnknown ||= inspected.partialReason !== undefined && options.noCheck === undefined;
      }
      const typeApplicable = applicable && (tsFiles || checkedJs);
      check(
        member,
        "maintainability",
        "typecheck",
        !applicable || (repositoryKnown && !typeApplicable && member.repositoryCoverage?.complete)
          ? "not_applicable"
          : !repositoryKnown ||
              (!typeApplicable && !member.repositoryCoverage?.complete) ||
              (typecheck.state === "pass" && noCheckUnknown) ||
              noCheck
            ? "unknown"
            : typecheck.state,
        "Static type-check safeguard: " +
          (!typeApplicable && repositoryKnown
            ? "ordinary JavaScript without explicit type-checking is not required to adopt TypeScript."
            : noCheck
              ? "An inspected configuration sets noCheck; whether the declared command checks another target is unresolved."
              : typecheck.state === "pass" && !noCheckUnknown
                ? "a declared TypeScript checking command is present; it was not run."
                : "type-check execution or relevant configuration is unresolved or absent."),
      );
      check(
        member,
        "testing",
        "test.execution",
        !applicable ? "not_applicable" : !repositoryKnown ? "unknown" : tests.state,
        "Declared test execution: " +
          (!applicable
            ? "this package only orchestrates other packages or has no application/library code."
            : tests.state === "pass"
              ? "static delegation reaches a declared supported runner; tests were not run."
              : tests.reasons.join(" ") || "no supported test path is declared."),
      );
      check(
        member,
        "testing",
        "test.files",
        !applicable
          ? "not_applicable"
          : !repositoryKnown || tests.state === "unknown"
            ? "unknown"
            : testFileState(
                member,
                tests.executions.filter((item) => item.purpose === "test"),
              ),
        "Matching test-file presence is inspected separately from runner setup. Assertions, execution and coverage are not evaluated; passWithNoTests never proves file presence.",
      );
    }
    const root = packages[0]!;
    const manager = root.packageManager;
    const pin =
      manager === undefined
        ? undefined
        : /^(npm|pnpm|yarn)@([^+]+)(?:\+sha(?:224|256|384|512)\.[a-fA-F0-9]+)?$/u.exec(manager);
    const managerSupported = manager === undefined || /^(npm|pnpm|yarn)(?:@|$)/u.test(manager);
    check(
      root,
      "tooling",
      "package-manager",
      root.repositoryCoverage === undefined || !managerSupported
        ? "unknown"
        : pin?.[2] !== undefined && parseExactSemanticVersion(pin[2]) !== undefined
          ? "pass"
          : "fail",
      "Shared repository package-manager pin must identify npm, pnpm or Yarn at an exact supported version.",
    );
    const allDependencies = packages.flatMap((member) =>
      member.dependencies.filter((item) => item.group !== "peerDependencies"),
    );
    const lockIssues = (context.project.workspaceIssues ?? []).some(
      (issue) => issue.code.startsWith("lockfile_") || issue.code.startsWith("workspace_"),
    );
    const lockComplete = packages.every(
      (member) =>
        member.resolvedDependencies !== undefined &&
        member.resolvedDependencies.issues.length === 0 &&
        (pin?.[1] === undefined || pin[1] === member.resolvedDependencies.packageManager) &&
        externalDeclarations(member).every((dependency) =>
          member.resolvedDependencies!.resolutions.some(
            (item) =>
              item.packageName === dependency.name &&
              item.declaredSpecifier === dependency.declaredSpecifier,
          ),
        ),
    );
    const lockMissing =
      root.repositoryCoverage?.complete === true &&
      root.repositoryCoverage.lockfilePaths.length === 0;
    check(
      root,
      "tooling",
      "lockfile",
      root.repositoryCoverage === undefined || !managerSupported || lockIssues
        ? "unknown"
        : allDependencies.length === 0
          ? "not_applicable"
          : lockComplete
            ? "pass"
            : lockMissing
              ? "fail"
              : "unknown",
      "Shared lockfile must match the package manager and all supported workspace installations. Missing, stale, unsupported or partially acquired resolutions cannot establish reproducibility.",
    );
    if (
      context.project.workspaceIssues?.some((issue) =>
        ["workspace_configuration_invalid", "workspace_manifest_unavailable"].includes(issue.code),
      ) ||
      context.project.workspaceDiscoveryComplete === false
    ) {
      for (const category of CATEGORY_ORDER)
        check(
          root,
          category,
          "workspace.discovery",
          "unknown",
          "Workspace discovery or acquisition is incomplete; undiscovered declarations or checks may change this category.",
          [],
          "workspace_discovery_incomplete",
        );
    }
    if (
      context.project.workspaceIssues?.some(
        (issue) => issue.code === "workspace_dependency_unresolved",
      )
    )
      for (const category of ["dependencies", "security", "tooling"] as const)
        check(
          root,
          category,
          "workspace.resolution",
          "unknown",
          "An internal workspace or catalog dependency could not be resolved.",
          [],
          "workspace_dependency_unresolved",
        );
    return { facts, limitations };
  },
};
