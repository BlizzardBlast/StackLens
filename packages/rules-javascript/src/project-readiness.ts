import type { FactRule, FindingRule } from "@stacklens/analyzer-core";
import type { AnalysisFact, AnalysisLimitation, ProjectEvidence } from "@stacklens/contracts";

import type { JavaScriptProjectSnapshot } from "./project-snapshot.js";
import { parseExactSemanticVersion } from "./semver.js";
import { isSupportedJavaScriptSourcePath } from "./source-parser.js";

const FACT_RULE_ID = "JS-READINESS-019";
const FINDING_RULE_ID = "JS-SETUP-019";
const MANIFEST_EVIDENCE = "evidence-js-readiness-manifest";
const REPOSITORY_EVIDENCE = "evidence-js-readiness-repository";
const LOCKFILE_EVIDENCE = "evidence-js-readiness-lockfile";
type ReadinessCategory = "testing" | "tooling";

interface Check {
  readonly category: ReadinessCategory;
  readonly key: string;
  readonly state: "present" | "missing" | "unknown";
  readonly statement: string;
  readonly evidenceIds: readonly string[];
}

export function createReadinessEvidence(project: JavaScriptProjectSnapshot): ProjectEvidence[] {
  const coverage = project.repositoryCoverage;
  if (coverage === undefined) return [];
  return [
    {
      id: MANIFEST_EVIDENCE,
      kind: "project",
      location: { path: "package.json" },
      summary:
        "Root manifest test-script and package-manager declarations were inspected statically; commands were not executed.",
    },
    {
      id: REPOSITORY_EVIDENCE,
      kind: "project",
      location: { path: "." },
      summary: `Acquired ${coverage.acquiredSourceFiles} of ${coverage.candidateSourceFiles} supported source files. Repository acquisition is ${coverage.complete ? "complete" : "partial"}; generated and unsupported files are outside this count.`,
    },
    ...(project.resolvedDependencies === undefined
      ? []
      : [
          {
            id: LOCKFILE_EVIDENCE,
            kind: "project" as const,
            location: { path: project.resolvedDependencies.path },
            summary:
              "Supported committed root lockfile was checked against direct dependency declarations.",
          },
        ]),
  ];
}

const RUNNER_PACKAGES: Readonly<Record<string, string>> = {
  jest: "jest",
  vitest: "vitest",
  mocha: "mocha",
  ava: "ava",
  jasmine: "jasmine",
  tape: "tape",
  playwright: "@playwright/test",
  cypress: "cypress",
};

