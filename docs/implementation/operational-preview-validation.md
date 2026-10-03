# October 3 operational preview validation

> **Status:** Bounded checks complete; release gates remain open\
> **Date:** 2026-10-03\
> **Requirements:** FR-002/003/004/017/021/022, NFR-006/007/008/009, SEC-001/002/003/007, GOV-002/007

The [source-bound record](release-evidence/2026-10-03-operational-validation.json) preserves live
API/Worker observations on `063a1be` and local test/source hashes for the follow-up. Publication
does not rewrite those observations as a later revision. PR #41 remains draft; no merge is authorized.

## Browser engines

Eighteen checks pass in Chromium 151, Firefox 153 and WebKit 26.5 at 1280px and 320px on Windows.
They cover repository submission/progress, current schema 2.0.0 reports, evidence focus return,
terminal polling stop, deep-link reload, invalid manifest preservation, keyboard mode selection,
native file replacement, historical schema 1.0.0 report completion focus and authoritative 404
recovery. All API responses are synthetic; the suite cannot create live repository jobs. Actual
stage geometry and page widths are checked. Dark theme and reduced motion are configured, and
the reduced-motion media query is asserted.

The first harness pass tried pointer activation on the visually hidden radio input; the corrected
test uses focus and Space, matching the native keyboard flow. The v2 fixture also required selecting
the issue disclosure rather than assuming opportunity-first order. Firefox reload under two local
workers exceeded the 30-second budget. Local runs now use one worker and wait for DOM content plus
the visible report heading; CI retains two workers. The final pass completes without retries or a
longer timeout. Strict typechecking caught reduced motion at the wrong configuration level; it now
uses Playwright's `contextOptions` and verifies the real preference. These corrections are in test
tooling; no product interaction was changed.

The full gate also exposed a cold persistence-barrel transform inside the API startup configuration
test. A two-worker experiment did not fix it. That unit test now imports the actual small options
parser through its mocked persistence boundary, while runtime integration keeps the complete
database/Graphile stack. Its original assertions, isolation and timeout remain unchanged.

`pnpm check` and the quality workflow include browser acceptance; CI installs the official engines
and Linux prerequisites. Results/traces are ignored under `.cache/playwright/`. WebKit is engine
evidence, not physical Safari/iOS acceptance. Spoken screen-reader and physical-device checks stay
deferred by the user. [Built-in reader instructions](manual-release-validation.md) require no purchase.

## API connections before attribution

A CA-verified, one-connection observer measured `max_connections=20`, with three superuser-reserved
slots. Seventeen uncached durable-lookup requests returned the expected JSON 404, including three
four-request waves and a four-request resume after idle. The aggregate client count peaked at ten,
including the observer, compared with five at baseline. After the final 35-second idle interval,
six clients remained. The result therefore needs review rather than an idle-release pass.

The old API and Worker pools had no separate PostgreSQL application names. The new Vercel pool
sets the constant `stacklens-api-vercel` label so repeated measurements can attribute API clients
without logging queries, addresses, credentials or report contents. A real PostgreSQL test verifies
the label. The one-connection cap, CA validation, pool lifecycle attachment and request/Worker
boundaries remain intact. A bounded burst does not prove a global autoscaling ceiling, a forced
cold start or actual Function suspension.

## Hosted Worker soak

Six serial public submissions alternate frey-ui and KerjaLog, three each. Every report passes the
shared schema 2.0.0 contract and completes with explicit limitations. Total observation time is
736,005 ms. The record retains each immutable repository commit, duration and provider failure
codes; no analyzed code, scripts, builds or installations run.

The two panel samples show 135.63 MiB near the start and 188.60 MiB during the first analysis.
Browser inspection then lost its connection, so later samples and restart/OOM history were not
captured. These samples are not a cgroup peak. The earlier 244.25 MiB constrained-run peak remains
the only recorded cgroup measurement. Six completed jobs add bounded repeated-workload evidence;
they do not close general sustained capacity or guarantee sufficient memory headroom.

## Backup and recovery

Aiven's Free service already has managed daily backups; its Backups page showed two completed
snapshots. A fresh logical rehearsal restored four reports into a separate owned database with all
seven recorded table hashes matching. Dump/restore took 32.18 seconds; readback and cleanup finished
in 38.48 seconds. Historical rows were not rewritten and the copied queue was not executed. The
temporary database and private archive were removed.

The [backup policy](preview-backups.md) documents the observed schedule, freshness checks, privacy
and safe restore procedure. Aiven does not permit a fork to a Free plan. Confirmed Free retention,
a no-card disaster recovery destination, a retained recoverable archive and full disaster RPO/RTO
plus queue replay remain open. A small logical copy into the existing service cannot establish them.

## Documentation and release decision

The follow-up updates contributor/browser tooling, API connection attribution, current handover,
public status, backup guidance and the project journey. Accepted requirements already cover these
checks and operational metadata. There is no analyzer/scoring, report schema, UI or architecture
decision change. Review the current PR HEAD, quality workflow and actual Vercel deployments before
any subsequent acceptance decision. The personal preview remains usable; production readiness is
not established while the listed operational and human gates remain open.

The final database-backed `pnpm check` passes: build, compiled/native API/Worker smoke, strict
workspace/browser typechecking, all 22 Turbo test tasks, 18 browser tests, lint and formatting.
Nineteen test tasks reuse valid successful cache entries. The change audit checks 96 relative
Markdown links and three JSON documents, with no missing targets or private runtime values.
