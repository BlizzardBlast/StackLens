# FR-100 callback privacy mitigation proposal

**Updated:** 2026-10-16. **Status:** dummy-only probe deployed through Chrome; seven hosted cases
and scoped log checks pass. Production callback transport is implemented locally under ADR-0024;
hosted cutover, remaining logging verification and real OAuth remain gated.
**Traceability:** FR-100, SEC-003/004/005/007, NFR-008/009/010, GOV-002/003/006/007;
[ADR-0023](../adr/0023-read-only-github-connections.md).

## Constraint and verified state

The operator explicitly declined an exception for Vercel retaining callback query values and
required connections to remain disabled while logging is resolved. The existing App installation
is complete for exactly the synthetic private fixture. Installation and StackLens OAuth consent
are separate. No real OAuth code has been sent, and the App secret/API data key remain local.
See the [activation checkpoint](github-connections-activation.md).

An October 15 dummy probe proved that Vercel Request Logs retain callback `code` and `state`,
including through the same-origin web proxy. Its [runtime log documentation](https://vercel.com/docs/logs/runtime)
lists search parameters. Application redaction, a redirect after arrival, request sampling,
short retention and PKCE do not remove that first platform record. No supported exclusion before
storage has been verified for the existing projects.

## Approved synthetic HTTPS hosting probe

Use one Cloudflare Workers Free resource named `stacklens-fr100-callback-probe` in an existing
operator-controlled account, on its assigned HTTPS `workers.dev` address. The operator separately
approved this scope and completed sign-in. It extends the original existing-host approval. Do not
create an account, accept new terms, add a card, enable a paid plan, connect a Git repository or
provision a custom domain as part of this probe.

The prepared local module exposes only `/health` and `/callback-probe`. The latter accepts exactly
one `code` beginning `stacklens-fr100-dummy-` and one `state` beginning `synthetic-state-`, with
bounded safe characters. It rejects real-looking OAuth values, duplicates, extra fields, body
submissions and unencrypted URLs. Its only redirect is the fixed StackLens home page with dummy
values in the URL fragment, never its query. Responses are empty and carry no-store/no-referrer
headers. The module has no imports, logging, network calls, storage, secrets or bindings.
This probe cannot finish OAuth and must not be registered as the GitHub App callback.

The pinned Wrangler 4.151.0 configuration has `workers_dev: true`, `preview_urls: false`, and:

```json
{
  "observability": {
    "enabled": false,
    "logs": { "enabled": false, "invocation_logs": false },
    "traces": { "enabled": false },
    "issues": { "enabled": false }
  }
}
```

Current Cloudflare documentation says new Workers enable observability by default and supports
[disabling invocation logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).
The [configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/#observability)
describes log persistence and issue collection controls. This makes Cloudflare a candidate,
not a verified privacy result. Configuration disables collection only for this new callback probe;
existing StackLens monitoring is unchanged. Do not attach Tail Workers, Logpush, telemetry exports
or third-party error/analytics collectors. Inspect account-specific settings before sending canaries.

The [Free allocation](https://developers.cloudflare.com/workers/platform/pricing/) lists 100,000
requests/day and 10 ms CPU/request. Account eligibility and no-card availability remain live gates;
stop rather than adding billing if the account cannot provide this resource for free.

Local preparation lives in the ignored `.cache/fr100-callback-relay/` directory: `worker.mjs`,
`worker.test.mjs`, `wrangler.json`, and the dry-run `build/worker.js`. Artifact digests are in the
[continuation evidence](release-evidence/2026-10-16-github-connections-continuation.json).
Five tests pass, including an owned loopback HTTP test confirming that the fragment does not enter
the request target. Wrangler accepts the configuration and builds a 1.77 KiB module without bindings.
These local checks establish neither hosted log exclusion nor a working production callback.

Deploy the exact probe with logging disabled before it handles any callback canary, then send
unique dummy canaries. Verify settings, request behavior,
Worker logs/traces/issues and any account/security logging surfaces that can retain URLs. Check
Vercel for the landing request without callback query values. Record what each inspection covers.
An empty log search alone is insufficient evidence that collection was disabled. Do not enable logs
on the candidate as a diagnostic shortcut. Do not claim that these checks prove absence from
provider-internal systems that are not observable. If required logging cannot be excluded or its
boundary cannot be established, keep connections disabled and reject this candidate.

### Historical October 16 dashboard preparation and editor wait

The existing account displayed no projects and a 100,000-request Free daily allocation. The
approved resource now exists at `https://stacklens-fr100-callback-probe.fdsurya7.workers.dev`.
The dashboard requires a Hello World starter before exposing settings, so the exact prepared
initial CLI configuration was not used. The harmless starter was created first, then invocation
logs, persistence and collection were disabled and deployed before opening the source editor.
Traces and issues were already off. A fresh settings navigation verifies all three collection
switches remain off. Preview URLs are off, with no bindings, variables/secrets, custom domains,
Git integration or telemetry export destinations. No billing or account creation was needed.

The dashboard's saved configuration retains parent `enabled: true` with explicit
`logs.enabled: false`, `invocation_logs: false`, `persist: false`, `traces.enabled: false` and
`issue_detection.enabled: false`. These observed values are recorded separately from the
prepared Wrangler configuration, which disables the parent. The editor automatically requested
the query-free root and displayed the starter's fixed console message after persistence was
disabled. This transient editor console is not evidence of stored Worker logs. The editor remained
loading on its initial visit and one reload, then was left to close the live preview.

The prepared module has not been uploaded and no callback canary has been sent. Wrangler reports
no authenticated session. A token summary was prepared with only **Workers Scripts: Edit** on
the selected account and a short configured lifetime. The operator chose **Wait for the browser
editor instead**. The unsubmitted token tab is closed and the unused CLI deployment helper is
removed. No token was created or authorized. Continue through Chrome and do not infer permission
to create a token or perform CLI login from the synthetic-host approval. The
[host preparation evidence](release-evidence/2026-10-16-github-callback-probe-host.json)
preserves the starter/settings sequence and failed editor attempts; the later operator decision
supersedes its pending-token status.

A fresh Chrome editor tab and one diagnostic reload still leave a blank source frame and disabled
Deploy after a bounded 45-second event wait. DNS resolves for the dashboard and editor host. The
browser tool subsequently reports that raw diagnostics are unavailable while it resolves a paused
document response. This is a pending review, not a reported rejection or proof of a Cloudflare
outage. No security bypass or alternate credential path was attempted. The editor is left open
for continuation; no production callback or hosted canary behavior is accepted from this wait.

### Successful October 16 probe rollout

The operator's screenshot showed the editor had loaded. Fresh automation inspection confirmed it;
the earlier blank view and pending-document report were historical observations, not the current
page state. The complete reviewed `worker.mjs` replaced the starter through Chrome. Native editor
copy/readback matched the reviewed source after CRLF normalization before publishing. GitHub
connections stayed disabled, and no token or CLI login was created. The dashboard confirmed
**Version saved** and active version `d8a636de`.

After leaving the editor preview and stopping transient network diagnostics, a fresh settings view
confirmed logs/traces/issues still off, with no variables/secrets, bindings or export destinations.
Seven live synthetic cases pass: health, root denial, fixed fragment redirect, non-dummy code
denial, duplicate code denial, redirect injection denial and POST denial. Responses are empty with
no-store/no-referrer. The approved dummy values appear only in the fixed landing fragment.
The landing succeeds, and direct/proxied session responses remain HTTP 200, disabled and private.

Cloudflare's stored-event search for the unique canary returns **No events found** in the displayed
06:41–07:41 WIB window, covering the 07:38:42 canary and refreshed after the stated two-minute
ingestion delay. The unfiltered history has two harmless starter events at 07:13:39, before
collection was disabled; do not erase or describe that earlier history as empty. Vercel's CDN
Requests view independently shows the matching request ID at 07:38:42.464 as `GET /`, HTTP 200,
with no callback query values. Its Request Logs view initially showed no entries because this
landing is static; the CDN view supplies the relevant evidence.

The [probe acceptance evidence](release-evidence/2026-10-16-github-callback-probe-acceptance.json)
records these scoped results and source identity separately from earlier failed attempts. This
combines disabled collection with a real canary search; an empty search alone is insufficient.
It does not prove absence from provider-internal systems or independently verify every account
security logging surface. Those boundaries and production callback body/error/trace logging remain
gates before real OAuth. The existing GitHub callback and accepted state/PKCE flow are unchanged.

## Production transport: local implementation, hosted activation gated

The operator subsequently accepted local production callback work while preserving the disabled
hold. [ADR-0024](../adr/0024-private-github-callback-transport.md), updated FR-100 and the
[cutover package](github-callback-cutover.md) now record its implementation. No hosted change or
real code transmission is implied. The transport preserves GitHub web state/PKCE:

1. GitHub redirects to one fixed, reviewed HTTPS relay callback. It has no App secret, session data
   key, access token, database or repository access. It handles bounded callback metadata and
   redirects only to a dedicated StackLens landing page using the fragment and no-referrer/no-store.
2. A minimal dedicated landing page clears the fragment with `history.replaceState` before any
   additional scripts, analytics, network requests or error reporting. It posts bounded callback
   fields in the body to the same-origin API. Strict CSP and no third-party resources isolate this
   page. The fixed same-origin POST uses same-origin referrer policy after URL clearing to retain
   Firefox's exact Origin header; only the sanitized landing path can be sent as Referer. The
   document/relay remain no-referrer. Do not load the application with callback values in the fragment.
3. The API validates exact Origin and the existing encrypted, expiring state/PKCE cookie before
   token exchange and retains all current session/owner/RLS boundaries. The initial top-level GET
   allows the existing SameSite=Lax cookie; a direct cross-site relay POST would not. The GitHub
   token exchange must use the exact relay redirect URI. Vercel receives no callback query values.

The local change updates requirements, ADR/architecture, the landing/POST contract, OpenAPI,
failure cleanup and focused adversarial tests. Before production, verify
all request-body/error/trace logging surfaces using dummy values; finish the database-backed quality
gate and required CI; and deploy compatible readers before enabling connected writers. Review the
exact GitHub callback change and new credential destinations before any real consent. The original
GET callback must not remain an advertised hosted path for real credentials. Source preparation
does not grant production activation authority; its review remains separate.

GitHub's [device flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
avoids redirect callbacks but introduces a code-entry/polling flow documented for headless apps.
It remains an alternative requiring an explicit product/security decision; device flow is still
off on the registered App. The accepted PKCE sign-in has not been replaced.

## Rollback and remaining acceptance

During this synthetic probe, keep API connection configuration absent, the existing App callback
unchanged, and all existing Worker/database/backup resources intact. An unused failed probe can
remain undeployed or be disabled; do not permanently delete a hosted resource without the required
confirmation. No sessions or credentials need revocation because the probe cannot create them.

After a production mitigation is separately completed, hosted FR-100 still requires explicit real
consent, the selected synthetic private analysis, owner/anonymous/other-owner report isolation,
sign-out/expiry/revocation and fresh scheduled capture/restore with private markers preserved and
connections excluded. FR-101 follows those gates.
