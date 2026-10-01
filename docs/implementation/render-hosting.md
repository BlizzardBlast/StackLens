# Render Free API preview

> **Status:** Actual Free deployment blocked by card verification; no service created\
> **Updated:** 2026-10-02\
> **Requirements:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-003/007, GOV-002/006/007\
> **Decision:** [ADR-0015](../adr/0015-vercel-static-web-target.md)

## Prepared service

[`deploy/render/render.yaml`](../../deploy/render/render.yaml) defines one Docker API web service:
`stacklens-api-preview`, Singapore, explicit Free plan, one instance, repository-root build context,
`./Dockerfile`, startup health path `/openapi.json`, and automatic deployment disabled. The dashboard
shows $0/month, 0.1 CPU and 512 MB RAM. The user completed Render GitHub sign-in; the public Git
repository source avoids installing a GitHub application with repository access.

After explicit approval, the reviewed branch was published at `7ce34f0` in
[PR #41](https://github.com/BlizzardBlast/StackLens/pull/41), and CI passed. The actual form selected
that branch, Docker, Singapore, Free/$0, the health path, seven non-secret variables and automatic
deployment Off. The two approved Aiven values were entered privately. Clicking Deploy opened an
`Add Card` dialog describing a temporary $1 verification authorization. No card was entered.
Canceling and explicitly reselecting Free did not produce a service. A fresh October 2 dashboard
confirmed no services; the restored setup form was blank. No API origin or runtime resource exists.
Do not retry card verification under the user's no-card constraint. The blueprint still passes the
published Draft 2020-12 JSON Schema; configuration validity does not establish deployment eligibility.

The API remains the existing compiled Fastify process. Render receives no Worker or PostgreSQL
resource. The independently running Silly Worker and Aiven database remain the
[managed preview backend](managed-hosting.md). Database state survives API sleep and replacement.

## Runtime and secrets

Set `NODE_ENV=production`, `STACKLENS_RUNTIME=api`, `STACKLENS_API_HOST=0.0.0.0`,
`STACKLENS_API_PORT=3000`, `PORT=3000`, `STACKLENS_DATABASE_POOL_MAX=3` and
`STACKLENS_RETENTION_HOURS=24`. `STACKLENS_RUNTIME` selects the API Docker stage; omitting it
selects the Worker instead. Keep Docker Command and Pre-Deploy Command empty: the existing
entrypoint owns migrations, listening and orderly shutdown.

`DATABASE_URL` and `STACKLENS_DATABASE_SSL_CA` use `sync: false` placeholders. After approval to
transfer credentials to this new provider, supply the shared Aiven URL without SSL query parameters
and its actual multiline CA PEM through private environment values. The persistence pool verifies
the certificate and hostname. Never disable certificate validation or expose these values to the static web project.
The API does not need `STACKLENS_GITHUB_TOKEN`; that public-provider credential stays on the Worker.

[Render Docker documentation](https://render.com/docs/docker) explains that service environment
values can supply declared build arguments. The Dockerfile declares only the non-secret runtime
selector; do not add database or provider secret build arguments. `.dockerignore` excludes local
environment files and cache directories. Avoid secret files in the build context.

## Free-plan limits

[Render Free documentation](https://render.com/docs/free) describes managed HTTPS, 15-minute idle
sleep, approximately one-minute wake-up, and 750 shared instance hours per workspace each month.
Without a payment method, exhausted bandwidth suspends services and exhausted build minutes block
new builds. Unusually high outbound traffic can also cause suspension. Free is a preview target;
continuous availability is not established. Keep the no-card constraint and stop if the actual
activation flow requires payment verification. Do not add artificial keep-alive traffic.

The independent Worker can continue queued jobs while the API sleeps. Cold-start submission,
polling and Vercel proxy behavior still require live acceptance; successful local builds do not
prove that waiting clients receive usable responses.

## Activation and evidence

The following sequence is conditional on a future eligible no-card Render account. The current
account's activation is blocked; use the [Vercel API target](vercel-api-hosting.md) instead.

1. Authorization to publish the reviewed release branch and transfer Aiven credentials to Render
   was given and used. PR #41 is published; recheck its reviewed HEAD before any future deployment.
2. Select the reviewed branch, verify Free/$0 and automatic deployment Off, and enter the two
   backend secrets privately. Keep the root Dockerfile and build context; stop at any card prompt.
3. Deploy and record the revision, service identifier, assigned HTTPS origin, verified database
   connectivity and `/openapi.json`. Confirm the selected image is the API rather than the Worker.
4. Submit KerjaLog and frey-ui through the public API. Preserve immutable commits, schema validation,
   limitations and provider failures. Verify cold wake-up separately after genuine idle sleep.
5. Configure Vercel Preview with the public API origin and follow the
   [same-origin acceptance sequence](vercel-hosting.md#preview-acceptance-sequence).
6. Complete active-job recovery, remote expiry/restore and real screen-reader/device validation
   before a release claim. Keep the public-only GitHub token's 2026-10-31 expiry visible to operators.

The [managed hosting evidence](release-evidence/2026-10-01-managed-hosting.json) separates the
authenticated remote Worker runs from this prepared form. The
[Blueprint reference](https://render.com/docs/blueprint-spec) and
[published schema](https://render.com/schema/render.yaml.json) are configuration sources.
