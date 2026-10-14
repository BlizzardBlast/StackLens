# Recovery rehearsal preflight and execution plan

**Prepared:** October 11, 2026. **Status:** preflight complete; live execution is gated.
**Traceability:** FR-003/004/017/021/022, NFR-008/009, SEC-001/002/003/007,
GOV-002/006/007; ADR-0019 and ADR-0021.

This plan uses the existing hosting accounts. It introduces no schedule or hosting account.
The [dated evidence](release-evidence/2026-10-11-recovery-rehearsal-preflight.json) records
read-only observations against published main `e552076`. Resolve current main and repeat the
applicable checks immediately before execution; these observations are not continuing availability.

## Decision and current limits

The existing Vercel API, Silly Worker and Aiven source remain available for ordinary preview work.
The signed-in Neon account has **no projects**. Wispbyte is offline and its earlier probe does not
establish suitable graceful shutdown, unattended restart or database delivery. There is no verified
independent persistent Worker in this inventory. Do not turn an advertised plan into a provisioned
recovery target or retry a search for hosting candidates under this plan.

The [October 4 independent database rehearsal](release-evidence/2026-10-04-independent-recovery.json)
already restored into a temporary Neon database through the original Vercel API and Silly Worker,
completed normal-provider work and rolled back. Repeating that exercise would test current builds
and configuration, but would not close the remaining persistent compute-loss gate. Its Neon project
was removed; its old endpoint and credentials are not current destinations.

Do not create a new database solely to repeat that completed proof. A bounded database exercise is
an optional operator validation if there is a concrete reason to repeat it. Lasting public replacement
remains gated on a suitable separately provisioned Worker, exact API/database destinations and an
agreed operating budget. Product development can proceed independently of this operational gate;
FR-100 GitHub sign-in/private repositories remains the next product milestone, followed by FR-101
saved repositories and FR-102 history. This plan does not implement those requirements.

## Observed inventory

| Resource | October 11 observation | Meaning for execution |
| --- | --- | --- |
| Aiven `stacklens-preview-pg` in `stacklens-preview` | One Running Free-1-1gb service; PostgreSQL 18 with verified TLS; 1 CPU/1 GB RAM/1 GB storage, DigitalOcean Bangalore | Existing source; no independent managed restore target was provisioned |
| Vercel `stacklens-api` | Production Ready on `main e552076`; direct and compatibility OpenAPI return HTTP 200 / OpenAPI 3.1.0 | Existing API; a dashboard Ready state alone does not prove fresh job delivery |
| Vercel `stacklens` | Production Ready on `main e552076`; web and proxied OpenAPI return HTTP 200 | Existing client/proxy; keep the current API destination until an approved switch |
| Silly `stacklens-worker-preview`, server `60761d98` | Running; sampled 132.11 MiB / 256 MiB, disk 65.07 MiB / 512 MiB | Original Worker; resource sample is not capacity or graceful-exit acceptance |
| Neon existing account | No projects after sign-in | No target endpoint or current owner configuration exists |
| Wispbyte `stacklens-worker-recovery`, server `04101f5c` | Offline; Free plan; earlier lifecycle and unattended-start limitations remain | Unsuitable as an accepted replacement; no credential transfer or startup performed |
| Protected `preview-recovery` workflow | Active, main-only environment branch policy, one required reviewer | Existing manual capture/recovery custody; do not remove or bypass protection |

At 21:22 WIB the source read-only transaction observes zero retained reports, in-flight analyses,
queue jobs, locked jobs and pending delivery rows. No analysis is submitted during this preflight.
This is an online observation: original compute is **not fenced**, and no drained portable snapshot
is captured. Zero owner/API connections in that observation is not proof of Worker exit.

