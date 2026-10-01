# Manual release acceptance

> **Status:** Real assistive-technology and physical-device results pending\
> **Date:** 2026-10-01\
> **Requirements:** FR-001/003/004/017/021/022, NFR-006/007/008, GOV-002/007

The September 30 [local acceptance record](mvp-release-readiness.md) covers DOM semantics,
keyboard focus, axe and Chromium layout emulation. The following checks require a person using
actual assistive technology and a physical device. Expected outcomes below are not recorded passes.

## Record the environment

Record the date/time, tested URL and Git revision, operating system, browser/version,
screen-reader/version and physical device/model. Identify a staging or local backend and state
whether it uses live or synthetic provider responses. Keep user files, tokens and raw reports out
of the record. For each check, record pass/fail/not run plus observed behavior; attach a sanitized
short quotation of spoken output when useful.

## Screen-reader journey

Use an installed screen reader such as Windows Narrator/NVDA or VoiceOver on a real browser.
Listen to actual speech while performing these checks:

| Check | Expected outcome |
| --- | --- |
| Navigate the page | Page heading, main landmark, skip link and input-mode navigation are identifiable |
| Open quick analysis | “Paste manifest” and “Choose local file” are named radio choices with meaningful help and selection state |
| Change input mode | Keyboard selection changes the relevant panel; unrelated hidden fields do not enter navigation |
| Submit invalid JSON | A useful error is announced and entered content remains available to correct |
| Submit valid quick input | Busy state is understandable; completion announces the result and moves focus to its heading |
| Reset quick analysis | Focus returns to the useful introduction and the form can be completed again |
| Submit a public repository | Queued/progress changes are understandable without fake percentages or disruptive repeated focus moves |
| Reach terminal state | A report with limitations and total failure are distinguishable; terminal polling stops |
| Read scores and findings | N/A, risk bands, priority, confidence, evidence and limitations have text meaning without relying on color |
| Open and close evidence | Disclosure state/content are identifiable; explicit Close returns focus to the trigger or useful fallback |

Run quick paste and native file selection. For repository analysis, use the user-supplied KerjaLog
or frey-ui URL and record the resolved commit from the report. A malformed manifest tests input
errors; a missing public repository tests total failure. Do not interpret an absence of axe errors
as proof that announcements were spoken correctly.

## Physical-device and second-browser journey

Use a physical narrow/touch device, with a second browser engine where available. Record the
actual viewport or device settings rather than describing CSS emulation as a physical test.

1. Enter a repository URL and complete analysis using the software keyboard. Check that controls,
   status, failure recovery and report navigation remain reachable when the keyboard is visible.
2. Complete quick paste and the native `package.json` file-picker journey. Replacing the selected
   file before submission must use the newly selected content.
3. Scroll scores, dependency lists, findings, limitations and evidence. Verify readable text,
   reachable disclosure/Close controls and no horizontal page overflow.
4. Check system light/dark themes, increased text size and reduced-motion settings. Record the
   actual settings and any clipping, overlap or unintended motion.
5. Refresh a stable analysis deep link and use Back/Forward navigation. Confirm useful recovery
   for a missing analysis and absence of unexpected repeated requests after an authoritative 404.

## Release record

Add the observations to the next dated release-evidence file and link it from the
[hosting runbook](vercel-hosting.md). Record failures as acceptance gaps, fix them with focused
regressions, and rerun only the affected manual checks. A check stays pending until actual results
are available. This document itself does not close NFR-006/007 acceptance.
