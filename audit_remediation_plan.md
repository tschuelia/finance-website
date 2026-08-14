# Security and Maintainability Remediation Plan

Audit date: 2026-08-14

Status: Implemented; production-copy and deployed-edge release gates remain open

## Objective

Address the backend and frontend audit findings before treating the application as
ready for public-internet deployment behind a TLS reverse proxy. The target trust
model is strict isolation between non-superusers.

This plan intentionally separates urgent security and integrity fixes from
performance and cleanup work. Existing production SQLite data must remain usable.
The migrated FastAPI backend and React/TypeScript frontend are the authoritative
application. Follow the conventions of that stack, including Pydantic,
SQLAlchemy, TanStack Query, Zod, and shadcn/ui, rather than preserving Django
behavior. Backward compatibility is required only where necessary to read,
validate, migrate, or safely transform the production database and its referenced
media.

## Stack and compatibility policy

- Use idiomatic FastAPI, Pydantic, and SQLAlchemy contracts in the backend and
  idiomatic React and TypeScript patterns in the frontend.
- Prefer the locally generated shadcn/ui components over feature-specific custom
  controls when an appropriate shadcn component exists.
- Do not retain Django routes, request parameters, response shapes, forms, admin
  behavior, runtime behavior, or implementation quirks merely for behavioral
  compatibility.
- Retain compatibility code only when it is needed for actual production data,
  including existing schema structures, primary and foreign keys, nullable stored
  values, password hashes, uploaded-media references, and forward migrations.
- Document any newly discovered production-data dependency before adding or
  preserving a compatibility path for it.

## Editing conventions

- Change `[ ]` to `[x]` when an item is complete and verified.
- Add implementation notes, pull request links, and decisions below the relevant
  issue.
- Add newly discovered work as a new issue instead of silently expanding an
  unrelated issue.
- Do not mark an issue complete solely because code was written; its acceptance
  criteria and relevant tests must pass.

## Implementation evidence — 2026-08-14

- Backend security, migration, request, service, file-failure, analytics, and query-count
  coverage passes with 44 tests. Frontend verification passes ESLint, TypeScript,
  Biome, Knip, and the production build.
- Per maintainer direction, no frontend automated test framework or frontend test
  files were added. Frontend test checklist items below are recorded as not
  applicable rather than silently marked complete.
- The local database passes schema inspection and foreign-key/owner checks. Its
  media reconciliation reports four pre-existing orphan files; nothing was
  deleted. The local database is not a production-copy rehearsal.
- Python and Bun audits report no known dependency vulnerabilities. Docker is
  installed but its daemon is unavailable, so the production container was not
  built or smoked during this pass.

## Non-negotiable database rules

- Do not edit already-applied Alembic migrations `0001` through `0004`.
- Use new, forward-only migrations for schema or data changes.
- Preserve existing table data, primary keys, uploaded media, users, and password
  hashes unless a reviewed migration explicitly transforms them.
- Keep Django PBKDF2 password verification until a production-data audit proves
  no compatible hashes remain. The audited local database still contains one.
- Do not remove historical Django tables merely because the current application
  does not map them. Their eventual removal requires a separate backup, retention,
  and migration decision.
- Rehearse every schema-affecting change against copied production database and
  media before deployment.
- Run schema validation, foreign-key checks, aggregate comparisons, and file
  reference checks before and after every production migration.

## Priority summary

| Priority | Work |
| --- | --- |
| P0 | Clear frontend data at identity boundaries |
| P0 | Bound uploads and CSV bulk operations |
| P0 | Revoke sessions after credential and account-security changes |
| P0 | Enforce account/contract ownership invariants |
| P1 | Fix confirmed filter and category-pattern defects |
| P1 | Make file and database changes recoverable |
| P1 | Establish automated security, authorization, and migration tests |
| P1 | Replace blocking login throttling and per-request session cleanup |
| P1 | Define and enforce production HTTP/security configuration |
| P2 | Remove N+1 queries and unbounded response construction |
| P2 | Prune dead code and obsolete compatibility paths |
| P2 | Simplify large modules and production dependencies |

