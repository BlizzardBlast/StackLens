# FR-100 hosted activation

**Updated:** 2026-10-16. **Status:** approved Worker rollout, canonical migration, restricted
grants and selected-repository App installation verified; connected API stays disabled while
callback logging is resolved, as explicitly directed by the operator.
**Requirements:** FR-100/003/004/017/021/022, SEC-003/004/005/006/007,
NFR-008/009/010, GOV-002/006/007. See [ADR-0023](../adr/0023-read-only-github-connections.md)
and the [activation sequence](github-connections.md#reviewable-hosted-activation-sequence).

## October 15 execution checkpoint

The later [local production callback implementation](github-callback-cutover.md) and
[ADR-0024](../adr/0024-private-github-callback-transport.md) supersede the transport proposal below.
They add no hosted activation authority: the original GitHub callback/configuration remain unchanged,
and the exact production relay/body/error/trace/logging review is still required. Preserve all
earlier rollout/probe evidence as dated observations.

The operator approved the exact registration, selected synthetic fixture, credential destinations,
Worker package and two grants below. GitHub accepted App `StackLens Preview BlizzardBlast`
(`stacklens-preview-blizzardblast`, App ID `5323725`) with Contents/Metadata read-only. Its initial
client secret and required RSA signing key remain in private local custody. The signing key is not
a runtime credential. The private fixture's three synthetic files are committed, including only
`is-number@7.0.0`. GitHub applied the account's existing automatic Codecov/SonarQube Cloud
installations during repository creation; no additional scopes were manually granted to them.
GitHub installation `171724341` completed on October 15 at 19:35 WIB. Its installed settings show
Contents/Metadata read-only, **Only select repositories**, and exactly
`BlizzardBlast/stacklens-fr100-acceptance`. The earlier verification tab was stale; no further
verification code is needed for this completed installation. Installation is separate from OAuth
authorization to StackLens, which has not been started.

Restarting the original Worker completed the preserved pending analysis with limitations. Its
strict report matches direct and same-origin HTTP reads, with `private, no-store`. Two subsequent
normal Stops reached Offline without Kill or claim unlocking. Installed original entrypoint/runtime
bytes match the preserved rollback archive. The reviewed new Linux archive installed successfully;
both installed module hashes match it. Panel startup edits initially failed to persist and restarted
the original launcher, without extraction. The corrected one-shot settings and restored normal
`start-worker.js`/empty arguments were verified after navigation/reload before use. The installer
removed its archive and was retired as `fr100-installer.completed.txt`, preserving a deployment
record without leaving the `install.js` entrypoint.

Only the independent data key was added to the existing Worker environment. The original database,
CA, concurrency and public-provider configuration match the preserved original. The new Worker
applied its canonical migration and five RLS policies. Only the two reviewed grants were added.
The actual restricted API login passes `verifyConnectedApiDatabase`; the backup role retains its
approved BYPASSRLS/public SELECT scope and has no connection-schema/table access. A rolled-back
synthetic transaction proves owner analysis/delivery reads and zero anonymous/other-owner rows,
without committed test or connection rows. This does not exercise a private report body.

An anonymous request for the private fixture received durable `202`, was delivered once and
finished with safe `repository_unavailable`, without a report. The queue, locks, claims and pending
deliveries are empty afterward. There are no connected analyses or connection records.

The platform-log review found a blocker before real OAuth. Dummy callback `code` and
`state` values appear in Vercel's private project **Request Logs → Search Params**, including the
same-origin proxy request. No real OAuth code, access token or App secret was used. Vercel's
[Runtime Logs documentation](https://vercel.com/docs/logs/runtime) lists search parameters and
one-hour Hobby retention. No supported pre-storage exclusion has been verified. The approved
preparation below requires callback codes outside logs. The operator explicitly chose to keep
connections disabled while resolving this logging issue and declined the proposed retention
exception. Only a verified mitigation can unblock the current activation; do not re-offer the
declined exception. Application log redaction, PKCE and single-use expiry do not establish platform
storage exclusion.

The [worker rollout evidence](release-evidence/2026-10-15-github-connections-worker-rollout.json)
records these outcomes and limits. API connection variables remain absent; its App secret and
data key have not been sent to Vercel. Live private analysis, sign-out/expiry/revocation and a fresh
scheduled capture/restore on the activated revision remain open. Existing backups and protected
recovery are unchanged. FR-101 follows hosted FR-100 acceptance.

### October 16 continuation

Direct and proxied session reads still return HTTP 200, `enabled: false`, and `private, no-store`.
Read-only verified-TLS checks preserve the restricted API/backup grant boundaries and five policies.
The queue, locks, claims and pending deliveries are empty, with zero connections or connected
analyses. There are now no report rows: the previous report readback cannot be repeated and remains
October 15 evidence. The cause of removal was not independently established by this observation;
do not present it as a fresh report acceptance or restore test.

The [callback privacy proposal](github-callback-privacy.md) prepares a local dummy-only Cloudflare
Worker probe. Five local tests and a pinned Wrangler dry-run pass. The earlier
[continuation evidence](release-evidence/2026-10-16-github-connections-continuation.json) records
preparation before the separate synthetic-host approval. The operator then approved that scope and
completed existing-account sign-in. Its Free resource initially used the harmless dashboard
starter; logs/invocation/persistence were disabled and deployed before attempted code editing,
with traces/issues off and no export destinations. Reloaded settings confirm collection off.
Preview URLs are off, with no bindings or runtime credentials. The dashboard creates a starter
before exposing these controls, which differs from the proposed initial CLI configuration.

The [host preparation evidence](release-evidence/2026-10-16-github-callback-probe-host.json)
preserves the initial stalled editor, bounded wait and reported pending document review. The
operator chose browser-only deployment; no token or CLI login was created. The editor subsequently
loaded, as shown by the operator's screenshot and fresh automation inspection. The reviewed module
was copied/read back in full before browser deployment, and active version `d8a636de` is verified.
Collection remained off after deployment. Seven hosted synthetic cases pass. Cloudflare's stored
event search has no canary match after its ingestion delay; Vercel's matching CDN landing request
is `GET /` without callback query values. Both session origins still report connections disabled.
See the [scoped acceptance evidence](release-evidence/2026-10-16-github-callback-probe-acceptance.json).
Provider-internal retention and all account security logging surfaces are not independently proven;
remaining hosting review and production callback body/error/trace tests are still required.
No GitHub callback, API credential, accepted sign-in protocol or production source has changed.
Real OAuth remains disabled until the hosting boundary is verified and the production change is
implemented and reviewed.

## Historical approved preparation

The following records the proposal and baseline before approval and execution. Its pending flags
describe that historical preflight; the checkpoint above is the current state.

### Verified baseline

Current main is `6bb5aa28b6a7468abde5e64398a2269e251062f7`, the squash merge of
[PR #58](https://github.com/BlizzardBlast/StackLens/pull/58).
Its push-triggered [quality](https://github.com/BlizzardBlast/StackLens/actions/runs/38572994438),
[portable recovery](https://github.com/BlizzardBlast/StackLens/actions/runs/38572994486) and
[offsite fixture](https://github.com/BlizzardBlast/StackLens/actions/runs/38572994498) pass.
Both Vercel reader deployments report success for this commit. The API dashboard independently
shows Ready/Current Production at this revision. Direct and same-origin session reads report
`enabled: false`; this is reader publication, not connected-feature acceptance.

Bounded read-only transactions through the existing Worker, API and backup logins verify TLS and
PostgreSQL 18.6. The original database has no ownership columns, connection schema or ownership
policies yet. The API login remains restricted with its existing six-connection limit and correct
public table grants. The backup login retains SELECT and its previously approved BYPASSRLS scope.
No source row, grant, credential destination or public route is changed by this observation.

The source observation has one in-flight analysis and one pending delivery, with zero queue rows
and zero locked jobs. The existing Worker panel shows Running. These are separate observations;
neither proves that pending delivery has completed or that the executor is fenced. Preserve the
pending analysis/delivery, inspect its safe status and obtain fresh ownership/drain evidence before
planned installation. Never delete pending work or unlock a live claim to manufacture a drain.

The [dated preflight evidence](release-evidence/2026-10-15-github-connections-activation-preflight.json)
records the baseline separately from future activation. Recheck all live state before execution.

### Prepared GitHub registration

The unsubmitted Chrome form uses this exact proposal:

| Setting                                                            | Proposed value                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Account                                                            | `BlizzardBlast`                                            |
| App name                                                           | `StackLens Preview BlizzardBlast`                          |
| Homepage                                                           | `https://stacklens-web.vercel.app`                         |
| Redirect URI                                                       | `https://stacklens-web.vercel.app/v1/auth/github/callback` |
| Wildcard matching                                                  | Off                                                        |
| Expire user authorization tokens                                   | On                                                         |
| User authorization during installation                             | Off; StackLens owns state/PKCE sign-in                     |
| Device flow                                                        | Off                                                        |
| Webhooks                                                           | Off                                                        |
| Contents                                                           | Read-only                                                  |
| Metadata                                                           | Mandatory read-only                                        |
| Other repository, organization, account and enterprise permissions | No access                                                  |
| Installation availability                                          | Only on this account for the initial personal preview      |

The app name/slug is proposed until GitHub accepts registration. Installation must use **Only
select repositories**, initially a separately authorized synthetic private repository named
`BlizzardBlast/stacklens-fr100-acceptance`. This test repository would contain a minimal manifest
with `is-number` exactly `7.0.0` and a static import. Its name/version may be queried at npm/OSV;
no real private project is selected by this preparation. Creation and installation are pending.
Opening the form and selecting draft permissions does not grant repository access.

The form follows current [GitHub registration documentation](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app),
retrieved through Context7 on October 15. The installed repository selection is a separate consent
step from registration and StackLens authorization.

### Credential destinations and exact grant proposal

A fresh independent 32-byte data key is prepared in exclusive user-only private local storage.
It is not a backup key and has not been transmitted. The App client secret is not generated yet.

| Configuration                                         | Destination                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| App client ID and client secret                       | Existing Vercel `stacklens-api` Production only                                                   |
| Exact public origin and accepted App installation URL | Same API runtime configuration                                                                    |
| Independent session data key                          | Same API and existing Silly `stacklens-worker-preview` (`60761d98`) private runtime configuration |
| App client secret on Worker, browser or backup jobs   | Forbidden                                                                                         |

Keep the web API-base override unset so callbacks/cookies use the existing same-origin proxy.
Deploy the Worker data key before API connection configuration. Preserve the existing database
credentials, CA, concurrency, backup custody and schedules. Key values, App secrets and callback
codes must stay outside Git, evidence, screenshots and logs. Keep the data key for active sessions;
rotation invalidates connections.

After the canonical Worker migration and policy verification, the only new grants proposed for
the existing API login are:

```sql
GRANT USAGE ON SCHEMA stacklens_auth TO stacklens_api_preview;
GRANT SELECT, INSERT, DELETE ON TABLE stacklens_auth.github_connection TO stacklens_api_preview;
```

These statements are a review proposal, not an executed migration. Do not add UPDATE, permanent
CREATE, role membership, ownership, BYPASSRLS or blanket/default grants. Preserve existing public
table permissions and the backup role's scope; it must have no connection-schema access.
Run the canonical `verifyConnectedApiDatabase` through the actual API login after grants, without
an owner session or `SET ROLE`. Activation fails closed if effective permissions or any of the
five ownership policies differ from the approved scope.

### Prepared Worker package and execution order

The repository-native Docker build and Silly packaging helper produce a Linux Node 24 package
from merged main. Its SHA-256 is
`2a8a5fe05eff1949ab1f89d6aac682fff2a17027f5f31ae329c31fafa869dc98` (16,875,570 bytes).
The package retains dependency links, the native launcher, recovery launcher and compiled ESM
boundary; it contains no root package metadata that would trigger panel dependency installation
and no environment/key files. A read-only, network-disabled native smoke verifies Worker/auth/
persistence imports and synthetic encryption roundtrip plus wrong-purpose rejection. This is
packaging verification, not live private-provider acceptance or a workload-capacity claim.

1. Obtain review of the exact registration, selected synthetic repository, credential destinations
   and grant proposal. Submit the prepared App registration only after that review.
2. Verify both compatible reader deployments, original private runtime configuration and original
   Worker module hashes. Preserve the exact original package/configuration for rollback. Resolve
   the pending delivery normally and obtain fresh safe shutdown/ownership evidence before replacing
   runtime files. If work cannot drain, diagnose it before installation; do not discard it.
3. Use the existing hash-checked Silly installer with the prepared archive; preserve dependency
   links and private runtime configuration. Restore `start-worker.js` and empty installer arguments
   before normal startup. Start the new Worker with only the data key added. Its canonical migration
   adds nullable ownership and connection storage plus the five reviewed RLS policies.
4. Recheck anonymous durable acceptance, status/report reads, normal outbox delivery and backup-role
   scope. Verify non-owner isolation using authorized synthetic rows/repositories. Apply only the
   two reviewed grants, then run the canonical activation guard with the actual restricted login.
5. Enable API connection variables last, keeping `STACKLENS_DATABASE_MODE=worker-managed` and the
   same-origin proxy. Verify exact deployed revision, callback/cookie/cache headers and provider
   access-log handling before live private consent.
6. Run selected private/public acceptance, owner/anonymous isolation, sign-out, expiry and revoked
   access, preserving pending work and sanitizing evidence. Observe a fresh scheduled cloud capture
   and independent restore for the activated revision; distinguish strict private preservation from
   public HTTP coverage and prove anonymous private 404 with no restored connection credentials.

Disable connection writers first for rollback. Keep compatible private-aware readers, restricted
API credentials and ownership policies after private data exists. Do not restore an owner-credential
public-only API. Preserve the original Worker package/configuration and data key while sessions
remain active; never relax RLS or backup exclusions to make rollback pass.

FR-101 implementation follows hosted FR-100 acceptance. Persistent public replacement/cutover and
broader capacity remain separate release gates.
