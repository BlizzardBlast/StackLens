# StackLens Low-Fidelity Wireframes

These wireframes intentionally omit final colors, shadows, and detailed component styling. They validate hierarchy first.

## 1. Analyzer — desktop

```text
┌─────────────────────────────────────────────────────────────────────┐
│ StackLens                                           Theme     GitHub │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                 Understand your development stack                   │
│       Evidence-backed analysis. No repository code execution.       │
│                                                                     │
│                 [ GitHub repository | package.json ]                │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ https://github.com/owner/repository                         │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                    [ Analyze ]       │
│                                                                     │
│   Static inspection • Public repositories • No account required     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Validation state

Errors sit immediately below the affected input. Do not replace the user's value.

## 2. Analysis progress

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ← New analysis                                                      │
│                                                                     │
│ BlizzardBlast/example                                               │
│ Analyzing commit a82f...                                            │
│                                                                     │
│ ● Resolving repository                                              │
│ ● Collecting snapshot                                               │
│ ◉ Collecting package metadata                                       │
│ ○ Running rules                                                     │
│ ○ Calculating health score                                          │
│                                                                     │
│ Checking package versions and deprecation metadata.                 │
│                                                                     │
│ [OSV unavailable — security analysis may be incomplete]             │
└─────────────────────────────────────────────────────────────────────┘
```

Do not invent a numeric percent unless actual measurable progress exists.

## 3. Report — desktop

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ StackLens   BlizzardBlast/example    main @ a82f...      Sep 18, 21:14      │
├───────────────────┬──────────────────────────────────────────────────────────┤
│ Overview          │ REPORT OVERVIEW                                          │
│ Findings          │                                                          │
│ Dependencies      │  ┌─────────────┐  Dependencies 88   Security 72          │
│ Security          │  │     82      │  Maintain. 79   Testing N/A             │
│ Maintainability   │  │ Stack health│  Tooling 91                             │
│ Testing           │  └─────────────┘  Evidence coverage: 84%                 │
│ Tooling           │                                                          │
│ Limitations (2)   │  NEEDS ATTENTION                                         │
│                   │  ┌────────────────────────────────────────────────────┐  │
│                   │  │ HIGH  axios has a known vulnerability             │  │
│                   │  │ Fact · dependencies · CVE/OSV evidence            │  │
│                   │  │ Why it matters...                    [Evidence →] │  │
│                   │  └────────────────────────────────────────────────────┘  │
│                   │                                                          │
│                   │  ┌────────────────────────────────────────────────────┐  │
│                   │  │ MED   migrate deprecated package                  │  │
│                   │  │ Recommendation · confidence High                  │  │
│                   │  │ Why / suggested action...            [Evidence →] │  │
│                   │  └────────────────────────────────────────────────────┘  │
│                   │                                                          │
│                   │ STACK SUMMARY                                            │
│                   │ React 19 · Vite 8 · Vitest · pnpm · Tailwind 4 ...      │
└───────────────────┴──────────────────────────────────────────────────────────┘
```

## 4. Evidence drawer/panel

```text
┌──────────────────────────────────────────────┐
│ Evidence                               [×]   │
├──────────────────────────────────────────────┤
│ FINDING                                      │
│ axios 1.7.0 matches OSV-XXXX                 │
│                                              │
│ PROJECT EVIDENCE                             │
│ pnpm-lock.yaml → resolved 1.7.0              │
│                                              │
│ EXTERNAL EVIDENCE                            │
│ OSV-XXXX                                     │
│ Retrieved Sep 18, 2026 21:14 WIB             │
│                                              │
│ RULE                                         │
│ JS-SEC-001 · v1                              │
│                                              │
│ CLASSIFICATION                               │
│ Fact                                         │
│                                              │
│ [Open source reference]                      │
└──────────────────────────────────────────────┘
```

## 5. Score explanation

```text
┌──────────────────────────────────────────────────────────────┐
│ Dependencies                                      88 / 100   │
│ Evidence coverage                                      100%   │
├──────────────────────────────────────────────────────────────┤
│ Starting score                                          100   │
│ Outdated major dependency             -5   FR-006 / rule...  │
│ Deprecated dependency                 -7   FR-007 / rule...  │
│ No other eligible deductions                            —    │
├──────────────────────────────────────────────────────────────┤
│ Final                                                   88   │
│ Scoring rules v1.0                                            │
└──────────────────────────────────────────────────────────────┘
```

## 6. Insufficient evidence

```text
┌────────────────────────────────────┐
│ Testing                        N/A │
│                                    │
│ Insufficient evidence              │
│ No supported test configuration    │
│ was available in this input mode.  │
│                                    │
│ This does not mean the project     │
│ has no tests.                      │
└────────────────────────────────────┘
```

This state is mandatory for **SCORE-003**.

## 7. Narrow viewport report

```text
┌─────────────────────────────┐
│ StackLens          ◐        │
│ repo/name @ a82f...         │
├─────────────────────────────┤
│ 82 Stack health             │
│ Evidence 84%                │
│                             │
│ [Deps 88] [Sec 72] [More]   │
├─────────────────────────────┤
│ Needs attention             │
│ ┌─────────────────────────┐ │
│ │ HIGH · Fact             │ │
│ │ Vulnerability finding   │ │
│ │ affected package        │ │
│ │ [View evidence]         │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ Category                    │
│ [ Dependencies        ▾ ]   │
│ ...                         │
├─────────────────────────────┤
│ Limitations (2)             │
└─────────────────────────────┘
```

The narrow layout does not require the desktop navigation rail.
