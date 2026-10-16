# ADR-0024: Isolated GitHub callback transport

- **Status:** Accepted for local implementation; hosted cutover gated
- **Date:** 2026-10-16
- **Requirements:** FR-100, SEC-003/004/005/007, NFR-005/006/008/009, GOV-002/003/006/007
- **Supersedes:** ADR-0023's direct GET callback transport only

## Decision

Vercel request metadata retains callback query values before application redaction. The operator
declined that retention exception. Keep connections disabled until the new hosting boundaries are
verified with synthetic values and the exact production destination/callback change is reviewed.

Use a fixed HTTPS relay with no secrets, bindings, storage, provider calls or repository access.
The single-module source is `apps/github-callback-relay/worker.mjs`; its fixed destination is
`https://stacklens-web.vercel.app/auth/github/complete.html`. Only a bounded GET on
`/v1/auth/github/callback` can redirect, with metadata in the fragment. Unknown/duplicate fields,
oversized URLs, unsafe codes and other methods/paths fail closed. Provider error details are
validated but discarded; only a fixed denial marker and optional state cross the relay.

The static dedicated landing has one synchronous inline script, an exact script-hash CSP, no
imports, analytics, third-party resources or application bootstrap. It clears query/fragment with
`history.replaceState` before parsing, requests or navigation. Failure to clear stops processing.
It sends bounded fields as JSON only to same-origin `POST /v1/auth/github/callback`, with no-store,
a finite timeout and no automatic retry. The document/relay use no-referrer; the same-origin-only
POST explicitly uses `referrerPolicy: same-origin`, carrying only the already-cleared page path.
Firefox otherwise sends Origin:null for same-origin mode with no-referrer, breaking exact-Origin
validation. Callback values never enter that header. Fixed success/error navigation uses replace.
JavaScript-disabled visitors get a first-party retry link; the fragment cannot be cleared then,
so no resources, requests or automatic fallback are permitted.

The API rejects GET authorization and requires exact configured Origin before body parsing. It
clears pending cookies after trusted success, denial, malformed input and provider/store failure.
Foreign/missing Origins cannot clear pending cookies. JSON body/query validation and the 8 KiB
body limit precede provider I/O. State/PKCE remains authoritative and binds the configured callback
URI inside its authenticated ten-minute cookie. `STACKLENS_GITHUB_CALLBACK_URL` is mandatory when
connections are configured; it is used identically at authorization and exchange. No default
returns hosted authorization to Vercel's query callback.

The initial cross-site top-level GET preserves the existing SameSite=Lax cookie. The following
same-origin POST sends it; a direct cross-site POST would not. Tokens, opaque sessions, owner/RLS
checks, restricted grants, transient source handling and backup exclusions remain ADR-0023.

## Verification and rollout

Normal checks use synthetic callbacks/providers and owned local databases. Tests cover relay
bounds/fixed destinations, browser fragment removal and request ordering across three engines,
reload/back behavior, CSP/header integrity, POST Origin/state/PKCE, cleanup and real application
logger output. The dedicated landing headers apply in local preview and generated Vercel config.

The already deployed dummy-only probe is separate evidence and remains unchanged by source edits.
The real relay is not deployed by ordinary builds or tests. Before activation, inspect account
security/log/export surfaces, validate collection disabled on the exact relay version, and verify
dummy body/error/trace values on both API and web proxy. Record observable scope and provider
limitations. Review the exact real-code destination and GitHub callback change, deploy compatible
web/API readers, then enable the existing credential scope. Preserve the selected-repository and
private-session/restore acceptance gates. Do not start FR-101 early.

Rollback disables API connection configuration first. Restore compatible owner-aware readers,
leave GET completion disabled and remove the relay from the advertised GitHub callback list.
Do not roll back to an enabled direct-query callback. No database migration or new credential is
required by this transport change.

References: [GitHub callback registration](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-user-authorization-callback-url),
[Vercel runtime logs](https://vercel.com/docs/logs/runtime), and the
[privacy investigation](../implementation/github-callback-privacy.md). The
[Fetch Origin algorithm](https://fetch.spec.whatwg.org/#append-a-request-origin-header) explains
the explicit same-origin POST referrer policy; it does not allow Origin:null at the API.
