import { minimatch } from "minimatch";

import type { JavaScriptProjectSnapshot } from "./project-snapshot.js";
import { workspacePackages } from "./workspace.js";

export type ScriptPurpose = "test" | "lint" | "typecheck";
export interface ScriptExecution {
  readonly packagePath: string;
  readonly script: string;
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly purpose: ScriptPurpose;
  readonly dependency: string | undefined;
}
export interface ScriptTrace {
  readonly state: "pass" | "fail" | "unknown";
  readonly executions: readonly ScriptExecution[];
  readonly reasons: readonly string[];
  readonly visited: readonly string[];
}

/** A small shell grammar, not a shell. Dynamic expansion and unsupported operators are unknown. */
export function staticCommands(command: string): readonly (readonly string[])[] | undefined {
  if (command.length > 16000) return undefined;
  const commands: string[][] = [];
  let words: string[] = [];
  let word = "";
  let quote: "'" | '"' | undefined;
  let started = false;
  const flush = () => {
    if (started) words.push(word);
    word = "";
    started = false;
  };
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i]!;
    if (quote !== "'") {
      if (char === "$" || char === "`") return undefined;
      if (char === "\\") {
        const next = command[++i];
        if (next === undefined) return undefined;
        word += next;
        started = true;
        continue;
      }
    }
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
      else word += char;
      started = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (char === ";" || (char === "&" && command[i + 1] === "&")) {
      flush();
      if (words.length === 0) return undefined;
      commands.push(words);
      words = [];
      if (char === "&") i += 1;
      continue;
    }
    if ("|&<>\n\r(){}".includes(char)) return undefined;
    if (/\s/u.test(char)) {
      flush();
      continue;
    }
    word += char;
    started = true;
  }
  if (quote !== undefined) return undefined;
  flush();
  if (words.length > 0) commands.push(words);
  return commands.length > 0 ? commands : undefined;
}

const RUNNERS: Readonly<Record<string, { purpose: ScriptPurpose; dependency: string }>> = {
  jest: { purpose: "test", dependency: "jest" },
  vitest: { purpose: "test", dependency: "vitest" },
  mocha: { purpose: "test", dependency: "mocha" },
  ava: { purpose: "test", dependency: "ava" },
  jasmine: { purpose: "test", dependency: "jasmine" },
  tape: { purpose: "test", dependency: "tape" },
  playwright: { purpose: "test", dependency: "@playwright/test" },
  cypress: { purpose: "test", dependency: "cypress" },
  eslint: { purpose: "lint", dependency: "eslint" },
  oxlint: { purpose: "lint", dependency: "oxlint" },
  biome: { purpose: "lint", dependency: "@biomejs/biome" },
  tsc: { purpose: "typecheck", dependency: "typescript" },
};
export function declaredTool(
  project: JavaScriptProjectSnapshot,
  root: JavaScriptProjectSnapshot,
  dependency: string,
): boolean {
  const path = project.packagePath ?? ".";
  return workspacePackages(root).some((member) => {
    const parent = member.packagePath ?? ".";
    return (
      (parent === path || parent === "." || path.startsWith(parent + "/")) &&
      member.dependencies.some(
        (item) => item.name === dependency && item.group !== "peerDependencies",
      )
    );
  });
}

