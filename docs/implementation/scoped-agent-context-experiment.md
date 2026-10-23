# Scoped agent-instruction experiment

**Status:** proposed, draft-only experiment; no model behavior or quality improvement is claimed.
**Traceability:** GOV-002, GOV-006, GOV-007, existing AGENTS.md and project architecture.
Source context: [AI21's GitLab case study](https://www.ai21.com/blog/gitlab-case-study) suggests measuring end-to-end agent cost rather than assuming shorter prompts yield better outcomes.

## Hypothesis

The always-loaded StackLens root AGENTS.md carried detailed rules-javascript guidance for
unrelated tasks. Keep the entire existing rule-package section under
packages/rules-javascript/AGENTS.md, with a mandatory root pointer covering direct
edits **and** consumers of those contracts. Other root requirements are unchanged.

This is a deliberately reversible single-section extraction, not a wholesale conversion to
nested instructions. The high-risk GitHub connection, privacy, analyzer-safety, shared
contract, and quality instructions remain at root. Do not move further sections until
independent tests show that both Codex and OpenCode reliably load relevant scoped constraints.

## Static review performed

- The original rule-package section was transferred verbatim (except terminal blank lines).
- An exact source-section reconstruction check confirmed that no rule-package content was lost
  during the root-to-scoped move. The root pointer is new text, not a replacement policy.
- Original root size: 27,231 characters; extracted section: 6,491 characters. These are
  source-string sizes, **not** measured tokens, prompt savings, or model execution results.
- No production code, accepted product behavior, runtime components, dependencies, GitHub
  Actions configuration, or enforcement checks were modified.

## Required evaluation before accepting a default-policy change

Use a pinned repository revision and the **same** task, model, tool versions, provider,
review criteria, and test requirements for baseline main versus this branch.

| Representative task | Required evidence |
| --- | --- |
| Ordinary apps/web-only UI edit | Root requirements remain obeyed; scoped rules are not unnecessarily loaded |
| packages/rules-javascript change | Full scoped rules are actually loaded before code/review and applied to changed behavior |
| API or orchestration change affecting a rule | Root pointer triggers explicit scoped read across package boundaries |
| Privacy/credential change | Root security constraints remain available and enforced |
| Task with unknown cross-boundary impact | Agent escalates retrieval rather than assuming small context is sufficient |

Record provider-observed input/cached/output tokens, tool calls, repeated reads, latency,
retries and independently checked correctness. Separate unavailable measurements from genuine
zeroes. Use the optional [frey-skills paired metrics protocol](https://github.com/BlizzardBlast/frey-skills/blob/agent/risk-guided-review-efficiency-20261023/code-review/references/review-efficiency-experiment.md)
if those counts are available, but do not make model-evaluation a CI requirement.
Also check whether clients discover nested AGENTS.md automatically or need an explicit
read, especially for cross-package review and working-directory differences.

**Acceptance:** No regression in security/architectural obligations on the selected cases;
no omitted mandatory instructions; independently verified task results at least as good as
baseline, and a worthwhile reduction in total token use or elapsed work for unrelated tasks.
Any critical miss, missing scoped instructions, unverified provider metrics, or unclear quality
means **do not adopt broadly**. Small samples are exploratory and cannot prove non-regression.

**Rollback:** Restore the original JavaScript/TypeScript section to root AGENTS.md and remove
the scoped file/pointer; do not change architecture, product requirements, or CI to do so.
