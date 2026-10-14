# GitHub sign-in and private analysis

Status: implementation delivered through [PR #58](https://github.com/BlizzardBlast/StackLens/pull/58);
hosted activation pending. Requirements: FR-100, FR-003/017/022,
SEC-001/002/003/004/005/006/007/008, NFR-006/007/008/009/010. Decision: [ADR-0023](../adr/0023-read-only-github-connections.md).
Saved repositories (FR-101), historical comparison (FR-102), and repository writes are outside this milestone.

## User flow

Anonymous public GitHub analysis and quick manifest analysis remain available. When connection
configuration is enabled, the home page offers **Connect GitHub for private repositories** and
**Choose repositories on GitHub**. The operator's GitHub App must request Contents read and
Metadata read only, with selected repository installation. No OAuth `repo` scope is requested.
The user signs in on GitHub, installs/authorizes the App, and explicitly selects **Use my GitHub
connection for this analysis**. Private results require the same GitHub account; missing,
expired and other-owner reads return the same 404. Connection failure never submits privately
entered input through the anonymous endpoint.

Dependency names and exact versions may be queried at npm and OSV, as disclosed before submission.
Source/config bodies remain bounded transient inputs, never executed or stored in reports.
Sign-out deletes this local connection, cancels pending browser session reads and clears browser
analysis queries. A late response from before sign-out cannot restore the connected UI.
Cached session expiry is checked before rendering, including the first render after returning from
a screen without a connection observer. No expired cached identity, connected controls or private
analysis is shown while a refresh or cache cleanup is pending. Other independently
created sessions expire separately. Sign-out does not uninstall the GitHub App; grant removal is
managed on GitHub. Removing access stops subsequent repository requests; requests already sent
cannot be recalled. Completed reports remain owner-bound until configured finite retention.
Reconnecting the same numeric GitHub identity can read them; it does not transfer ownership or
resume an analysis tied to an ended connection. Submit a new analysis after reconnecting.

## Server and database boundaries

`packages/github-auth` owns OAuth state/PKCE (10 minutes), fixed-origin callback, an expiring
GitHub App user token (at most eight hours), and session/CSRF. Refresh tokens are discarded.
The browser receives only a host-only HttpOnly, SameSite=Lax, Secure HTTPS session cookie and
session display/CSRF data. Localhost HTTP development uses unprefixed cookies; HTTPS uses
`__Host-` cookies with Path=/ and no Domain. `POST /v1/analyses/github` and sign-out require exact
configured Origin plus `X-StackLens-CSRF` from the session response. The callback redirects only
to the configured home page
and application logs omit request URLs/cookies/codes, including unmatched-route messages. The
generic not-found response does not echo a URL. Denied provider payloads become fixed safe errors.
GitHub authorization errors accept optional `error_uri` metadata up to 2,000 characters, including
relative references. The field is ignored: it is never fetched, rendered or used as a redirect.
Accepted denial/suspension/callback-mismatch responses clear the OAuth state cookie and return to
the configured home page's error notice with no-referrer/no-store headers. Unknown fields and
oversized metadata retain the stable schema-validation error; the OpenAPI contract uses the same
bounded schema.

The connection table is `stacklens_auth.github_connection`. It stores SHA-256 session hashes,
numeric GitHub identity, login, expiry and AES-256-GCM token ciphertext. Encryption authenticates
all identity/expiry metadata. The data key is separate from the App client secret; the Worker
receives the data key only. The existing bounded retention sweep removes expired connections.

Analysis rows carry nullable `owner_github_id` / `github_connection_id` together. Anonymous and
historical rows retain null ownership; archived report JSON and score policies stay unchanged.
Outbox/Graphile payloads remain identifier/repository/ref only. Per-request transaction-local
owner context applies RLS to analysis, report and delivery tables. Legacy restricted readers
without context see anonymous rows only. Application owner checks occur before report reads as
defence in depth. Each Worker GitHub request rereads the connection and stays bound to one
canonical repository; sign-out, expiry and 401/403/404 access failures stop private work without
public/global-token fallback. Typed access denial is terminal and asks the user to reconnect;
temporary credential-store failures retain safe retryable provider behavior. The acquisition
deadline includes token retrieval and propagates job cancellation into it. Every credential operation has
an eight-second total checkout/I/O deadline and a transaction-local PostgreSQL statement timeout.
This covers reads, OAuth connection creation, sign-out/expired-session deletion and expiry cleanup.
Interrupted operations destroy only their borrowed client; late checkout completion releases its client
without issuing a credential query. Healthy pooled connections do not inherit the statement timeout.
Worker shutdown cancels an active credential purge and waits for its cancellation before closing
the pool. Analysis maintenance and Graphile ownership still drain through their existing lifecycle.
Timeout failures remain safe errors and ordinary cleanup failures are retried by the next sweep.
The global read-only public provider token is independent.

GitHub, npm and OSV abort each request-owned controller on exit, including rejected HTTP responses
whose bodies were never consumed. Provider failure classification remains unchanged; ignored error
streams cannot outlive the completed request while waiting for EOF or garbage collection. Native
fetch regressions use only owned loopback servers with synthetic stalled bodies, covering revoked
access, rate limits and retryable server errors without contacting live providers.

## Reviewable hosted activation sequence

Implementation publication is separate from hosted FR-100 activation. Independently verify current
main, web/API reader deployments and the Worker/schema revision before provisioning credentials
or enabling connected submissions; a successful automatic build alone is not live acceptance.
Use existing hosting and the approved restricted API/backup roles; do not create another host or
backup schedule. Before live activation:

1. Register/review a GitHub App with Contents **read**, Metadata **read**, selected repositories,
   expiring user tokens, and callback `https://WEB_ORIGIN/v1/auth/github/callback`. Leave all write
   and organization permissions off. Keep user authorization during installation off: installation
   and StackLens's state/PKCE sign-in are separate explicit steps. Review this exact registration
   before submitting it.
2. Prepare API-only `STACKLENS_GITHUB_CLIENT_ID`, `STACKLENS_GITHUB_CLIENT_SECRET`,
   `STACKLENS_PUBLIC_ORIGIN` (exact browser origin), and
   `STACKLENS_GITHUB_INSTALLATION_URL=https://github.com/apps/APP-SLUG/installations/new` in private
   operator configuration outside Git. Prepare a separate random 32-byte hex `STACKLENS_GITHUB_SESSION_KEY`
   for API and Worker; retain it privately for existing sessions. Never use a backup master key.
   Keep all API connection variables absent until step 5; deploy only the Worker data key in step 3.
   Leave browser `VITE_STACKLENS_API_BASE_URL` unset: connection requires the same-origin proxy.
3. Deploy compatible API/web readers with connection configuration absent, then the Worker/schema
   migration and Worker data key. Verify anonymous durable acceptance, status reads and outbox
   delivery on the pre-migration schema with the restricted API login. Anonymous inserts name only
   pre-existing columns and use compatible row projections; connected writes remain disabled.
   Nullable columns preserve legacy data. Confirm the restricted
   API cannot read owner-bound synthetic rows, that policies/grants are intact and that the
   existing backup role's approved SELECT/BYPASSRLS scope is unchanged. It must still have no
   access to `stacklens_auth`. Do not broaden its scope.
4. On the existing restricted API role only, grant `USAGE ON SCHEMA stacklens_auth` and
   `SELECT, INSERT, DELETE ON stacklens_auth.github_connection`. Keep public table permissions
   unchanged: SELECT analysis/report/delivery; INSERT analysis/delivery; no UPDATE/DELETE, DDL,
   owner, membership, superuser or BYPASSRLS. Review the exact grants and role first. There are
   deliberately no new connection-store UPDATE or blanket schema/default grants.
5. Enable API configuration last with `STACKLENS_DATABASE_MODE=worker-managed`. Startup rejects
   elevated or role-switched sessions, owner/BYPASSRLS and unprotected/incomplete RLS readers.
   It also rejects effective CREATE on the database or any permanent schema (including PUBLIC
   grants and schemas outside the API search path), database/schema ownership and connection-table
   ownership. Whole-row JSON reads explicitly call `pg_catalog.to_jsonb`; Worker/API/recovery
   readers cannot resolve an application-schema exact-type overload. Recheck grants on subsequent
   deployments and changes to database privileges.
   It verifies all required table permissions and rejects extra table/column write, TRUNCATE,
   TRIGGER, REFERENCES and PostgreSQL 18 MAINTAIN grants across analysis/report/delivery and
   connection storage, including effective PUBLIC grants. The approved connection DELETE grant
   is retained. RLS does not protect TRUNCATE; a permissive ACL is never accepted on that basis.
   The guard verifies all five policy names, tables, commands, roles, permissiveness and canonical
   `USING`/`WITH CHECK` definitions. PostgreSQL 18 definitions that differ fail closed. Worker
   migration atomically reconciles only the five StackLens-owned policies; unexpected policies
   require operator review and abort migration rather than being silently removed.
   Confirm callback/cookie/proxy headers,
   selected private/public repository behavior, owner/anonymous 404 equivalence, sign-out, expiry,
   revoked access and sanitized logs using explicitly authorized synthetic repositories. Review
   provider access-log settings for callback query handling as well as application logging.
6. Complete final-head CI/review and browser/hosted acceptance before publishing a private-enabled
   milestone. Confirm a fresh scheduled cloud capture and independent restore on that revision;
   a local passing suite is not live acceptance.

## Rollback and recovery

Disable connection writers first; keep compatible private-aware readers and the restricted API
role. Never roll an API holding owner/BYPASSRLS credentials back to a public-only reader after
private data exists. Existing restricted public-only readers are protected by RLS. Keep the data
key while active sessions exist; rotating it invalidates connections and requires reconnecting.

Analysis snapshots still cover the same seven public/Graphile tables, including private owner
markers and reports. Dumps explicitly exclude `stacklens_auth`, so restoring a backup never
restores access/session credentials. Existing backup custody, 24-hour authenticated eligibility,
two-provider-day live retention, quarantine and owned cleanup are unchanged. Old archives without
owner columns remain readable without modifying historical rows. Strict readback checks all
retained reports; anonymous HTTP readback covers public reports and expects 404 for private ones.
Receipts distinguish `strictReportReads`, `apiReportReads` and `privateReportAccessDenied`, and
assert `connectionCredentialsRestored=false`. Zero public API report reads is explicit coverage,
not proof that a private result was opened anonymously. Restored private results require a fresh
connection for their owner; copied private work never inherits a credential or unlock permission.
Persistent public compute-loss/cutover/rollback remains a separate recovery gate.

## Local verification

Synthetic provider tests cover state/PKCE, fixed endpoints, expiring token validation, metadata
tampering, Origin/CSRF, identity, sign-out and revoked access. Real local PostgreSQL tests exercise
RLS under a non-owner role, owner writes, transaction rollback, pooled identity isolation and old
archive readers. The restricted role is an actual login; an elevated login that switches into
that role is rejected. A full local OAuth/API/outbox/Graphile/Worker exercise uses synthetic
GitHub/npm/OSV responses and proves owner-only report readback and sign-out. Offsite fixtures
restore private reports with seven matching fingerprints,
unchanged rows, no restored connection schema, anonymous 404 and complete owned cleanup. Browser
acceptance covers explicit mode selection, CSRF submission, responsive layout and report removal
after sign-out. Use `TEST_DATABASE_URL` only for an owned local test database, then `pnpm check`.

The latest October 13 local `pnpm check`, after the five initial and two subsequent review fixes,
passed build, runtime smoke, UI configuration, type checks, all 718 tests (639 package, 50 operations, five deployment and
24 browser cases), lint and format checks. Browser cases run in Chromium, Firefox and WebKit
at desktop and narrow sizes.
The initial 20 added regressions exercise drifted policy predicates/commands/roles and missing policies,
unknown-policy rejection, blocked and queued PostgreSQL credential reads, late session responses,
native Fastify logs, typed revoked access and temporary credential-store failures. Fourteen additional
cases check approved API access, unsafe effective grants/ownership (including revoked owner CREATE),
an actual API-created exact-type function overload and session/private-analysis remount after expiry.
Read the [final review-fix evidence](release-evidence/2026-10-13-github-connections-final-review-fixes.json) for current
source hashes, verification and cleanup. The
[five-finding evidence](release-evidence/2026-10-12-github-connections-review-fixes.json) preserves
the earlier 704-test snapshot. The
[initial local evidence](release-evidence/2026-10-12-github-connections-local.json) preserves the
earlier 684-test source snapshot and failed attempts. These results do not replace final-head CI,
live GitHub consent/provider checks or hosted acceptance.