The checked rollback files are `worker-shutdown.tar.gz` (PR #48 lifecycle artifact) and
`worker-capacity-pr46.tar.gz` (PR #46 fallback). Their byte hashes are recorded in dated evidence.
File presence and hashes do not establish the currently loaded Worker revision; verify deployed
modules and the launch configuration before a live switch. The protected portable recovery key
exists outside Git and has the expected length; no key bytes were read into public evidence.

## Target allocation gate

If a bounded database exercise is explicitly selected, the concrete allocation proposal is one
Free PostgreSQL 18 project in the existing Neon account, AWS Singapore (`aws-ap-southeast-1`).
Keep Object storage, Functions, AI gateway and Neon Auth disabled; add no payment method, upgrade
or extra account. Inspection of the unsubmitted form confirms PostgreSQL 18 and Singapore are
offered; the form advertises 1 GB storage, scaling to zero and up to 2 CU. The form is closed without
creating a project.

Current [primary Neon plan documentation](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md)
reports 100 CU-hours per project/month and five-minute idle suspension, but lists 0.5 GB storage,
which differs from the signed-in form. Confirm the allocated project's actual allowance, usage and
limits before using it; do not resolve the discrepancy by assuming the larger allowance. A running
Worker may consume compute between idle periods. Measure actual usage instead of assuming that
scale-to-zero guarantees a continuously available free standby. Even continuous 0.25 CU for thirty
days would consume 180 CU-hours.

For an optional exercise, propose at most two hours of replacement compute, with a four-CU-hour
ceiling at the advertised 2 CU maximum. Agree the rollback deadline and confirm remaining allowance
before activation. These are proposed exercise limits, not a new product policy or an availability
guarantee. No quota or budget is established while the project does not exist.

After allocation, record the exact direct endpoint binding, PostgreSQL 18, verified CA/TLS, owner
authority, account/region and zero-cost limits privately. The staging helper accepts a separately
approved direct Neon hostname, not a stale endpoint, pooled URL or arbitrary hosted Aiven target.
Approval for allocation is separate from approval to transmit credentials, restore data or change
live routing. Do not request approval for an unknown endpoint-specific cutover.

## Execution sequence after destination and scope approval

1. **Preserve rollback.** Resolve current main and trusted API/Worker artifacts. Verify live Worker
   module hashes and launch settings. Preserve the original API and Worker URL/CA pairs, restricted
   API login flags, production aliases, web proxy destination and private configuration inventory.
   Specify whether this is a temporary database exercise using original compute or an independent
   public replacement. Record exact destinations, role scope, custody and rollback deadline before
   any live credential/routing change.
2. **Establish populated coverage if needed.** The source currently has no retained reports. Before
   fencing, complete one ordinary bounded public repository analysis through the existing API and
   Worker if populated recovery is an acceptance goal. Keep identifiers and raw reports private;
   retain strict-reader/report hashes and actual provider limitations. Do not invent reports or
   promote zero-report readback into populated acceptance.
3. **Fence and drain.** Block new source submissions across Production and Preview API deployments,
   using the approved reversible restricted-login mechanism. Preserve the original login state.
   Allow existing work to finish, stop the original Worker normally, and verify executor exit,
   cleanup stages and zero in-flight/queue/outbox work. Pausing only Production does not fence
   Preview deployments. Use a new exercise-specific fencing receipt; never overwrite or reuse the
   October 6 receipt as current proof. Preserve the approved operator capture and restricted offsite
   reader access. Do not unlock claims or force-delete queue work to manufacture a drained source.
4. **Capture a fresh portable bundle.** Use the existing main-only protected `preview-recovery`
   workflow with `operation=capture` only after actual fencing/drain confirmation. Require successful
   before/after drained receipts and retain `database.slbackup` plus `recovery.slmetadata`, the
   capture run identity, archive digest and authenticated deadline. The existing online offsite
   backup has a different scope and copied-work quarantine; it is not a promotable drained portable
   bundle. Do not shorten or extend restore eligibility.
5. **Stage in quarantine.** Authenticate the portable bundle and separate key before target I/O.
   Run `persistent-recovery.mjs stage-neon` against the exact approved direct endpoint and a new
   UUID-owned database, with new private output/evidence paths. Require seven canonical fingerprint
   matches, strict historical/retained report coverage, natural terminal-expiry cleanup and zero
   copied in-flight/jobs/outbox rows. Recheck eligibility before output publication. Start no
   compute and contact no original database from the staging operation.
6. **Activate only the approved pair.** Create an ADR-0019 restricted request-bound API role;
   keep owner/Graphile credentials with the Worker/operator. Transmit each paired URL/CA only to
   its named approved destination. Purge naturally expired records again before exposure, then
   start normal provider adapters. Verify HTTPS, strict retained report hashes, expiry/no-store
   behavior and one fresh durable public repository submission, including Worker completion and
   direct/proxied readback. If the original API/Worker are reused, label the evidence as database
   recovery only. Full replacement needs an independent accepted Worker and API destination.
7. **Rollback with both sides fenced.** Stop new replacement submissions, drain work and verify
   replacement executor exit. Restore the original paired URL/CA, login flags, aliases/proxy and
   trusted Worker launch. Confirm one fresh original normal-provider analysis and unchanged
   historical report hashes, with an empty final queue/outbox. Do not silently abandon work accepted
   during the replacement window; define its retention/reconciliation before activation.
8. **Complete owned cleanup.** Stop replacement compute; remove only exercise-created credentials,
   the identified owned database and, if separately approved, the disposable project. Confirm owned
   absence and preserve source settings, existing archives, referenced keys and unrelated resources.
   Permanent provider deletion requires action-time confirmation. Record cleanup failures as
   failures and retain the minimum private ownership information needed to finish cleanup.

## Abort and evidence requirements

Abort before activation if the destination, budget, TLS, source fencing, artifact eligibility,
fingerprints, retained-reader coverage or rollback material cannot be verified. During the exercise,
fence new submissions and initiate the agreed rollback on failed normal delivery, unexpected
original-source contact, conflicting ownership, connection saturation or exhausted limits. Keep
both compute sides fenced until it is safe to resume the selected side. An offline panel badge
alone does not establish graceful cleanup, and an expired bundle never authorizes promotion.

Public evidence contains timestamps, trusted source/artifact hashes, counts, explicit archived /
retained / API report coverage, source-fencing facts, normal-provider limitations, quarantine,
delivery/rollback results and owned cleanup. It contains no credentials, endpoint connection
strings, keys, dumps, raw reports, provider logs or analysis identifiers. Preserve the earlier
populated/PC-off offsite acceptance record separately from this preflight and any later empty
coverage. No public cutover or persistent replacement is accepted by this planning milestone.

Documentation-impact review updates this plan, the persistent staging runbook, README and current
handover, and appends the journey. Requirements, architecture, source-role policy, analyzer/scoring,
report schema, UI and tokens remain unchanged. Validation covers formatting, local links, evidence
consistency and privacy boundaries; runtime behavior is unchanged and no live rehearsal was run.