function testCommandState(project: JavaScriptProjectSnapshot): Check["state"] {
  const scripts = project.scripts ?? [];
  const names = new Set(project.dependencies.map((dependency) => dependency.name));
  for (const script of scripts) {
    // Only the initial command token counts. Quoted echo text and similarly named tools cannot match.
    const command = script.command;
    const match =
      /^\s*(?:(?:pnpm|yarn)\s+(?:exec\s+)?|npm\s+exec\s+|npx\s+)?(jest|vitest|mocha|ava|jasmine|tape|playwright|cypress)(?=\s|$)/u.exec(
        command,
      );
    if (/(?:^|\s)--(?:help|version)(?:\s|$)/u.test(command)) continue;
    if (
      match?.[1] !== undefined &&
      names.has(RUNNER_PACKAGES[match[1]] ?? "") &&
      (match[1] !== "playwright" || /\bplaywright\s+test(?:\s|$)/u.test(command)) &&
      (match[1] !== "cypress" || /\bcypress\s+(?:run|open)(?:\s|$)/u.test(command))
    )
      return "present";
    if (/^\s*node\s+--test(?:\s|$)/u.test(command)) return "present";
  }
  const customTest = scripts.some(
    (script) =>
      /^(?:test|e2e)(?::|$)/u.test(script.name) &&
      !/^\s*echo\s+["']?Error: no test specified/u.test(script.command),
  );
  return customTest ? "unknown" : "missing";
}

function readinessChecks(project: JavaScriptProjectSnapshot): readonly Check[] {
  const coverage = project.repositoryCoverage;
  if (coverage === undefined) return [];
  const commandState = testCommandState(project);
  const testFiles = (project.files ?? []).filter(
    (file) =>
      isSupportedJavaScriptSourcePath(file.path) &&
      (/(?:^|\/)__tests__\//u.test(file.path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file.path)),
  );
  const fileState = testFiles.length > 0 ? "present" : coverage.complete ? "missing" : "unknown";
  const manager = project.packageManager;
  const pinMatch = manager === undefined ? undefined : /^(npm|pnpm|yarn)@(.+)$/u.exec(manager);
  const supportedManager = manager === undefined || /^(npm|pnpm|yarn)(?:@|$)/u.test(manager);
  const pinState = !supportedManager
    ? "unknown"
    : pinMatch?.[2] !== undefined && parseExactSemanticVersion(pinMatch[2]) !== undefined
      ? "present"
      : "missing";
  const snapshot = project.resolvedDependencies;
  const lockState: Check["state"] =
    coverage.lockfileIssueCount > 0 || !supportedManager
      ? "unknown"
      : snapshot !== undefined &&
          snapshot.issues.length === 0 &&
          (pinMatch === undefined ||
            pinMatch === null ||
            pinMatch[1] === snapshot.packageManager) &&
          project.dependencies.every((dependency) =>
            snapshot.resolutions.some(
              (resolution) =>
                resolution.packageName === dependency.name &&
                resolution.declaredSpecifier === dependency.declaredSpecifier &&
                parseExactSemanticVersion(resolution.version) !== undefined,
            ),
          )
        ? "present"
        : snapshot !== undefined || coverage.lockfilePaths.length > 0 || !coverage.complete
          ? "unknown"
          : "missing";
  return [
    {
      category: "testing",
      key: "command",
      state: commandState,
      evidenceIds: [MANIFEST_EVIDENCE],
      statement:
        commandState === "present"
          ? "A supported declared test-runner command is configured in the root manifest; it was not executed."
          : commandState === "missing"
            ? "No supported test-runner command is configured in root package.json scripts. Review whether the project uses another test convention."
            : "Root test scripts use an unsupported custom command. Test setup cannot be scored until that convention is supported.",
    },
    {
      category: "testing",
      key: "files",
      state: fileState,
      evidenceIds: [REPOSITORY_EVIDENCE],
      statement:
        fileState === "present"
          ? `Observed ${testFiles.length} conventional test source file(s); their execution, assertions, and runtime coverage were not evaluated.`
          : fileState === "missing"
            ? "Complete supported source acquisition found no conventional .test.*, .spec.*, or __tests__ source files. Other test conventions may exist."
            : "Test-file observation is incomplete because repository acquisition was partial. Complete the repository scan before assessing missing test files.",
    },
    {
      category: "tooling",
      key: "package-manager",
      state: pinState,
      evidenceIds: [MANIFEST_EVIDENCE],
      statement:
        pinState === "present"
          ? "The root manifest pins a supported package manager to an exact semantic version."
          : pinState === "missing"
            ? "The root manifest does not pin npm, pnpm, or Yarn to an exact version. Review an explicit packageManager pin for reproducible tooling."
            : "The declared package manager is outside the supported npm, pnpm, and Yarn tooling scope.",
    },
    ...(project.dependencies.length === 0
      ? []
      : [
          {
            category: "tooling" as const,
            key: "lockfile",
            state: lockState,
            evidenceIds: [
              REPOSITORY_EVIDENCE,
              ...(snapshot === undefined ? [] : [LOCKFILE_EVIDENCE]),
            ],
            statement:
              lockState === "present"
                ? "A supported committed root lockfile matches the direct dependency declarations."
                : lockState === "missing"
                  ? "Complete supported acquisition found no supported committed root lockfile. Review committing the package manager's lockfile for reproducible direct resolutions."
                  : "Root lockfile evidence is partial, stale, ambiguous, or unsupported. Resolve the lockfile limitation before scoring tooling reproducibility.",
          },
        ]),
  ];
}

function limitation(category: ReadinessCategory, key: string, message: string): AnalysisLimitation {
  return {
    id: `limitation-js-readiness-${category}-${key}`,
    kind: "insufficient_evidence",
    message,
    affectedCategories: [category],
    sourceIds: [],
    ruleIds: [FACT_RULE_ID],
  };
}

export const projectReadinessFactRule: FactRule<JavaScriptProjectSnapshot, unknown> = {
  kind: "fact",
  id: FACT_RULE_ID,
  version: "1",
  requirementIds: [
    "FR-013",
    "FR-018",
    "FR-019",
    "FR-020",
    "FR-021",
    "FR-023",
    "SCORE-003",
    "SEC-001",
  ],
  evaluate(context) {
    const facts: AnalysisFact[] = [];
    const limitations: AnalysisLimitation[] = [];
    const knownEvidence = new Set(context.evidence.map((item) => item.id));
    const checks = readinessChecks(context.project);
    for (const category of ["testing", "tooling"] as const) {
      const selected = checks.filter((check) => check.category === category);
      if (selected.length === 0) {
        limitations.push(
          limitation(
            category,
            "repository-required",
            `${category} setup scoring requires a repository snapshot; manifest-only input cannot establish this scope.`,
          ),
        );
        continue;
      }
      let complete = true;
      for (const check of selected) {
        if (check.state === "unknown" || check.evidenceIds.some((id) => !knownEvidence.has(id))) {
          complete = false;
          limitations.push(
            limitation(
              category,
              check.key,
              check.state === "unknown"
                ? check.statement
                : "Readiness scoring lacks the required project provenance evidence.",
            ),
          );
          continue;
        }
        facts.push({
          id: `fact-js-readiness-${category}-${check.key}`,
          type: `project.readiness.${category}.${check.state}`,
          subject: { type: "project_setup", name: check.key },
          statement: check.statement,
          rule: { id: FACT_RULE_ID, version: "1" },
          requirementIds: ["FR-019", "FR-020", "FR-023"],
          evidenceIds: [...check.evidenceIds],
        });
      }
      if (complete)
        facts.push({
          id: `fact-js-coverage-${category}`,
          type: `analysis.coverage.${category}`,
          subject: { type: "analysis_coverage", name: `${category} setup coverage` },
          statement: `${category} scoring covers ${selected.length} supported static setup check(s); no tests or tools were executed.`,
          rule: { id: FACT_RULE_ID, version: "1" },
          requirementIds: ["FR-018", "FR-019", "FR-020", "SCORE-003"],
          evidenceIds: [...new Set(selected.flatMap((check) => check.evidenceIds))],
        });
    }
    if (knownEvidence.has(REPOSITORY_EVIDENCE))
      facts.push({
        id: "fact-js-repository-coverage",
        type: "project.repository.coverage",
        subject: { type: "repository", name: "Repository acquisition" },
        statement: createReadinessEvidence(context.project).find(
          (item) => item.id === REPOSITORY_EVIDENCE,
        )!.summary,
        rule: { id: FACT_RULE_ID, version: "1" },
        requirementIds: ["FR-021"],
        evidenceIds: [REPOSITORY_EVIDENCE],
      });
    return { facts, limitations };
  },
};

export const projectReadinessFindingRule: FindingRule<JavaScriptProjectSnapshot, unknown> = {
  kind: "finding",
  id: FINDING_RULE_ID,
  version: "1",
  requirementIds: ["FR-019", "FR-020", "FR-017", "DATA-004"],
  evaluate(context) {
    return {
      findings: context.facts.flatMap((fact) => {
        const category =
          fact.type === "project.readiness.testing.missing"
            ? "testing"
            : fact.type === "project.readiness.tooling.missing"
              ? "tooling"
              : undefined;
        if (category === undefined || fact.rule.id !== FACT_RULE_ID) return [];
        return [
          {
            id: `finding-js-setup-${category}-${fact.subject.name}`,
            category,
            classification: "heuristic" as const,
            subject: fact.subject,
            title: `Review ${category} setup: ${fact.subject.name}`,
            description: fact.statement,
            rule: { id: FINDING_RULE_ID, version: "1" },
            requirementIds: ["FR-019", "FR-020", "FR-017", "DATA-004"],
            factIds: [fact.id],
            evidenceIds: [...fact.evidenceIds],
            limitationIds: [],
            confidence: {
              level: "medium" as const,
              rationale:
                "The supported static convention is absent in complete relevant evidence; alternative project conventions may satisfy the same need.",
              factIds: [fact.id],
            },
          },
        ];
      }),
    };
  },
};
