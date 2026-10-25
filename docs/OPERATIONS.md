# Release and rollback runbook

## Before activation

1. Confirm the exact source inventory, ownership and distribution permission for each course. An existing product PDF is not automatically a free gift. Keep original Drive files unchanged. The TypeScript collection remains pending until this decision is recorded privately.
2. Verify the target Cloudflare account, plan, R2/Worker/rate-limit eligibility, limits and budgets. Confirm the CI account/repository billing state. No paid plan changes, paid CI runners, extra grants, or remote workload is authorized by this runbook.
3. Choose a stable HTTPS hostname. Replace `APP_ORIGIN` and the R2 bucket placeholder in `wrangler.jsonc`. Keep `APP_MODE=production`; do not publish the localhost configuration. Select account-unique rate-limit namespace IDs to avoid counters shared with another Worker.
4. Through a separately approved secure setup, create the private bucket/binding and a minimally scoped deployment credential. Keep R2 managed public access and custom public bucket domains disabled. No CORS or presigned download URLs are required. Keep the public application hostname on the Worker, not the bucket.
5. Through a separately approved secure step, prepare `ACCESS_PHRASE_SHA256` and `SESSION_SECRET` (at least 32 random bytes encoded as 43+ base64url characters). Use protected secret storage and non-logging secret input; never command-line literal values, terminal output, or Git. Ordinary `wrangler secret put` deploys immediately, so it is not a preparation-only command. Use an explicitly approved version-only secrets upload when the target supports it, or provide the secrets during the first separately approved deployment. See [the initial setup guide](SETUP.md). The access phrase and PDF opening password are separate.
6. Do not reconnect unrelated pending authentication requests or enable Cloudflare Git auto-deployment. Secure credential creation and CI activation need explicit action-time authorization.

## Prepare a material release

1. Copy only confirmed distribution sources into an ignored private working directory outside this repository. Never move, modify or delete Drive originals.
2. Make PDF **distribution copies** with AES-256 open-password encryption in an approved secure step. Use a separate owner password, preserve useful print/copy permissions, and protect password input from process arguments/history/logs. One version may share a PDF opening password. No encryption command is automated here because real credential entry remains pending.
3. Open every encrypted copy with its expected password and confirm failure with a wrong/missing password. Check useful copy/print and representative Mac PDF readers. Windows/WSL and course source execution need their own verification. Do not infer compatibility from synthetic PDFs.
4. Build the all-books ZIP from the encrypted distribution PDFs and inspect its exact member names. Create code ZIPs from confirmed, secret-scanned source directories. Keep hashes, sizes, source inventory and release evidence in a private operator report, never in the public repository when identifying information is sensitive.
5. Upload to a **new immutable** private prefix such as `releases/taskapp/1.0.0/`. Never overwrite active release objects. Validate every expected object and byte length/checksum against the private release report before updating the manifest. Preserve earlier release prefixes for rollback.
6. Update the appropriate collection version, safe filenames, object prefix and `synthetic` flag in `src/manifest.ts`. Extend the manifest with a separate confirmed collection rather than mixing courses or reusing IDs across a common prefix. Update catalogue descriptions and verification notes truthfully. Public metadata must contain no private inventory identifiers.
7. Run `npm ci` and `npm run check` at the exact candidate commit, then perform staging/private edge checks on direct anonymous GET/HEAD/Range, wrong/expired cookies, missing objects, cache headers, successful downloads and mobile/desktop browser behaviour. No public access grants are needed for R2.

## CI/CD activation (not performed)

The checked-in workflow is `workflow_dispatch` only. It never runs on push or PR. No Actions run has been requested. Before first manual execution, verify the actual plan and free usage limits and review this configuration. It uses `ubuntu-latest`, no self-hosted/larger runners, no artifact storage, and no cache storage. Concurrency is fixed for the library and cancellation is disabled, so verification and deployment from different releases cannot race.

After separate approval, place the scoped API token and account ID in the `production` environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Set environment variable `CLOUDFLARE_SETUP_VERIFIED=true` only after plan/limit, bucket privacy, secrets, hostname, and material verification are complete. The optional deploy job uses the same `github.sha` as verification and refuses a placeholder production configuration. Environment-level approval protection should be configured separately if authorized; this runbook creates no grants or credentials.

## Deploy and verify

1. Select a reviewed commit and the optional deployment input only after the above prerequisites are met. Verification must pass for that same SHA before deployment.
2. Record the Git SHA, content manifest version, Cloudflare Worker version ID and previous Worker version ID in private release evidence. Use the stable entry URL in the newsletter; MyASP configuration remains unchanged.
3. Repeat the anonymous/authenticated/cache-isolation checks through the real HTTPS hostname. Confirm `r2.dev` and public bucket domains remain disabled. A code test cannot establish account-level privacy or billing settings.

## Roll back

1. If credentials or materials leaked, rotate the access phrase and session signing secret through the approved secure flow; rollback alone does not revoke sessions or downloaded files.
2. Revert the manifest/application to the previous known-good reviewed commit through normal review and deploy after same-commit verification, or use the approved Cloudflare Worker version rollback for an urgent application rollback. Match the Worker version to its embedded material manifest.
3. Keep the previous immutable R2 objects available. Validate the stable URL and authentication/download/cache behaviour again. Do not delete releases until the recovery/retention decision is separately approved.

Reference: [Workers R2 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [rate-limit scope and accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [GitHub external CI/CD](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