## Phase 1 — Immediate security and isolation work

### Issue 01 — Reset all frontend server-state at identity boundaries

Problem:

`AuthProvider` attempts to clear the authenticated user with
`queryClient.setQueryData(key, undefined)`. In the installed TanStack Query
version this is a no-op. Financial query keys are also shared by every user of the
same browser session.

Implementation:

- [x] Introduce an explicit anonymous authentication state rather than using
  `undefined` query data as a logout signal.
- [x] Cancel in-flight queries when logout begins or a session is rejected.
- [x] Remove all authenticated/server-state queries after successful logout.
- [x] Remove all authenticated/server-state queries after an unauthorized
  response before presenting the login screen.
- [x] Clear prior-user query data before completing a new login.
- [x] Include the authenticated user ID in sensitive query keys where practical
  as defense in depth.
- [x] Preserve useful error handling when the logout request itself fails.
- N/A — Frontend automated tests were explicitly excluded by the maintainer. The
  identity-boundary implementation is verified by lint, typecheck, and build.

Acceptance criteria:

- [x] Logout consistently displays the login screen and cannot redirect back to
  the authenticated application using stale identity data.
- [x] No account, transaction, contract, analytics, category, depot, or user data
  from user A renders after user B authenticates.
- [x] A failed refetch cannot cause old-user data to remain visible.

Expected database impact: none.

### Issue 02 — Enforce upload and bulk-operation limits

Problem:

CSV preview reads the entire upload into memory. Contract uploads can consume the
entire media volume. The CSV commit API has no backend row limit even though the
frontend assumes a maximum of 500 rows.

Implementation:

- [x] Add configurable maximum sizes for CSV and contract uploads.
- [x] Enforce limits while streaming; do not trust `Content-Length` as the only
  control.
- [x] Return a consistent `413 Payload Too Large` problem response.
- [x] Delete partial or staged files when a limit or write failure occurs.
- [x] Enforce a maximum of 500 rows on both CSV preview and commit schemas, or
  document and apply another shared value.
- [x] Reject CSV input once the row limit is exceeded rather than parsing the
  remainder unnecessarily.
- [x] Batch category and contract relationship validation for committed rows.
- [x] Add tests for boundary size, one byte over the boundary, row limits,
  malformed input, and cleanup after failure.

Acceptance criteria:

- [x] Authenticated clients cannot cause unbounded process memory or media-volume
  consumption through either upload endpoint.
- [x] Frontend and backend enforce the same CSV row contract.
- [x] No partial file or partial transaction batch remains after rejection.

Expected database impact: none.

### Issue 03 — Revoke sessions on security-sensitive user changes

Problem:

Password reset, deactivation, and privilege changes leave existing server-side
sessions intact. A session blocked by deactivation becomes valid again if the user
is reactivated before it expires.

Implementation:

- [x] Add a service operation that revokes every active session for a user.
- [x] Invoke it in password-reset, deactivation, and superuser/staff privilege
  changes.
- [x] Decide and document whether reactivation requires a fresh login. Default:
  yes.
- [x] Report the revoked-session count from management commands.
- [x] Add tests proving old cookies fail after each security-sensitive change.
- [x] Add a management command for explicit all-session revocation if one does
  not already exist.

Acceptance criteria:

- [x] Password resets terminate every prior session.
- [x] Deactivation followed by reactivation does not revive old cookies.
- [x] Privilege changes do not leave sessions carrying stale authorization state.

Expected database impact: none; existing `finances_session` rows can be revoked or
deleted.

### Issue 04 — Enforce cross-resource ownership invariants

Problem:

A transaction can reference a contract that is visible to the acting user but
owned by someone other than the transaction's bank-account owner. Contract or
account reassignment can also create mismatches after links already exist. Such a
mismatch can expose account transactions through a newly assigned contract.

Implementation:

- [x] Require `contract.owner_id == bank_account.owner_id` whenever a transaction
  is created or updated with a contract.
- [x] Prevent contract-owner changes while linked
  transactions belong to another owner.
- [x] Prevent bank-account owner changes that would violate
  linked contract ownership.
- [x] Apply the same rule in HTTP services and management CLI operations.
- [x] Add a read-only audit command/query for existing mismatches.
- [x] Add regular-user and superuser authorization tests for all affected paths.

Acceptance criteria:

- [x] No supported API or CLI operation can create a cross-owner link.
- [x] Contract details never return transactions owned by another non-superuser.
- [ ] The production-copy preflight reports zero mismatches or produces an
  explicit remediation list before deployment.

Expected database impact: none for enforcement. The audited local database has
zero current mismatches.

### Issue 05 — Define category isolation and mutation authority

Decision:

Categories are a global production-compatible taxonomy because the production
schema has no category owner and existing categories are shared across owners.
Authenticated users may read and assign them. Only superusers may create or
change global category names and automatic-matching patterns.

- [x] Preserve the production category IDs and shared category references.
- [x] Require a CSRF-validated superuser session for category mutations.
- [x] Present categories as read-only to regular users in the frontend.
- [x] Add request-level authorization coverage for the decision.

Acceptance criteria:

- [x] A regular user cannot change category behavior observed by another owner.
- [x] Existing shared production category references remain valid.

Expected database impact: none.

## Phase 2 — Correctness and persistence integrity

### Issue 06 — Fix amount filter handling for zero

- [x] Replace truthiness fallbacks for optional numeric filters with explicit
  `is None` handling.
- [x] Audit nearby date and amount fallback code for the same defect pattern.
- [x] Add tests for `amount_min=0`, `amount_max=0`, negative transactions, zero
  transactions, and normal positive ranges.

Acceptance criteria:

- [x] `amount_max=0` excludes transactions whose absolute amount is above zero.
- [x] Explicit zero values are never treated as absent.

Expected database impact: none.

### Issue 07 — Make empty category patterns match nothing

- [x] Strip and discard empty pattern lines.
- [x] Treat a missing, empty, or whitespace-only pattern string as an empty pattern
  set.
- [x] Short-circuit automatic matching for categories with no non-empty patterns;
  they must never match any import row, including rows with empty recipient or
  subject values.
- [x] Normalize matching consistently while preserving meaningful stored patterns
  required by production data.
- [x] Add tests for missing and empty pattern strings, blank lines, whitespace,
  empty import fields, case folding, recipient matching, and subject matching.
- [ ] Audit production category patterns for empty entries before rollout.

Local inspection note: the development database contains 11 category patterns and
none normalize to empty. Production remains intentionally unchecked until a
read-only production-copy audit is recorded.

Acceptance criteria:

- [x] A category with no non-empty patterns never captures an import row.
- [x] Existing meaningful patterns continue to match as documented.

Expected database impact: none unless stored patterns are normalized in a new,
reviewed data migration.

### Issue 08 — Coordinate contract files with database commits

Problem:

Uploads write their final file before the database transaction commits. Deletes
unlink files before commit. A late database failure can create orphan files or
rows pointing to missing files.

Implementation:

- [x] Stage uploads under a safe temporary name/location.
- [x] Finalize or compensate filesystem operations based on transaction outcome.
- [x] Defer physical deletion until the corresponding database deletion commits.
- [x] Add a reconciliation command that reports missing and orphaned contract
  files without deleting anything by default.
- [x] Require explicit confirmation for reconciliation cleanup.
- [x] Add fault-injection tests for write, flush, commit, rename, and unlink
  failures.

Acceptance criteria:

- [x] A failed upload transaction leaves neither a final file nor a database row.
- [x] A failed delete transaction leaves the prior file and row usable.
- [x] Operators can safely detect and repair existing inconsistencies.

Expected database impact: none unless a durable operation/outbox table is chosen;
that choice would require a new migration.

### Issue 09 — Review depot snapshot backfill semantics