export function traceScripts(
  root: JavaScriptProjectSnapshot,
  project: JavaScriptProjectSnapshot,
  purpose: ScriptPurpose,
): ScriptTrace {
  const packages = workspacePackages(root);
  const executions: ScriptExecution[] = [];
  const reasons = new Set<string>();
  const visited = new Set<string>();
  const active = new Set<string>();
  function select(selector: string): readonly JavaScriptProjectSnapshot[] | undefined {
    if (selector.length > 500 || /[!{}[\]\\]|\.\.\.|\^/u.test(selector)) return undefined;
    const byPath = selector.startsWith("./");
    return packages.filter((member) =>
      minimatch(
        byPath ? (member.packagePath ?? ".") : (member.packageName ?? ""),
        byPath ? selector.slice(2) : selector,
      ),
    );
  }
  function invoke(member: JavaScriptProjectSnapshot, script: string, depth: number): void {
    const key = (member.packagePath ?? ".") + ":" + script;
    if (depth > 16 || active.has(key) || visited.size >= 256) {
      reasons.add("Script expansion reached a cycle or resource bound.");
      return;
    }
    if (visited.has(key)) return;
    visited.add(key);
    active.add(key);
    const declaration = member.scripts?.find((item) => item.name === script);
    if (declaration === undefined) {
      reasons.add("A delegated script is missing.");
      active.delete(key);
      return;
    }
    const commands = staticCommands(declaration.command);
    if (commands === undefined)
      reasons.add("A script uses dynamic shell syntax or unsupported operators.");
    else for (const tokens of commands) command(member, script, [...tokens], depth);
    active.delete(key);
  }
  function command(
    member: JavaScriptProjectSnapshot,
    script: string,
    tokens: string[],
    depth: number,
  ): void {
    if (depth > 16) {
      reasons.add("Script expansion reached a resource bound.");
      return;
    }
    let executable = tokens.shift();
    if (executable === undefined) return;
    if (["echo", "printf", "true"].includes(executable)) return;
    if (["npm", "pnpm", "yarn"].includes(executable)) {
      let targets: readonly JavaScriptProjectSnapshot[] = [member];
      let exec = false;
      while (tokens.length > 0) {
        const token = tokens[0]!;
        if (token === "exec") {
          exec = true;
          tokens.shift();
          if (tokens[0] === "--") tokens.shift();
          break;
        }
        if (token === "-r" || token === "--recursive" || token === "--workspaces") {
          targets = packages.filter((item) => item.packagePath !== ".");
          tokens.shift();
          continue;
        }
        if (
          token === "--filter" ||
          token === "--workspace" ||
          (executable === "yarn" && token === "workspace")
        ) {
          tokens.shift();
          const selector = tokens.shift();
          const matched = selector === undefined ? undefined : select(selector);
          if (matched === undefined || matched.length === 0) {
            reasons.add("Workspace selector is unsupported or has no matches.");
            return;
          }
          targets = matched;
          continue;
        }
        if (token.startsWith("--workspace=") || token.startsWith("--filter=")) {
          tokens.shift();
          const matched = select(token.slice(token.indexOf("=") + 1));
          if (matched === undefined || matched.length === 0) {
            reasons.add("Workspace selector is unsupported or has no matches.");
            return;
          }
          targets = matched;
          continue;
        }
        break;
      }
      if (exec) {
        for (const target of targets) command(target, script, [...tokens], depth + 1);
        return;
      }
      if (tokens[0] === "run" || tokens[0] === "run-script") tokens.shift();
      const task = tokens.shift();
      if (task === undefined || task.startsWith("-")) {
        reasons.add("Package-manager invocation is unsupported.");
        return;
      }
      for (const target of targets) {
        if (target.scripts?.some((item) => item.name === task)) {
          if (tokens.length > 0)
            reasons.add("Forwarded script arguments may override the delegated execution path.");
          else invoke(target, task, depth + 1);
        } else if (executable !== "npm" && Object.hasOwn(RUNNERS, task))
          command(target, script, [task, ...tokens], depth + 1);
        else reasons.add("A delegated script or executable is unavailable.");
      }
      return;
    }
    if (executable === "turbo") {
      if (!declaredTool(member, root, "turbo")) {
        reasons.add("Turbo is not declared in the package or an ancestor.");
        return;
      }
      if (tokens.shift() !== "run") {
        reasons.add("Only static turbo run tasks are supported.");
        return;
      }
      const task = tokens.shift();
      if (task === undefined || task.startsWith("-")) {
        reasons.add("Turbo task is unresolved.");
        return;
      }
      let targets = packages.filter(
        (item) =>
          item.packagePath !== (member.packagePath ?? ".") &&
          item.scripts?.some((entry) => entry.name === task),
      );
      while (tokens.length > 0) {
        const flag = tokens.shift()!;
        if (flag === "--filter" || flag.startsWith("--filter=")) {
          const selector = flag === "--filter" ? tokens.shift() : flag.slice(9);
          const match = selector === undefined ? undefined : select(selector);
          if (match === undefined) {
            reasons.add("Turbo selector is unsupported.");
            return;
          }
          targets = targets.filter((item) => match.includes(item));
        } else {
          reasons.add("Turbo options are outside supported static delegation.");
          return;
        }
      }
      if (targets.length === 0) reasons.add("Turbo task did not resolve to any member scripts.");
      for (const target of targets) invoke(target, task, depth + 1);
      return;
    }
    if (
      tokens.some((token) =>
        ["--version", "--help", "-h", "--listTests", "--showConfig"].includes(token),
      )
    )
      return;
    if (executable === "vitest" && ["list", "bench", "init"].includes(tokens[0] ?? "")) return;
    const runner = Object.hasOwn(RUNNERS, executable) ? RUNNERS[executable] : undefined;
    const nodeTest = executable === "node" && tokens.includes("--test");
    if (runner === undefined && !nodeTest) {
      reasons.add("A command is outside the supported static runner conventions.");
      return;
    }
    if (runner !== undefined && !declaredTool(member, root, runner.dependency)) {
      reasons.add("The runner is not declared in the package or an ancestor.");
      return;
    }
    if (
      (executable === "playwright" && tokens[0] !== "test") ||
      (executable === "cypress" && !["run", "open"].includes(tokens[0] ?? "")) ||
      (executable === "biome" && !["lint", "check"].includes(tokens[0] ?? "")) ||
      (executable === "tsc" && tokens.includes("--noCheck"))
    )
      return;
    executions.push({
      packagePath: member.packagePath ?? ".",
      script,
      executable,
      arguments: tokens,
      purpose: nodeTest ? "test" : runner!.purpose,
      dependency: runner?.dependency,
    });
  }
  const selected = (project.scripts ?? []).filter((script) => {
    if (
      (purpose === "test"
        ? /^(test|e2e)(:|$)/u
        : purpose === "lint"
          ? /^lint(:|$)/u
          : /^(typecheck|type-check|check-types)(:|$)/u
      ).test(script.name)
    )
      return true;
    return (
      staticCommands(script.command)?.some(
        (tokens) =>
          RUNNERS[tokens[0] ?? ""]?.purpose === purpose ||
          (purpose === "test" && tokens[0] === "node" && tokens.includes("--test")),
      ) ?? false
    );
  });
  for (const script of selected) invoke(project, script.name, 0);
  return {
    state:
      reasons.size > 0
        ? "unknown"
        : executions.some((item) => item.purpose === purpose)
          ? "pass"
          : "fail",
    executions,
    reasons: [...reasons],
    visited: [...visited],
  };
}
