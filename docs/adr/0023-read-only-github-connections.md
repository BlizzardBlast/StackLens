# ADR-0023: Read-only GitHub connections and owner-protected analyses

- **Status:** Accepted implementation decision; production activation pending
- **Date:** 2026-10-12
- **Requirements:** FR-100/003/017/021/022, SEC-003/004/005/006/007, NFR-005/006/007/008,
  GOV-002/003/006/007

## Decision

Use the GitHub App web authorization flow with random state and PKCE S256, read-only Contents
and Metadata permissions, and explicit installation/repository selection. Do not use a classic
OAuth application's broad `repo` scope, installation-wide service credential or repository write
permission. The client secret stays with the API; the Worker receives no app client secret.

The first connection lifetime is at most eight hours and requires an expiring GitHub user token.
Refresh tokens are discarded. Opaque random session cookies are HttpOnly, host-only, SameSite=Lax
and Secure for HTTPS. State/PKCE cookies expire after ten minutes. Fixed configured callback and
return destinations prevent open redirects. Origin and session-bound CSRF checks protect connected
submissions and sign-out. No browser local/session storage contains credentials.
Accept bounded standard authorization-error metadata, including optional `error_uri`, so provider
denials reach pending-state cleanup and the fixed error redirect. Treat the URI only as unused
metadata; never fetch, display or navigate to it. The callback remains strict for unknown fields.

`@stacklens/github-auth` owns server-side cryptography, bounded fixed-host GitHub authorization and
the connection service. `@stacklens/persistence` owns connection storage in a separate
`stacklens_auth` schema and analysis ownership columns. AES-256-GCM binds ciphertext to its session
hash, GitHub identity, login and expiry using a separately provisioned 32-byte server key.
Only a cookie hash is stored; neither the cookie bearer nor plaintext GitHub token is persisted.
Expired connections are deleted on access
and by bounded Worker maintenance. Analysis backup tooling selects only public/Graphile schemas,
so it excludes connection ciphertext and requires reconnect after disaster recovery.

The existing anonymous submission route keeps its public-only adapter. A separate connected
submission route obtains the owner and connection reference from the session, validates access
through GitHub and persists them atomically with the analysis/outbox. The queue payload remains
source/secret free; the Worker reads the bound connection reference from durable analysis state.
An authorized adapter binds its token supplier to one exact repository and checks connection
availability for each request. Logout/expiry never falls back to a shared public-service token.

Owner-aware API reads occur in a transaction with local identity context, and check ownership before
report access. PostgreSQL RLS on analysis/report/delivery tables protects private rows from older
public-only **restricted** API readers that set no identity. The Worker/backup owner retains its
existing role scope. Activation requires a non-owner, non-BYPASSRLS request-bound API login;
bootstrap development remains anonymous unless an explicitly injected test connection is used.
Reader compatibility accepts older archives without ownership columns; hosted API schema
verification and the activation guard fail closed until migrations/RLS are installed.
The guard validates policy applicability and canonical predicates rather than counting policies.
Worker migration repairs the five owned definitions atomically and rejects unexpected policies.
Activation rejects effective database/permanent-schema CREATE, including PUBLIC grants and schemas
outside the API search path, as well as database/schema ownership and ownership of credential storage.
Owners are rejected even after revoking their own CREATE privilege, because they can regrant it.
Activation also validates required permissions and rejects extra table/column grants across
analysis, report, delivery and connection storage, including effective PUBLIC grants. Only
analysis/delivery SELECT/INSERT, report SELECT and connection SELECT/INSERT/DELETE are accepted.
TRUNCATE is unsafe despite RLS; TRIGGER, REFERENCES and MAINTAIN are outside the request-bound scope.
Privileged row reads use
`pg_catalog.to_jsonb` explicitly; an exact-type overload in an application schema must never run
with Worker privileges. Identity and credential-timeout calls also select catalog functions.
The web hook checks cached session expiry during render, including the first render after an
unobserved expiry, while effects continue to cancel/remove private query caches.
Credential lookup shares the acquisition cancellation/deadline. Reads, connection creation,
deletion and expiry cleanup have an eight-second total checkout/I/O deadline and a transaction-local
server statement timeout. Cancellation destroys only the operation's borrowed client and releases
late checkouts without issuing SQL. Worker shutdown cancels its credential purge before pool
closure; it still waits for analysis maintenance and Graphile ownership to drain.
Typed authorization denial is terminal; transient lookup failures remain safely retryable.

Report schemas, deterministic analyzer policy, anonymous polling and finite retention remain
unchanged. Owner identity and connection reference are application metadata, not report fields.
Saved repositories, history, monitoring, persistent replacement hosting and repository writes remain
separate milestones.

## Rollout and verification

Keep connection configuration absent in production while implementing. Migrate with the Worker
owner, validate RLS using a non-owner login and grant only connection-table SELECT/INSERT/DELETE to
the request-bound API. Deploy owner-aware readers/Worker before enabling connected submissions.
Register and review exact callback, permissions, credential destinations and key custody separately.
An old owner-credential API is never a safe rollback after connected data exists; preserve restricted
RLS-protected readers and disable new connections before rollback. Unexpired analysis archives and
their keys remain valid and are not rewritten.

Tests use synthetic GitHub responses and owned local PostgreSQL targets. They cover PKCE/state,
expiry, tampering, CSRF, access revocation, cross-user and legacy-reader isolation, durable job
credential binding, finite cleanup, contract/readback and accessible connected/public choices.
Live consent, private-provider acceptance, hosted credential grants and deployment are separate
operator activation evidence.

Primary references checked October 12:
[GitHub App user tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
and [minimum permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).