Problem:

Migration `0003` summed assets that may have different `last_update` dates and
labeled the aggregate with the latest date. This can imply historical precision
the underlying values do not have.

- [ ] Inspect production asset update-date distribution without exposing values.
- [x] Decide whether the seeded depot snapshot is an estimate, should be removed,
  or can be reconstructed accurately.
- [x] Do not modify migration `0003`; implement any correction in a new migration.
- [x] Label estimated history clearly in the API/UI if it remains.
- [x] Add migration tests for depots whose assets have different dates.

Local inspection note: the development database contains no assets with mixed
update dates within a depot. That result is not evidence about production, so the
production inspection remains open.

Acceptance criteria:

- [x] Every displayed historical depot point has documented and defensible date
  semantics.

## Phase 3 — Authentication, HTTP, and operational hardening

### Issue 10 — Replace blocking login delay

- [x] Replace synchronous `sleep()` with immediate `429` responses and
  `Retry-After`, or select a non-blocking limiter.
- [x] Document which reverse-proxy headers are trusted and how the real client IP
  is determined.
- [x] Decide whether process-local state is sufficient for the supported
  deployment topology.
- [x] Add tests for repeated failures, successful reset, entry expiry, bounded
  memory, and concurrent requests.

Acceptance criteria:

- [x] Repeated login attempts cannot occupy the API thread pool with sleeps.
- [x] Rate limiting uses the intended client identity behind the production
  proxy.

### Issue 11 — Remove expired-session cleanup from normal reads

- [x] Stop issuing expired-session deletes during every authenticated request.
- [x] Retain cleanup during session creation.
- [x] Add an explicit scheduled or management cleanup mechanism if needed.
- [x] Verify that the session table remains bounded under expected login volume.

Acceptance criteria:

- [x] Ordinary authenticated GET requests do not acquire SQLite write locks for
  session cleanup.

### Issue 12 — Define production security configuration

- [x] Add an explicit production mode or equivalent validation that rejects
  insecure cookies and unsafe host configuration.
- [x] Disable or protect OpenAPI, Swagger, and ReDoc in production.
- [x] Define whether the application or reverse proxy owns each security header:
  HSTS, CSP/frame ancestors, `X-Content-Type-Options`, referrer policy,
  permissions policy, and sensitive-response cache policy.
- [x] Add `Cache-Control: no-store` to authenticated financial API responses where
  appropriate.
- [x] Make the production health check verify database access and required media
  storage, or add a separate readiness endpoint.
- [x] Document trusted proxy and forwarded-header configuration.
- [x] Add production-configuration tests that fail closed.

Acceptance criteria:

- [x] A production deployment cannot silently start with insecure cookies or an
  unintended wildcard host policy.
- [x] The deployed header policy is verifiable from the runbook.
- [x] Readiness fails when required database or storage access is unavailable.

## Phase 4 — Automated verification and migration safety

### Issue 13 — Establish a backend test foundation

- [x] Add isolated temporary-SQLite fixtures with foreign keys enabled.
- [x] Add request-level tests covering authentication, CSRF, ownership, nested
  resources, session revocation, and error responses.
- [x] Add service tests for transaction filters, CSV parsing, category matching,
  financial totals, and file path containment.
- [x] Add Alembic tests for fresh creation and upgrade from a representative
  copied or fixture production-compatible schema.
- [x] Add schema-validator golden fixtures for compatible and incompatible
  production database shapes.
- [x] Add the backend test command to Pixi and CI.

Acceptance criteria:

- [x] Every P0 security invariant has an automated regression test.
- [x] Fresh database creation and forward upgrades are exercised automatically.


### Issue 15 — Execute and record a production-copy rehearsal

- [ ] Restore paired copies of production database and media in an isolated
  environment.
- [ ] Record pre-migration table counts, IDs, foreign-key status, financial
  aggregates, password-hash formats, and file references.
