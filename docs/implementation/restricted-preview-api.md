# Restricted preview API operations

**Date:** 2026-10-04. **Traceability:** FR-003/004/017/021/022, NFR-008/009,
SEC-003/007, GOV-002/006/007. See [ADR-0019](../adr/0019-restricted-request-bound-database-role.md).

PR #42 merged after exact-head quality CI `37165057022`, with no unresolved review threads.
Both Vercel projects now track `main`. The web's Ready deployment `Ai3ETm9bPPbnSMjZAVGuanFBYnce`
uses merged revision `5a5b1d3ff5f53fe3861572cfc904342a4f7a47fa`. API deployment
`CCJjjahLnV61Eauak62SADeDM1Mm` is separately Ready at the same revision. Its first automatic main
build was canceled as Preview before the Production branch setting changed; a new main deployment
resolved Production and passed the existing environment-based build filter. The tracked tree matches
PR #42's reviewed head. The new branch uses the same checkout.
The separately reviewed restricted startup/login implementation is
[PR #43](https://github.com/BlizzardBlast/StackLens/pull/43). Fresh deployed startup events match
PR #42's revision and take 1.31–1.58 seconds; see the
[source-bound capture](release-evidence/2026-10-04-main-api.json). Actual suspension remains unverified.

## Restricted startup and delivery

`STACKLENS_DATABASE_MODE=worker-managed` opts the Vercel API into a read-only schema check:
verify the three application's reader column sets without fetching rows. It runs no migrations,
Graphile utilities, direct dispatch or delivery pump. A missing/inaccessible schema fails startup.
The existing bootstrap mode remains default for local and portable deployments.

The API commits analysis and pending outbox atomically before `202`. The continuous owner Worker
alone dispatches and retries that delivery, executes analysis and sweeps expiry. A Worker outage
leaves accepted work queued. Never increase the API role's permissions to migrate or unlock jobs.
Migration deployment order is owner Worker/operator first, compatible API readers second.

## Login preparation and activation

The existing Aiven owner can create constrained roles and owns the three application tables;
a NOLOGIN capability probe was rolled back. The Free plan excludes managed pooling. The proposed
`stacklens_api_preview` login is limited to six connections, leaving 11 ordinary slots on the
measured server for the Worker (pool max five), provider/internal clients and operators. PostgreSQL
role limits are approximate. This guard is separate from workload/memory/lifecycle acceptance.

The operator tool requires verified CA, at least 11 ordinary slots outside the API budget, adequate
current connection headroom and an absent target role. It grants only database CONNECT, public
schema USAGE, application-table SELECT, and analysis/delivery INSERT. It verifies no superuser,
role/database creation, replication, RLS bypass, role membership, database/schema CREATE, Graphile
access or forbidden writes, truncation and table grants. Required SELECT and INSERT are checked
individually. It never grants administrator membership, terminates sessions or overwrites credentials.
Private configuration, generated password and CA stay outside Git and all evidence.

```powershell
node scripts/operations/restricted-api-login.mjs plan C:/private/owner-database.json C:/private/api-database.json .cache/operations/restricted-plan.json
node scripts/operations/restricted-api-login.mjs apply C:/private/owner-database.json C:/private/api-database.json .cache/operations/restricted-login.json
```

Use user-restricted private directories. Deploy reviewed compatible API code first. After exact-head
CI and self-review, configure the new private DATABASE_URL and `STACKLENS_DATABASE_MODE=worker-managed`
together in `stacklens-api` Production, retaining its existing CA, max-one/maxUses-one pool and
lifecycle attachment. Never copy credentials into `stacklens`, `VITE_*`, screenshots or logs.
Keep the Worker login unchanged. Verify effective privileges, TLS, deployed startup event, direct
and same-origin quick/polling routes, a real durable repository job and final zero API clients.

Rollback both login and mode together to the reviewed owner/bootstrap configuration and deployment.
An older deployment that uses a stored owner credential can overlap briefly, so its connections
must be included in measurements. Retire older deployments before claiming every serving API
uses the new role. Disable a retired limited login only after confirming no deployment uses it;
do not terminate unrelated sessions or drop a role with live dependencies.

## Verification and remaining scope

The synthetic PostgreSQL integration test verifies missing-schema startup failure, owner-only
bootstrap, denied DDL/Graphile/update/delete operations, a pending durable delivery with zero jobs
while the Worker is stopped, later Worker execution, strict report polling and quick analysis.
It exhausts a two-connection test role, observes sanitized retryable `503`, preserves owner/Worker
headroom and recovers API reads after release. Normal tests create only disposable local resources.
This proves the mechanism and privilege seam; the live six-connection role needs separate validation.

The database-backed `pnpm check` passes native/compiled smoke, types, five deployment checks,
seven operator checks, all 18 browser cases, lint and format. The 22 Turbo test-graph tasks reuse
the preceding uncached serial pass of 560 Vitest tests and ten token tests. Initial parallel
persistence timeouts remain in local logs; assertions/timeouts were unchanged. The final privilege
review was followed by another passing focused integration test, lint and formatting.

The encrypted backup heartbeat is active every 12 hours, with a verified eight-report backup through
October 5 at 07:24 Jakarta. Its first scheduled refresh remains unverified and depends on the local
workstation/Docker. Current backup, role and deployment captures remain source-bound; resolve current
remote main after the milestone merge rather than requiring a post-merge squash-SHA documentation PR.
Public replacement API/Worker routing, managed Free restore/retention, workstation-loss recovery,
actual Function suspension and user-deferred physical-device/spoken acceptance remain open.
