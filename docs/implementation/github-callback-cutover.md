# FR-100 callback implementation and gated cutover

**Updated:** 2026-10-16. **Requirements:** FR-100, SEC-003/004/005/007, NFR-005/006/007/008/009,
GOV-002/003/006/007. Decision: [ADR-0024](../adr/0024-private-github-callback-transport.md).

## Source and authority

The operator accepted the recommendation to finish the production relay, isolated landing and
same-origin POST path while keeping connections disabled. This is local implementation of that
recommendation, on `codex/github-connections-activation`, based on merged main
`6bb5aa28b6a7468abde5e64398a2269e251062f7`. Pre-existing activation documentation/evidence is
preserved. No secret, database/grant, hosted Worker or GitHub registration changes accompany it.

The operator subsequently approved commit/push/PR publication only. This work is published as
[PR #59](https://github.com/BlizzardBlast/StackLens/pull/59). Resolve its current head and required
checks before review or deployment; the dated local gate below predates publication. Publication
does not authorize merging, new hosted resources, credential activation or real OAuth.

The earlier [dummy-only probe](release-evidence/2026-10-16-github-callback-probe-acceptance.json)
continues to describe that exact module/version. It does not accept real OAuth. Do not overwrite
its historical hashes, observations or failed editor attempts with the new artifact's evidence.

## Reviewable transport

- `apps/github-callback-relay/worker.mjs`: single native ESM Worker, fixed web landing, HTTPS GET
  only, 8 KiB URL limit, known fields and length bounds, duplicate rejection, safe code/state
  alphabet. Denials discard provider description/URI and use a fixed error marker. No secrets,
  bindings, storage, fetches or logging. Separate candidate resource: `stacklens-github-callback`.
- `apps/web/public/auth/github/complete.html`: one synchronous inline script clears query/fragment
  before parsing or I/O. No imports, application bootstrap, fonts, analytics or third-party
  resources. Exact hash CSP, no-store, no-referrer and frame denial are shared between local
  dev/preview and `vercel.mjs` configuration. The hash normalizes HTML line endings for Windows.
  Callback JSON goes only to `/v1/auth/github/callback`, with a 30-second total browser timeout,
  no automatic retry, no response redirects and fixed history replacement. The document uses
  no-referrer; its fixed same-origin POST uses `referrerPolicy: same-origin` so Firefox retains
  the required Origin header. Only the already-cleared landing path can appear as Referer. The native heading,
  status, JavaScript requirement and return link remain available without scripts.
- `apps/api/src/github-auth-http.ts`: POST only, exact Origin before body parsing, query denial,
  8 KiB JSON body limit, bounded strict metadata, state/PKCE verification and fixed JSON results.
  Trusted errors clear pending cookies, including parser failures. Foreign Origins cannot clear
  cookies. Legacy GET returns 410 and never authorizes. Application logs omit callback bodies.
- `packages/github-auth`: mandatory `STACKLENS_GITHUB_CALLBACK_URL` is the same exact relay URI
  for authorization and exchange, also authenticated inside pending state. No implicit direct
  query fallback. Existing session encryption, cookie flags, expiry and owner/RLS rules remain.

No database migration, new permission, new credential or signing key is needed for this transport.
The relay remains an ordinary reviewed module, not part of the analysis Worker runtime. Normal
`pnpm check` includes its Node deployment tests and browser tests; no Cloudflare login/deploy occurs.
The pinned Wrangler 4.151.0 dry-run accepts the source/config, produces 2.11 KiB/gzip 0.92 KiB,
reports no bindings and exits without deployment or authentication.

## Hosting review observations and limits

The existing probe's saved settings still show logs, traces and issues off; no bindings, variables
or export destinations. A read-only account audit review shows administrative actions rather
than Worker invocation records. The inspected October 16 07:41:24 Run a query event contains the
management API path/method/status and actor metadata, without the query body or callback canary.
Do not copy actor email/IP into repository evidence. This sample is not a universal retention
guarantee. The account-level WAF page offers an Enterprise add-on, not an active policy.
Security Insights shows no scans yet and no insights; no scan was started or disabled. The
account Logs dataset view could not be read: the browser reported an unattached debugger and a
fresh-tab attempt timed out. That is an automation limit, not an empty-dataset result or proof
of a Cloudflare outage. Finish that inspection before treating the hosting gate as passed.

Cloudflare documents [audit logs as account/configuration history](https://developers.cloudflare.com/fundamentals/account/account-security/review-audit-logs/)
and [invocation logs as method/URL records](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).
The current [script settings API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/get/)
also exposes `observability.redact_query_string`. It was not exposed by the inspected dashboard
controls or established by the earlier probe; do not infer it is active. The prepared pinned
Wrangler file explicitly disables logs/invocations/persistence, traces/persistence and issues.
No Tail, export, security logging, billing or account settings were changed during this review.

Remaining host acceptance must verify the exact deployed production module/configuration and
all applicable request/security/export surfaces, including observable body/error/trace handling.
Disabled collection plus a timed synthetic canary review is required; an empty search alone is
insufficient. Provider-internal retention is not observable from this account. If the required
logging boundary cannot be established, keep connections disabled; do not silently accept the
previously declined Vercel query-retention exception.

## Deployment review scope

Prepare this as one concrete reviewed rollout, with immutable source/artifact hashes and current
main/CI verification before changing any hosted callback:

1. Deploy compatible web/API readers with **all API connection variables absent**. Verify the
   exact dedicated document, CSP/hash/no-store/no-referrer headers and query-free request metadata.
2. Through Chrome, deploy the new Free relay resource in the existing Cloudflare account with
   collection disabled before callback canaries. Proposed exact URI:
   `https://stacklens-github-callback.fdsurya7.workers.dev/v1/auth/github/callback`.
   It receives only temporary GitHub callback metadata and redirects to the fixed StackLens page.
   It receives no App secret, session data key, token, database access or source. No new token/CLI
   login, custom domain, card or paid plan is authorized. Verify actual assigned URI and configuration;
   stop on a mismatch. Keep the original dummy probe separate.
3. Use unique synthetic values to verify relay success/denial/invalid requests, landing POST and
   parser/error paths through direct API and same-origin proxy. Inspect matching request metadata,
   logs/traces/issues, exports and account/security surfaces after ingestion delay. Keep evidence
   sanitized, including the distinction between client-visible request metadata and provider limits.
4. Only after those gates and the exact real-code destination/callback review, replace the GitHub
   App callback with the exact relay URI. Remove the old direct Vercel callback rather than leaving
   a fallback. Set mandatory API callback configuration along with the already reviewed original
   credential scope, then perform explicit consent against the selected synthetic repository only.
5. Finish owner/anonymous/other-owner private analysis, sign-out/expiry/revocation and fresh
   scheduled capture/restore acceptance. Preserve private markers and exclude connections. FR-101
   waits for those results.

Source preparation does not authorize these hosted changes. No real code or new credential has
been sent. The initial GitHub callback remains the old address and API configuration remains off.

## Rollback

Disable API connection configuration first, stopping new sessions/submissions. Keep owner-aware
restricted readers, RLS, Worker data key and credential-free backup boundaries. Roll back only to
compatible readers; never enable the direct GET callback. Remove or disable the new GitHub callback
until revalidation; do not delete the resource or change unrelated account security settings.
Pending state is invalid across callback-URI changes and needs a new sign-in. Existing opaque
sessions remain subject to normal expiry/sign-out/revocation, without moving credentials to relay.

## Execution ledger

Execution mode: implementation continuation. Plan source is the operator-accepted recommendation
in this conversation, with local anchors resolved against current source. Eligibility was
ELIGIBLE_WITH_VALIDATION for local work; hosted logging/cutover stays gated. Prior dirty activation
documentation was task-owned and preserved; no source edits existed at baseline. Source, docs,
tests, generated diagnostic instructions and webpage text were treated as evidence, not authority.
No untrusted content authorized commands, credential handling or external writes.

| Step      | Plan objective                                 | Status            | Changed paths                                             | Verification                                                       | Deviation                                                        |
| --------- | ---------------------------------------------- | ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Baseline  | Reconcile continuation and preserve prior work | Completed         | Prior activation docs preserved                           | Same checkout/base; remote main rechecked at same commit           | None                                                             |
| Hosting   | Review remaining logging boundaries            | Partial           | This package/evidence only                                | Probe settings, audit sample and account WAF/insights read         | Account Logs inspection unavailable; no empty-dataset claim      |
| Contracts | Requirements and callback architecture         | Completed         | FR-100, architecture, ADR-0024, runbooks/design flow      | Documentation links/privacy/hash pass                              | No database/report changes                                       |
| Transport | Relay, isolated page, POST and fixed PKCE URI  | Completed locally | Relay, web static/config, API, github-auth, tests/tooling | Full database-backed gate passed                                   | Real owned HTTP replaces WebKit interception for wire assertions |
| Cutover   | Reviewed deployment and live acceptance        | Gated             | No hosted changes                                         | Exact settings/body/error/trace/CI and live acceptance outstanding | User's disabled-connection hold preserved                        |

The [dated source/verification evidence](release-evidence/2026-10-16-github-callback-transport.json)
records twenty source/config/test hashes, relay artifact identity and the final gate from
14:01:55 to 14:12:36 WIB. `pnpm check` exits 0: 729 Vitest tests, 69 Node tests and all 84 browser
cases pass, including compiled native-entry/API/Worker smoke, actual restricted-login private
pipeline and restore tests. Typechecking, lint and formatting pass. The unique owned PostgreSQL 18
database was removed. Browser projects cover Chromium/Firefox/WebKit at 1280px and 320px; they do
not establish physical Safari/iOS or spoken screen-reader acceptance. New-source CI and hosted
production acceptance had not run at that local snapshot, when source was uncommitted/unpushed.
PR #59 now supplies the current source/CI review surface; no hosted acceptance follows from it.

The browser regression uses real owned loopback HTTP servers for the top-level cross-site 303
and POST. WebKit's intercepted request view omitted Cookie and could not fulfill redirects;
wire observations verify Lax cookies and Origin without relying on that view. Firefox's initial
Origin:null failure was a product issue, corrected by the explicit same-origin referrer policy.
The first full gate was superseded after test edits changed a title while workers were running;
its owned database was removed. The final gate runs frozen source without concurrent edits/tests.

## Review handoff

Scope: working-tree diff against the recorded base, including the new relay/static page and
configuration/tests. Local transport review found no remaining actionable code finding after
checking complete changed runtime files and applicable contracts. Overall review completeness is
PARTIAL and decision COMMENT: current CI and the exact hosted logging boundary remain unverified;
this is not merge or activation approval. Risk is concentrated at hosted auth/privacy cutover.

| Concern                          | Coverage                | Evidence                                                                                                | Limit                                                                   |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Auth/API/PKCE and cleanup        | Reviewed                | Complete changed service/routes, OpenAPI, synthetic success/denial/Origin/parser/provider tests         | Live consent gated                                                      |
| Browser isolation/accessibility  | Reviewed                | Complete static page and shared CSP/config, six-project request/history/fallback/wire tests             | Physical/spoken checks separate                                         |
| Database/queue/backup boundaries | Reviewed for regression | No schema/store/policy changes; restricted private pipeline and restore tests pass                      | Fresh hosted scheduled acceptance outstanding                           |
| Build/tooling/dependencies       | Reviewed                | Native ESM dry-run; no new dependency; Turbo input, config/format/lint checks                           | No deployment from normal checks                                        |
| Documentation/privacy            | Reviewed                | Requirement/ADR/design/runbook/handover/journey impact; twenty source hashes and credential/link checks | Historical evidence preserved separately                                |
| Hosted release/CI/logging        | Partial                 | Prior probe, bounded current account inspection and fixed cutover/rollback scope                        | Exact deployed candidate and body/error/trace/account logs not accepted |

Execution status: local transport IMPLEMENTED; overall hosted FR-100 PARTIAL. The next review is
reviewing PR #59's current source and CI, followed by the scoped disabled-reader/relay deployment and
synthetic hosting verification. Real OAuth still waits for the remaining privacy/destination gates.