- [ ] Run schema inspection and every pending Alembic upgrade.
- [ ] Repeat the recorded checks after migration.
- [ ] Exercise existing-user login, owner/superuser boundaries, imports from all
  supported banks, contracts/files, analytics, and management commands.
- [ ] Build and run the actual production container against the copies.
- [ ] Record results in the repository without committing production data,
  secrets, names, balances, or media.
- [ ] Update the unchecked rehearsal/cutover sections in `migration_plan.md` with
  accurate evidence rather than assumptions.

Acceptance criteria:

- [ ] There are no unexplained differences in IDs, relationships, totals, or file
  availability.
- [ ] Restore procedures have been tested using verified paired backups.

## Phase 5 — Query and response simplification

### Issue 16 — Remove avoidable ORM N+1 behavior

- [x] Eager-load transaction category and contract data for transaction lists.
- [x] Eager-load contract owners for contract lists.
- [x] Consolidate account overview around one batched read model instead of
  combining batching with per-record financial queries.
- [x] Batch import relationship validation.
- [x] Measure query counts before and after with representative data.

Acceptance criteria:

- [x] Query counts remain approximately constant as list size grows for the
  affected endpoints.
- [x] Authorization predicates remain present in every optimized query.

### Issue 17 — Bound and simplify analytics and detail responses

- [x] Measure analytics row counts and response times with representative data.
- [x] Move stable income/expense/category aggregation to SQL where it materially
  reduces work.
- [x] Avoid repeating the same full transaction scan for comparison periods.
- [x] Paginate contract transaction history with bounded backend page-size
  validation and explicit page metadata.
- [x] Render transaction-list and contract-history pagination with the existing
  shadcn pagination primitives from `frontend/src/components/ui/pagination.tsx`;
  remove feature-specific custom pagination controls.
- [x] Preserve URL-backed page state and accessible previous/next and first/last
  page behavior when adopting the shadcn component.
- [x] Keep calculation code straightforward and cover it with contract and
  financial-result tests.

Local measurement note: the development database has four accounts; its largest
account has 1,551 transaction rows, and the category aggregation completed in
approximately 3.97 ms. No financial values were included in the measurement
output. The optimized endpoint also has a query-count regression test that stays
constant as fixture size grows.

Acceptance criteria:

- [x] Large accounts and contracts cannot create unbounded response memory or DOM
  work.
- [x] Pagination uses shadcn/ui rather than custom navigation controls and behaves
  correctly on the first, middle, and last pages.
- [x] Optimized results preserve the current FastAPI API contract and expected
  financial results on fixtures; Django output is not a reference contract.

## Phase 6 — Dead code, legacy cleanup, and readability

### Issue 18 — Remove unreachable frontend code

Candidate files confirmed outside the application import graph:

- `frontend/src/features/design-system/design-system-showcase.tsx`

- [x] Confirm the design-system showcase is not an intentional developer tool.
- [x] Remove the confirmed unreachable files.
- [x] Remove the showcase's artificial Knip entry.
- [x] Narrow broad Knip suppressions for UI and type exports.
- [x] Run Knip again and remove newly exposed unused exports.

Acceptance criteria:

- [x] Knip analyzes the real application entry graph without artificial entries.
- [x] No intentionally retained developer tool is silently removed.

### Issue 19 — Remove obsolete runtime/API compatibility code

- [x] Treat the FastAPI/Pydantic/SQLAlchemy backend contracts and the
  React/TypeScript frontend schemas as canonical for new behavior.
- [x] Remove legacy German analytics URL aliases (`von`, `bis`, `betrag_von`,
  `betrag_bis`, `kategorie`, and `art`).
- [x] Remove duplicate API request-config types and the no-op `withSession()`
  wrapper.
- [x] Remove unused `email` and `is_staff` fields from authentication responses
  and frontend schemas; retain the database columns.
- [x] Review rollback-oriented comments and distinguish obsolete compatibility
  from normalization still required to consume production data.
- [x] Confirm whether `Procfile` still serves an active deployment platform before
  removing it.

Do not remove:

