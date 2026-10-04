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
a NOLOGIN capability probe was rolled back. The Free plan excludes managed pooling. The activated
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
This proves the mechanism and privilege seam; the separate live validation is recorded below.

The database-backed `pnpm check` passes native/compiled smoke, types, five deployment checks,
seven operator checks, all 18 browser cases, lint and format. The 22 Turbo test-graph tasks reuse
the preceding uncached serial pass of 560 Vitest tests and ten token tests. Initial parallel
persistence timeouts remain in local logs; assertions/timeouts were unchanged. The final privilege
review was followed by another passing focused integration test, lint and formatting.

The encrypted backup heartbeat is active every 12 hours, with a verified eight-report backup through
October 5 at 07:24 Jakarta. Its first scheduled refresh remains unverified and depends on the local
workstation/Docker. Current backup, role and deployment captures remain source-bound; resolve current
remote main after the milestone merge rather than requiring a post-merge squash-SHA documentation PR.
Independent public replacement API/Worker routing, managed Free restore/retention, workstation-loss recovery,
actual Function suspension and user-deferred physical-device/spoken acceptance remain open.

## October 4 hosted activation

PR #43 merged after exact-head quality CI `37166523756` at reviewed head `358cfae` and final
read-only review with no unresolved threads. The merged main at capture is `515576a`; resolve
current main after the operational evidence milestone. Both projects track main. The web's Ready
deployment is `J2JFDtW7RWWBxaw8GTitwQFwffrV`; the separately built API deployment
`BvE9vHKUt1NuUiM1pSmnCXt1g4v3` is Ready at the same source with the paired restricted login and
Worker-managed mode. Its fresh initialization event matches that revision and takes 1,165 ms.

The actual hosted login has the reviewed privileges and connection limit six. Six held clients
connect; the seventh is rejected with SQLSTATE `53300`, and the owner remains usable. All owned
probe clients are released, with no unrelated sessions terminated. Compiled API readback with
this login also passes missing-analysis and quick requests without migrations or Graphile access.

Direct API and web `/v1` proxy quick/polling routes pass. Fresh `frey-ui` and `KerjaLog` submissions
return `202` and later complete with strict schema 2.0.0 reports and explicit limitations, in
143,537 ms and 112,525 ms respectively. The bounded burst/idle/resume and jobs produce 89 HTTP
requests and 1,646 database observations: seven peak total clients, one peak restricted-role
client, zero final API clients and zero final idle transactions. The owner can count the separate
role by username but cannot inspect its private activity fields; a final same-role observer
independently verifies zero API clients/idle transactions while excluding itself. These samples do
not establish autoscaling topology or general workload capacity.

Existing Vercel Standard Protection is enabled for all except Production Custom Domains. Three
older immutable deployment URLs redirect anonymous requests to Vercel SSO. Earlier owner-configured
deployments remain available to authenticated rollback users; no global bound over those users is
claimed. No protection exception or automation bypass secret is listed. No protection setting was
changed. The first live probe used the wrong `/api` prefix and was corrected to the checked-in `/v1`
rewrite, with the failed harness capture retained. Application routing was unchanged.

See the [source-bound hosted evidence](release-evidence/2026-10-04-restricted-api.json).
Independent recovery is prepared around the verified finite archive and a Neon Free candidate;
Chrome is at sign-in and user authentication is pending. No archive has been transmitted, no
new recovery service activated and no public replacement routing claimed. This is an account
access prerequisite, not a reason to expand existing database privileges or select a paid fork.

Owned local rehearsal databases/containers and their two anonymous volumes are removed. The
transient private directory is empty and ports 55432/55435 have no listener. Protected persistent
configuration, encrypted archives and keys remain outside Git for the approved backup heartbeat.
The documentation-only evidence follow-up passes 116 relative-link checks, JSON/privacy-pattern
validation, lint and formatting; exact code correctness remains bound to PR #43's green CI.

### Later October 4 independent recovery

The [independent recovery milestone](independent-preview-recovery.md) supersedes the sign-in
prerequisite above. A temporary Neon Free database restores both retained reports after expiry
cleanup and serves them through the public restricted API. Six role clients connect and the
seventh receives `53300`; fresh repository delivery also passes. The API/Worker return to Aiven
and complete a fresh KerjaLog job before target teardown. The restricted role/mode, owner Worker
artifact and existing Standard Protection remain in place. Initial rollback deployments reach
Ready but fail runtime startup; after exact private input/save checks and a rebuild with latest
Project Settings and no build cache, public readback and fresh delivery pass. Ready must always
be followed by runtime verification. The underlying first-startup cause is not established.
