# Create MIGRATION_PLAN.md

  ## Summary

  Create a tracked plan at /Users/julia/Developer/finances/finances/
  MIGRATION_PLAN.md. Do not reuse the existing ignored todo.md.

  The migration will be implemented through the ordered issues below. Intermediate
  commits may be incomplete or non-runnable; only the final cutover state must
  work. No automated backend, frontend, or end-to-end tests are included in this
  phase.

  The file cannot be written while Plan Mode prevents repository mutations; the
  following is its complete intended content.

  ———

  # Django to FastAPI and React migration

  ## Working rules

  - Read this plan together with AGENTS.md. This plan defines migration scope and
    issue order; AGENTS.md defines coding and implementation standards.
  - If AGENTS.md does not fit the active task or current coding standards, update
    it in the same change and record important deviations in this plan.
  - Complete issues in the listed order.
  - Use one focused commit per issue where practical.
  - Intermediate revisions may be broken and must not be deployed.
  - Keep the production Django installation untouched until the cutover issue.
  - Preserve the production SQLite database, IDs, users, passwords, and uploaded
    files.

  - Do not commit production data, media, secrets, or database backups.
  - Do not add automated tests yet.
  - Use manual verification, linting, type checking, and builds where relevant.
  - Mark an issue complete by changing [ ] to [x] and recording important
    deviations beneath it.
  - Treat backend request and response schemas as the canonical API contract.
    Mirror contracts consumed by the frontend manually as Zod schemas and update
    both sides in the same task.
  - Do not add OpenAPI-based frontend generation or Hey API during this migration.
  - Use the latest stable, non-prerelease releases available when dependencies are
    added to the new backend, frontend, or shared migration tooling. Commit updated
    lockfiles with every dependency change.
  - When latest releases conflict, use the newest mutually compatible versions and
    record the constraint and reason beneath the active issue.
  - Keep legacy-only Django dependencies frozen during the rollback window unless
    a security issue or migration blocker requires a separately verified upgrade.

  ## Target structure

  backend/
    alembic/
    app/
      api/
      auth/
      cli/
      db/
      schemas/
      services/
      main.py
    pyproject.toml

  frontend/
    src/
      api/
      components/
      features/
      layouts/
      routes/
    components.json
    package.json
    bun.lock

  accounting/       Legacy Django application until cleanup
  finances/         Legacy Django project until cleanup
  MIGRATION_PLAN.md
  Dockerfile
  README.md

  ## Issue 01 — Capture the legacy baseline