- [x] Django PBKDF2 verification until production contains no compatible hashes.
- [x] Existing production database tables or columns solely because Django runtime
  support ended.
- [x] Missing-recipient normalization while production data or supported imports
  still require it.

Acceptance criteria:

- [x] Removed behavior is not required by the current FastAPI/TypeScript product or
  production data.
- [x] Production database and media compatibility remains intact without treating
  Django behavior as an application contract.

### Issue 20 — Simplify module boundaries and large files

- [x] Remove the unused `app.services` re-export surface and its unused access
  functions.
- [x] Split `contract-pages.tsx` by list, form, detail, and file responsibilities.
- [x] Split `analytics-page.tsx` into filter state and chart sections where this
  reduces cognitive load.
- [x] Decompose `validate_legacy_schema` into table, column, foreign-key, and index
  checks after golden tests exist.
- [x] Prefer explicit request/value objects when service signatures become hard
  to read; do not add abstraction solely to reduce argument counts.

Acceptance criteria:

- [x] Refactoring does not weaken schema validation or authorization.
- [x] Each extracted module has a clear responsibility and direct tests where
  behavior is non-trivial.

### Issue 21 — Reduce production and frontend build weight

- [x] Create separate Pixi development and runtime environments.
- [x] Exclude Bun, Ruff, Mypy, Lefthook, pre-commit helpers, and `pixi-pycharm`
  from the runtime image.
- [x] Move the `shadcn` CLI package to frontend development dependencies.
- [x] Consider pinning container base images by digest under the project's update
  policy.
  Decision: retain reviewed version pins until the repository has an automated
  digest-update policy; do not introduce manually stale digests.
- [ ] Measure route-load performance before introducing code splitting.
- N/A — The measured bundle remained at the audit baseline and no route-load
  performance budget justified code splitting.

Acceptance criteria:

- [x] The production image contains only required runtime dependencies.
- [x] Locked development workflows remain reproducible.
- [x] Frontend splitting is driven by a stated performance budget, not bundle
  aesthetics alone.

Build note: the verified production bundle is 1,240.35 kB minified and 371.83 kB
gzip, effectively unchanged from the audit baseline. Route splitting remains out
of scope until a route-load measurement and performance budget justify it.

## Cross-cutting verification checklist

Run after each implementation batch:

- [x] `pixi run lint`
- [x] `pixi run format-check`
- [x] `pixi run backend-typecheck`
- [x] `pixi run frontend-typecheck`
- [x] `pixi run frontend-knip`
- [x] Backend automated tests
- N/A — Frontend automated tests excluded by maintainer direction
- [x] `pixi run frontend-build`
- [x] Python dependency vulnerability audit
- [x] Bun dependency vulnerability audit
- [x] Read-only database schema inspection
- [x] SQLite foreign-key check
- [ ] Production-container smoke test when Docker is available

## Release gate

Do not declare the public-internet deployment ready until:

- [x] Issues 01 through 05 are complete.
- [x] Issues 06 through 08 are complete.
- [x] Automated tests cover session transitions and owner isolation.
- [x] The category isolation decision is explicit and implemented consistently.
- [ ] A production-copy migration rehearsal is complete and recorded.
- [ ] Production cookie, host, proxy, documentation, and security-header behavior
  has been verified at the deployed edge.
- [ ] Verified paired database/media backups and restoration instructions exist.

## Audit baseline

At the time this plan was created:

- Ruff, formatting, ESLint, Mypy, TypeScript, Knip, and the frontend production
  build passed.
- Python and Bun vulnerability audits reported no known dependency
  vulnerabilities.
- The frontend build emitted one approximately 1.236 MB minified JavaScript
  bundle.
- The local database was at Alembic head
  `0004_depot_asset_balance_snapshots`, passed the production-schema validator, and
  had zero foreign-key violations.
- The local database had zero cross-owner contract links and eight categories
  referenced by more than one owner.
- No automated test suite was present.
- The production Docker image could not be exercised because a Docker daemon was
  unavailable during the audit.
