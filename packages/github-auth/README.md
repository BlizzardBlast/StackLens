# GitHub connections

FR-100, SEC-003/004/005/007, ADR-0023. This server-only package owns GitHub App authorization
with state/PKCE, fixed callback URLs, expiring user access tokens, opaque cookie session hashes,
authenticated token encryption, Origin/CSRF checks and live per-connection token lookup.

`GitHubConnectionService` is used by the API. The Worker uses `connectedGitHubToken` with only
the independent data key and connection store, never the App client secret. Refresh tokens are
discarded. No source, provider body, key or token may enter logs, reports, queue payloads or
analysis backup bundles. Repository grants are checked on submission and every GitHub request.

Configuration is optional and fails closed when partial. Hosted activation remains pending;
see [the runbook](../../docs/implementation/github-connections.md) for permissions, role grants,
reader-first deployment and recovery limitations. Tests use synthetic GitHub responses.