- [x] Tag the last known Django revision before migration work.
  - [x] Document local and production startup, migration, backup, and deployment
    commands.

  - [x] Inventory the existing pages and workflows:
      - Login/logout.
      - Account and depot overview.
      - Transaction filtering, pagination, detail, update, delete, and bulk entry.
      - CSV upload and editable preview.
      - Category create, update, and reassignment.
      - Contract create, update, detail, and file management.
      - Depot asset display and update.
      - Dash analytics.
      - Django admin operations that must move to the CLI.

  - [x] Record the expected production schema, including auth_user, accounting_*,
    Django support tables, and the obsolete accounting_contracttransaction table.

  - [x] Record baseline table counts, foreign-key status, financial totals, and
    media references using read-only commands.

  - [x] Document current authorization behavior and the known nested-resource gaps
    that must not be carried into FastAPI.

  - [x] Add backup and restore instructions for db.sqlite3 and media/.

  Done when the current state and recovery procedure are documented without
  changing production data.

  Completed in `docs/legacy-baseline.md`. The annotated local tag
  `django-baseline` resolves to `1299c3747c2e253d3ce60f3923859ac7c02b7fd0`.
  Aggregate values were captured from the approved local read-only snapshot;
  production was not accessed or changed.

  ## Issue 02 — Establish backend and frontend workspaces

  - [x] Create backend/ as an installable Python application.
  - [x] Add FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic Settings, multipart
    upload support, Typer, and password-hashing dependencies.

  - [x] Retain Pixi as the repository-level Python environment manager.
  - [x] Select the current stable Python and Bun versions supported by the new
    dependency sets.
  - [x] Add frontend/ using Vite, React, and TypeScript.
  - [x] Use Bun through Pixi and commit bun.lock.
  - [x] Resolve FastAPI, frontend, and shared tools such as Ruff and Lefthook to
    their latest stable mutually compatible releases; document any older pin.
  - [x] Add repository commands for:
      - FastAPI development.
      - Frontend development.
      - Backend lint and type checking.
      - Frontend lint and TypeScript checking.
      - Frontend production build.
      - Alembic operations.

  - [x] Update .gitignore for generated frontend assets, caches, local databases,
    environment files, and backups.

  - [x] Do not require the legacy Django commands to remain functional during
    every intermediate commit.

  Done when both workspaces exist and their dependency graphs can be installed.

  Completed with Python 3.14 for the new default workspace and a separate frozen
  Python 3.11 legacy environment for rollback checks. Bun is pinned to 1.3.11
  because it is the newest release available for both target platforms through
  conda-forge; upstream Bun 1.3.14 is not available there. TypeScript is pinned
  to 6.0.3 because typescript-eslint 8.67.0 requires TypeScript >=4.8.4,<6.1.0
  and is not yet compatible with the latest TypeScript 7 release. The FastAPI
  development and Alembic commands are present but intentionally become runnable
  when issues 03 and 05 add their respective entrypoints.

  ## Issue 03 — Add configuration and application skeleton

  - [x] Load configuration exclusively from environment variables.
  - [x] Define settings for:
      - SQLite database path.
      - Media root.
      - Session secret.
      - Cookie security.
      - Session lifetime.
      - Allowed hosts.
      - Development logging.

  - [x] Create the FastAPI application factory and /health endpoint.
  - [x] Mount routers below /api/v1.
  - [x] Add consistent handling for validation, authentication, authorization,
    not-found, and conflict errors.

  - [x] Configure structured request logging without logging passwords, cookies,
    uploaded contents, or financial payloads.

  - [x] Add startup checks for required settings, database availability, and
    media-directory accessibility.

  Done when FastAPI starts and /health responds without loading Django.

  Completed with a required 32-character session secret and documented local
  defaults for the remaining `FINANCES_*` environment variables. API failures
  use an RFC 9457-style Problem Details response, and structured access logging
  records only request metadata. SQLite connection configuration and session
  behavior remain assigned to issues 04 and 07 respectively.

  ## Issue 04 — Map the existing SQLite schema

  - [x] Add synchronous SQLAlchemy engine and session management.
  - [x] Enable PRAGMA foreign_keys=ON, WAL mode, and a bounded busy timeout for
    every SQLite connection.

  - [x] Use one database transaction per API request or CLI operation.
  - [x] Map these existing tables without renaming fields or IDs:
      - auth_user
      - accounting_bankaccount
      - accounting_bankdepot
      - accounting_depotasset
      - accounting_depotassettransaction
      - accounting_category
      - accounting_contract
      - accounting_contractfile
      - accounting_transaction

  - [x] Preserve nullable relationships and existing delete behavior.
  - [x] Use Decimal for all monetary operations.
  - [x] Treat the remaining Django tables as unmanaged legacy data.
  - [x] Add a read-only finances db inspect command showing schema compatibility,
    table counts, foreign-key violations, and aggregate balances.

  Done when the new backend can read the existing database and reproduce its basic
  counts and totals.

  Completed with synchronous SQLAlchemy request/CLI transaction scopes and
  Django-compatible ORM mappings. Writable connections enable foreign keys, WAL,
  and a 5-second busy timeout. The read-only inspector enables only the
  connection-local foreign-key and timeout pragmas and reports, but does not
  change, journal mode so inspecting a preserved database remains non-mutating.

  ## Issue 05 — Adopt Alembic without recreating production tables

  - [x] Create an Alembic baseline that can construct a fresh database with the
    compatible domain and user schema.

  - [x] Add finances db bootstrap-existing:
      - Refuse to run if required tables or columns differ.
      - Refuse to run if Alembic is already initialized unexpectedly.
      - Stamp the verified database at the baseline without running table
        creation.

  - [x] Add the first forward migration for server-side sessions.
  - [x] Add finances db status and finances db upgrade.
  - [x] Keep all legacy Django tables during the rollback window.
  - [x] Document fresh-database initialization separately from existing-database
    adoption.

  Done when a blank database can be created and a copy of the Django database can
  be safely stamped and upgraded.

  Completed with a protected legacy baseline and an additive server-session
  revision. Existing adoption validates exact required columns, compatible types,
  constraints, indexes, and foreign-key integrity before stamping. Alembic
  autogeneration is restricted to the nine mapped legacy tables and the new
  session table, leaving every other Django table unmanaged and untouched.

  ## Issue 06 — Port domain services

  - [x] Move balance calculations out of Django models.
  - [x] Port owner/superuser account and depot visibility.
  - [x] Port transaction filtering:
      - Recipient or subject search.
      - Date range.
      - Absolute amount range.
      - Category selection.
      - Income, expense, or all.
      - Reverse chronological ordering.

  - [x] Port transaction summaries and pagination calculations.
  - [x] Port category-pattern matching and reassignment.
  - [x] Port contract balance and first/last transaction calculations.
  - [x] Port depot and asset balance calculations.
  - [x] Keep persistence details out of API route functions.
  - [x] Correct nested-resource authorization so a transaction must belong to the
    account in the route.

  Done when business behavior no longer requires importing Django.

  Completed with SQLAlchemy-backed domain services for resource visibility,
  portfolio and resource balances, transaction filtering and pagination,
  category reassignment, and nested-resource authorization. The legacy database
  left equal-key ordering unspecified; transaction and contract services now use
  explicit ID tie-breakers, with contract boundaries matching the preserved
  snapshot.

  ## Issue 07 — Implement authentication and sessions

  - [x] Preserve existing auth_user rows and flags.
  - [x] Implement Django pbkdf2_sha256 password verification using the iterations
    and salt stored in each hash.

  - [x] Do not rehash passwords during the rollback window.
  - [x] Create opaque random session tokens and store only their hashes.
  - [x] Add session creation, expiry, revocation, and cleanup.
  - [x] Use an HttpOnly, SameSite=Lax cookie and enable Secure in production.
  - [x] Generate a CSRF token for authenticated sessions and require it on
    mutations.

  - [x] Add:
      - POST /api/v1/auth/login
      - POST /api/v1/auth/logout
      - GET /api/v1/auth/me

  - [x] Return 401 for missing/expired sessions and 403 for insufficient
    permissions.

  - [x] Rate-limit or delay repeated failed login attempts within the single-
    process deployment.

  Done when existing credentials can authenticate without Django and sessions can
  be revoked.

  Completed with preserved Django PBKDF2 verification, opaque HMAC-hashed server
  sessions, CSRF-protected mutations, secure cookie controls, expiry/revocation,
  and a bounded in-process failed-login delay. A temporary migrated database and
  real HTTP requests verified login, cookie flags, `/auth/me`, CSRF rejection,
  logout revocation, and expiry without changing the preserved database.

  ## Issue 08 — Replace Django admin with CLI management

  - [x] Create a Typer-based finances command.
  - [x] Add user commands:
      - List users.
      - Create user.
      - Reset password.
      - Activate/deactivate user.
      - Grant/revoke superuser status.

  - [x] Write new and reset passwords in the Django-compatible PBKDF2 format
    during the rollback window.

  - [x] Add account create, update, and list commands.
  - [x] Add depot create, update, and list commands.
  - [x] Add asset create and update commands.
  - [x] Add depot asset transaction create and delete commands.
  - [x] Require explicit owner IDs or usernames.
  - [x] Require confirmation before destructive operations.

  Done when Django admin is no longer required for routine setup.

  Completed with grouped Typer commands for users, accounts, depots, assets, and
  depot asset transactions. Owner selection is explicit, destructive commands
  require confirmation (or an explicit `--yes`), and all password writes remain
  compatible with the frozen Django rollback environment. The complete command
  flow was exercised against a temporary Alembic-created database.

  ## Issue 09 — Implement account and depot APIs

  - [x] Add account overview endpoints with owner grouping for superusers.
  - [x] Return account balance, transaction date range, and summary metadata.
  - [x] Add depot overview endpoints with assets, balances, last-update dates, and
    asset transactions.

  - [x] Add asset update endpoint for balance and last-update date.
  - [x] Serialize decimals as strings and dates as ISO-8601 values.
  - [x] Enforce ownership consistently.

  Done when all current account and depot pages can be supported by JSON APIs.

  Completed with authenticated portfolio, account detail, depot detail, visible
  user, and asset-update endpoints. Pydantic serializes exact decimals as strings
  and dates as ISO values, while every lookup reuses the owner/superuser access
  services.

  ## Issue 10 — Implement transaction APIs

  - [x] Add paginated transaction listing with current filter semantics.
  - [x] Return {items, page, page_size, total}.
  - [x] Include filtered total, paid, received, minimum date, and maximum date.
  - [x] Add transaction detail and update endpoints.
  - [x] Replace the unsafe legacy GET deletion with DELETE.
  - [x] Add bulk transaction creation matching the current formset behavior.
  - [x] Validate that selected accounts and contracts are accessible to the
    current user.

  - [x] Preserve existing behavior for missing recipients and nullable categories/
    contracts.

  - [x] Use conflict responses for stale or invalid relationships.

  Done when all non-CSV transaction workflows are available through FastAPI.

  Completed with server-driven filtering, pagination and summaries; nested detail,
  update and DELETE routes; and atomic bulk creation. Account and contract
  relationships are checked before writes, nullable legacy relationships remain
  readable, and stale selections return conflict responses.

  ## Issue 11 — Port CSV imports

  - [x] Port Comdirect, DKB, Holvi, and N26 parsing.
  - [x] Keep parsing independent of HTTP and SQLAlchemy.
  - [x] Add a multipart CSV preview endpoint.
  - [x] Return editable transaction DTOs without writing them to the database.
  - [x] Add a commit endpoint accepting the edited preview rows.
  - [x] Validate every row before beginning the database transaction.
  - [x] Commit all rows atomically or none of them.
  - [x] Return clear errors for unknown banks, encodings, missing columns, invalid
    dates, and invalid amounts.

  - [x] Preserve current categorization behavior.
  - [x] Do not introduce automatic duplicate rejection unless separately
    requested.

  Done when the browser can reproduce the existing preview-and-confirm import
  workflow.

  Completed with a standard-library parser independent of HTTP and persistence,
  preserving the four legacy bank formats and category matching. Multipart
  preview is read-only; edited rows are fully validated before one atomic commit,
  and duplicate rejection remains intentionally absent.

  ## Issue 12 — Implement category APIs

  - [x] Add category list, create, and update endpoints.
  - [x] Preserve unique names and newline-separated patterns.
  - [x] Add account recategorization as an explicit mutation.
  - [x] Restrict all endpoints to authenticated users.
  - [x] Preserve the current global-category model.
  - [x] Defer category deletion because the current UI does not implement it.

  Done when Django category forms and reassignment are replaceable.

  Completed with authenticated global category CRUD (excluding intentionally
  deferred deletion), conflict handling for unique names, and an explicit
  CSRF-protected account recategorization mutation.

  ## Issue 13 — Implement contract and file APIs

  - [x] Add contract list, detail, create, and update endpoints.
  - [x] Preserve active/inactive grouping and owner restrictions.
  - [x] Include related transactions and calculated totals/date ranges.
  - [x] Add authenticated multipart file upload.
  - [x] Add authenticated file download with ownership verification.
  - [x] Add file deletion where supported by the existing workflow.
  - [x] Sanitize new storage names while retaining the user-facing filename.
  - [x] Prevent absolute paths and .. traversal.
  - [x] Continue resolving existing stored paths under the configured media root.

  Done when contracts and their existing files work without Django media serving.

  Completed with owner-scoped active/inactive lists and contract detail/write
  endpoints, including calculated transaction metadata. Files use authenticated
  upload/download/delete routes, randomized sanitized storage names, retained
  display names, and media-root containment for new and legacy stored paths.

  ## Issue 14 — Implement analytics APIs

  - [x] Replace Dash and pandas-backed callbacks with explicit aggregate
    endpoints.

  - [x] Add category totals for the selected account and filters.
  - [x] Add three independently selectable month/year category comparisons.
  - [x] Add monthly income and expense totals for the requested number of months.
  - [x] Preserve income/expense color meaning and German month labels.
  - [x] Return chart-ready series while leaving presentation details to React.
  - [x] Apply the same account permissions as transaction endpoints.

  Done when no chart calculation depends on Django, Dash, or browser-side access
  to raw unrestricted transactions.

  Completed with explicit SQLAlchemy-backed category, three-period comparison,
  and monthly income/expense endpoints. Responses are chart-ready, retain the
  established colors and German month labels, and reuse transaction filters and
  account authorization without importing Dash or pandas.

  ## Issue 15 — Create the frontend design system

  - [x] Initialize shadcn/ui for Vite and TypeScript.
  - [x] Configure Tailwind CSS, aliases, theme tokens, typography, spacing, and
    chart colors.

  - [x] Add required shadcn components:
      - Button, input, field/form controls, select, combobox, and date picker.
      - Table, card, badge, separator, tabs, and pagination.
      - Dialog, alert dialog, dropdown menu, tooltip, and popover.
      - Sidebar/navigation, sheet, skeleton, spinner, and notifications.
      - Chart components backed by Recharts.

  - [x] Build responsive desktop and mobile layouts.
  - [x] Keep German interface text and Europe/Berlin date formatting.
  - [x] Avoid copying the legacy Bootstrap markup.

  Done when representative forms, tables, dialogs, and charts render in the new
  visual system.

  Completed with Tailwind 4 and the local shadcn Radix/Nova component set,
  including form controls, navigation, feedback, date selection, and Recharts
  chart primitives. `ApplicationLayout` provides responsive sidebar navigation,
  the app-wide Sonner toaster, and German accessibility defaults. The unmounted
  `DesignSystemShowcase` is the representative responsive implementation for
  the Issue 16 application shell to mount alongside routing and authentication;
  no automated tests were added, as required by this migration phase.

  ## Issue 16 — Add the frontend API layer and authentication shell

  - [x] Manually mirror consumed backend request and response schemas as frontend
    Zod schemas and infer TypeScript types from them.
  - [x] Add a small handwritten API client and resource wrappers using same-origin
    cookies and Zod validation for structured responses.
  - [x] Read and send the CSRF token for mutations.
  - [x] Configure TanStack Query and centralized API-error handling.
  - [x] Configure React Router.
  - [x] Build login, logout, protected-route, session-expired, not-found, and
    fatal-error screens.

  - [x] Add the application navigation for accounts, charts, categories, and
    contracts.

  - [x] Redirect unauthenticated users to login and restore their intended route
    after success.

  Done when authenticated navigation and session expiry work end to end.

  Completed with handwritten Zod mirrors and validated Axios resource wrappers,
  same-origin cookie/CSRF handling, a TanStack Query provider and normalized API
  problem errors. React Router now provides German login/logout, protected and
  session-expiry redirects, navigation, fatal-error, and not-found flows. No
  automated tests were added, as required by this migration phase.

  ## Issue 17 — Build account and depot screens

  - [x] Build the account/depot dashboard with user grouping for superusers.
  - [x] Display individual and total balances using exact decimal formatting.
  - [x] Build depot detail with assets and transaction history.
  - [x] Add the asset edit dialog.
  - [x] Include loading, empty, permission-denied, and backend-error states.
  - [x] Make tables and summary cards responsive.

  Done when the legacy overview and depot screens are replaceable.

  Completed with owner-grouped portfolio cards, exact string-decimal euro
  formatting, responsive depot asset/history cards, and an invalidating asset
  edit dialog. Shared feedback components cover loading, empty, permission, and
  backend-error states; no automated tests were added.

  ## Issue 18 — Build transaction screens

  - [x] Build the server-driven transaction data table.
  - [x] Preserve all filters and keep them in URL search parameters.
  - [x] Preserve filters when moving between pages and transaction detail.
  - [x] Display filtered summaries.
  - [x] Add detail, edit, delete-confirmation, and bulk-entry interfaces.
  - [x] Build CSV upload, preview, row editing/removal, and atomic commit.
  - [x] Add explicit recategorization confirmation.
  - [x] Refetch affected balances, lists, and analytics after mutations.

  Done when all daily transaction work can be completed in React.

  Completed with React transaction list, detail, create, edit, bulk-entry, and
  CSV-import routes. Filters are URL-backed through pagination and detail
  navigation; mutations invalidate account balances, transaction and contract
  lists, portfolio data, and analytics queries. CSV rows are previewed and
  editable before the atomic import endpoint is called. No automated tests were
  added, as required by this migration phase.

  ## Issue 19 — Build category, contract, and file screens

  - [x] Build category list, create, and update screens.
  - [x] Provide a multiline pattern editor.
  - [x] Build active/inactive contract lists.
  - [x] Build contract detail and edit screens.
  - [x] Display related transactions and computed totals.
  - [x] Build file upload, authenticated download, and delete controls.
  - [x] Apply clear permission and validation messages.

  Done when the remaining Django forms and templates are replaceable.

  Completed with responsive category CRUD and newline-pattern editing, contract
  status lists/detail/edit forms, linked transaction totals, and authenticated
  upload/download/delete controls. Destructive file actions require confirmation,
  and all screen errors retain backend validation details; no automated tests
  were added.

  ## Issue 20 — Build analytics screens

  - [x] Build account, date, amount, category, and transaction-type filters.
  - [x] Build the all-time category chart.
  - [x] Build three month/year comparison charts.
  - [x] Build the monthly income-versus-expense chart.
  - [x] Use responsive shadcn/Recharts components with accessible labels and
    tooltips.

  - [x] Add empty states for accounts or filters without transactions.
  - [x] Ensure chart totals agree with transaction summaries during manual
    verification.

  Done when Django Plotly Dash is no longer needed.

  Completed implementation with URL-backed account/date/amount/category/type
  filters, German all-time and three-period category charts, a monthly
  income-versus-expense chart, accessible Recharts labels/tooltips, and empty
  states. A synthetic migrated database with income and expense rows verified
  category-chart income against the filtered received summary and chart expense
  against the absolute filtered paid summary. No automated tests were added.

  ## Issue 21 — Serve one production application

  - [x] Build the frontend into versioned static assets.
  - [x] Serve /api, /health, /docs, and authenticated file routes before the SPA
    fallback.

  - [x] Serve index.html for valid frontend routes.
  - [x] Do not cache index.html aggressively; cache hashed assets immutably.
  - [x] Keep frontend and API on one origin.
  - [x] Do not add CORS unless a separate development origin requires it.
  - [x] Confirm direct navigation and browser refresh work for every React route.

  Done when one FastAPI process can serve the complete application.

  Completed with FastAPI serving the built Vite bundle on the same origin after
  all reserved backend routes. The SPA fallback rejects reserved and missing
  asset paths, disables aggressive index caching, and gives hashed assets an
  immutable one-year policy. Local production-mode HTTP checks covered every
  registered React route, `/health`, `/docs`, and `/api/v1/auth/me` precedence.

  ## Issue 22 — Replace development and deployment configuration

  - [x] Replace the Django development command with coordinated backend/frontend
    commands.

  - [x] Create a multi-stage Docker build:
      - Install and build the React frontend.
      - Install the locked Python environment.
      - Copy only required runtime files.
      - Run FastAPI with one Uvicorn worker.

  - [x] Replace WSGI/Gunicorn and Django environment variables.
  - [x] Add explicit health checking.
  - [x] Ensure the production database and media directories are persistent
    mounts.

  - [x] Run schema migration only while the application is stopped.
  - [x] Update the README with setup, CLI, migration, backup, restore, and
    deployment instructions.
  - [x] Before rehearsal, audit the new backend, frontend, runtimes, and shared
    tooling for newer stable releases; update manifests and lockfiles together.
  - [x] Run outdated and vulnerability checks for both dependency ecosystems and
    record every unresolved finding with its compatibility or deployment reason.
  - [x] Verify fresh locked installs, backend lint and type checks, frontend lint
    and type checks, and the production build after the audit.

  Done when a release image can be built and started against a copied production
  database.

  Implemented coordinated development tasks, a three-stage frontend/backend
  release image, one-worker FastAPI serving, health checking, persistent `/data`
  mounts, and stopped-application migrations. Setup, management, migration,
  backup, restore, deployment, dependency-audit, and rehearsal runbooks are
  documented. Recharts was updated to 3.10.1 with `bun.lock`; TypeScript remains
  at 6.0.3 because typescript-eslint 8.67.0 does not support TypeScript 7. The
  vulnerability audits found no published-package findings. Fresh locked Pixi
  and Bun installs, backend lint/type checks, frontend lint/type checks, and the
  production build passed. Container build/start verification remains pending:
  the local Docker daemon was unavailable and no copied production
  database/media was provided. The equivalent local production-mode
  FastAPI/SPA smoke passed against a newly initialized temporary database.

  ## Issue 23 — Manual migration rehearsal

  No automated test suite is part of this issue.

  - [ ] Restore copies of the production database and media into an isolated
    environment.

  - [ ] Run schema inspection, baseline stamping, and Alembic upgrade.
  - [ ] Compare pre/post table counts, IDs, foreign-key results, balances, and
    file references.

  - [ ] Log in using an existing password.
  - [ ] Manually check owner and superuser access boundaries.
  - [ ] Check account and depot totals.
  - [ ] Check transaction filters, pagination, summaries, editing, deletion, and
    bulk entry.

  - [ ] Import representative files from all four supported banks.
  - [ ] Check category updates and recategorization.
  - [ ] Check contracts and existing file downloads.
  - [ ] Check all charts against the Django application.
  - [ ] Exercise the user/account/depot CLI commands.
  - [ ] Run Python lint/type checks, TypeScript checks, and production builds.
  - [ ] Record discovered differences as additional migration issues.

  Done when the rehearsal completes without unexplained data or feature
  differences.

  ## Issue 24 — Production cutover

  - [ ] Announce and begin a maintenance window.
  - [ ] Stop the Django process before copying SQLite.
  - [ ] Create timestamped immutable backups of the database and media.
  - [ ] Verify the backups are readable.
  - [ ] Run schema inspection and baseline adoption.
  - [ ] Apply Alembic migrations.
  - [ ] Deploy and start the FastAPI/React image.
  - [ ] Run the critical manual checks:
      - Health endpoint.
      - Existing-user login.
      - Account and depot totals.
      - Transaction list and mutation.
      - Contract-file download.
      - Analytics.
      - CLI access.

  - [ ] Retain the tagged Django image and backups for rollback.
  - [ ] Roll back by stopping FastAPI and restarting Django against the additive-
    compatible database; restore the backup only if database migration failed.

  Done when the new application is serving production successfully.

  ## Issue 25 — Remove Django after burn-in

  - [ ] Wait through the agreed burn-in period.
  - [ ] Remove accounting/, the Django finances/ package, manage.py, templates,
    Django static assets, and Dash code.

  - [ ] Remove Django, crispy forms, bootstrap helpers, Dash, Plotly-Dash,
    WhiteNoise, and WSGI dependencies.

  - [ ] Remove obsolete Django commands and deployment configuration.
  - [ ] Keep historical Django migrations available through Git history.
  - [ ] Do not immediately drop legacy database tables.
  - [ ] Create a separately reviewed future migration if legacy tables are
    eventually removed.

  - [ ] Only after rollback is retired, allow successful logins and password-reset
    commands to migrate password hashes to Argon2.

  Done when the repository contains only the FastAPI backend, React frontend,
  migration tooling, and retained production data.

  ## Deferred work

  - Automated backend tests.
  - React component tests.
  - Browser end-to-end tests.
  - PostgreSQL migration.
  - Category deletion.
  - Password rehashing before the rollback window closes.
  - Dropping Django support tables.
  - Broader financial-schema redesign.
  - Independent frontend/backend deployments.
  - OpenAPI-based frontend type, schema, and client generation.
  - Hey API integration.
