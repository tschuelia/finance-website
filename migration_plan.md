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

  - [ ] Tag the last known Django revision before migration work.
  - [ ] Document local and production startup, migration, backup, and deployment
    commands.

  - [ ] Inventory the existing pages and workflows:
      - Login/logout.
      - Account and depot overview.
      - Transaction filtering, pagination, detail, update, delete, and bulk entry.
      - CSV upload and editable preview.
      - Category create, update, and reassignment.
      - Contract create, update, detail, and file management.
      - Depot asset display and update.
      - Dash analytics.
      - Django admin operations that must move to the CLI.

  - [ ] Record the expected production schema, including auth_user, accounting_*,
    Django support tables, and the obsolete accounting_contracttransaction table.

  - [ ] Record baseline table counts, foreign-key status, financial totals, and
    media references using read-only commands.

  - [ ] Document current authorization behavior and the known nested-resource gaps
    that must not be carried into FastAPI.

  - [ ] Add backup and restore instructions for db.sqlite3 and media/.

  Done when the current state and recovery procedure are documented without
  changing production data.

  ## Issue 02 — Establish backend and frontend workspaces

  - [ ] Create backend/ as an installable Python application.
  - [ ] Add FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic Settings, multipart
    upload support, Typer, and password-hashing dependencies.

  - [ ] Retain Pixi as the repository-level Python environment manager.
  - [ ] Select the current stable Python and Bun versions supported by the new
    dependency sets.
  - [ ] Add frontend/ using Vite, React, and TypeScript.
  - [ ] Use Bun through Pixi and commit bun.lock.
  - [ ] Resolve FastAPI, frontend, and shared tools such as Ruff and Lefthook to
    their latest stable mutually compatible releases; document any older pin.
  - [ ] Add repository commands for:
      - FastAPI development.
      - Frontend development.
      - Backend lint and type checking.
      - Frontend lint and TypeScript checking.
      - Frontend production build.
      - Alembic operations.

  - [ ] Update .gitignore for generated frontend assets, caches, local databases,
    environment files, and backups.

  - [ ] Do not require the legacy Django commands to remain functional during
    every intermediate commit.

  Done when both workspaces exist and their dependency graphs can be installed.

  ## Issue 03 — Add configuration and application skeleton

  - [ ] Load configuration exclusively from environment variables.
  - [ ] Define settings for:
      - SQLite database path.
      - Media root.
      - Session secret.
      - Cookie security.
      - Session lifetime.
      - Allowed hosts.
      - Development logging.

  - [ ] Create the FastAPI application factory and /health endpoint.
  - [ ] Mount routers below /api/v1.
  - [ ] Add consistent handling for validation, authentication, authorization,
    not-found, and conflict errors.

  - [ ] Configure structured request logging without logging passwords, cookies,
    uploaded contents, or financial payloads.

  - [ ] Add startup checks for required settings, database availability, and
    media-directory accessibility.

  Done when FastAPI starts and /health responds without loading Django.

  ## Issue 04 — Map the existing SQLite schema

  - [ ] Add synchronous SQLAlchemy engine and session management.
  - [ ] Enable PRAGMA foreign_keys=ON, WAL mode, and a bounded busy timeout for
    every SQLite connection.

  - [ ] Use one database transaction per API request or CLI operation.
  - [ ] Map these existing tables without renaming fields or IDs:
      - auth_user
      - accounting_bankaccount
      - accounting_bankdepot
      - accounting_depotasset
      - accounting_depotassettransaction
      - accounting_category
      - accounting_contract
      - accounting_contractfile
      - accounting_transaction

  - [ ] Preserve nullable relationships and existing delete behavior.
  - [ ] Use Decimal for all monetary operations.
  - [ ] Treat the remaining Django tables as unmanaged legacy data.
  - [ ] Add a read-only finances db inspect command showing schema compatibility,
    table counts, foreign-key violations, and aggregate balances.

  Done when the new backend can read the existing database and reproduce its basic
  counts and totals.

  ## Issue 05 — Adopt Alembic without recreating production tables

  - [ ] Create an Alembic baseline that can construct a fresh database with the
    compatible domain and user schema.

  - [ ] Add finances db bootstrap-existing:
      - Refuse to run if required tables or columns differ.
      - Refuse to run if Alembic is already initialized unexpectedly.
      - Stamp the verified database at the baseline without running table
        creation.

  - [ ] Add the first forward migration for server-side sessions.
  - [ ] Add finances db status and finances db upgrade.
  - [ ] Keep all legacy Django tables during the rollback window.
  - [ ] Document fresh-database initialization separately from existing-database
    adoption.

  Done when a blank database can be created and a copy of the Django database can
  be safely stamped and upgraded.

  ## Issue 06 — Port domain services

  - [ ] Move balance calculations out of Django models.
  - [ ] Port owner/superuser account and depot visibility.
  - [ ] Port transaction filtering:
      - Recipient or subject search.
      - Date range.
      - Absolute amount range.
      - Category selection.
      - Income, expense, or all.
      - Reverse chronological ordering.

  - [ ] Port transaction summaries and pagination calculations.
  - [ ] Port category-pattern matching and reassignment.
  - [ ] Port contract balance and first/last transaction calculations.
  - [ ] Port depot and asset balance calculations.
  - [ ] Keep persistence details out of API route functions.
  - [ ] Correct nested-resource authorization so a transaction must belong to the
    account in the route.

  Done when business behavior no longer requires importing Django.

  ## Issue 07 — Implement authentication and sessions

  - [ ] Preserve existing auth_user rows and flags.
  - [ ] Implement Django pbkdf2_sha256 password verification using the iterations
    and salt stored in each hash.

  - [ ] Do not rehash passwords during the rollback window.
  - [ ] Create opaque random session tokens and store only their hashes.
  - [ ] Add session creation, expiry, revocation, and cleanup.
  - [ ] Use an HttpOnly, SameSite=Lax cookie and enable Secure in production.
  - [ ] Generate a CSRF token for authenticated sessions and require it on
    mutations.

  - [ ] Add:
      - POST /api/v1/auth/login
      - POST /api/v1/auth/logout
      - GET /api/v1/auth/me

  - [ ] Return 401 for missing/expired sessions and 403 for insufficient
    permissions.

  - [ ] Rate-limit or delay repeated failed login attempts within the single-
    process deployment.

  Done when existing credentials can authenticate without Django and sessions can
  be revoked.

  ## Issue 08 — Replace Django admin with CLI management

  - [ ] Create a Typer-based finances command.
  - [ ] Add user commands:
      - List users.
      - Create user.
      - Reset password.
      - Activate/deactivate user.
      - Grant/revoke superuser status.

  - [ ] Write new and reset passwords in the Django-compatible PBKDF2 format
    during the rollback window.

  - [ ] Add account create, update, and list commands.
  - [ ] Add depot create, update, and list commands.
  - [ ] Add asset create and update commands.
  - [ ] Add depot asset transaction create and delete commands.
  - [ ] Require explicit owner IDs or usernames.
  - [ ] Require confirmation before destructive operations.

  Done when Django admin is no longer required for routine setup.

  ## Issue 09 — Implement account and depot APIs

  - [ ] Add account overview endpoints with owner grouping for superusers.
  - [ ] Return account balance, transaction date range, and summary metadata.
  - [ ] Add depot overview endpoints with assets, balances, last-update dates, and
    asset transactions.

  - [ ] Add asset update endpoint for balance and last-update date.
  - [ ] Serialize decimals as strings and dates as ISO-8601 values.
  - [ ] Enforce ownership consistently.

  Done when all current account and depot pages can be supported by JSON APIs.

  ## Issue 10 — Implement transaction APIs

  - [ ] Add paginated transaction listing with current filter semantics.
  - [ ] Return {items, page, page_size, total}.
  - [ ] Include filtered total, paid, received, minimum date, and maximum date.
  - [ ] Add transaction detail and update endpoints.
  - [ ] Replace the unsafe legacy GET deletion with DELETE.
  - [ ] Add bulk transaction creation matching the current formset behavior.
  - [ ] Validate that selected accounts and contracts are accessible to the
    current user.

  - [ ] Preserve existing behavior for missing recipients and nullable categories/
    contracts.

  - [ ] Use conflict responses for stale or invalid relationships.

  Done when all non-CSV transaction workflows are available through FastAPI.

  ## Issue 11 — Port CSV imports

  - [ ] Port Comdirect, DKB, Holvi, and N26 parsing.
  - [ ] Keep parsing independent of HTTP and SQLAlchemy.
  - [ ] Add a multipart CSV preview endpoint.
  - [ ] Return editable transaction DTOs without writing them to the database.
  - [ ] Add a commit endpoint accepting the edited preview rows.
  - [ ] Validate every row before beginning the database transaction.
  - [ ] Commit all rows atomically or none of them.
  - [ ] Return clear errors for unknown banks, encodings, missing columns, invalid
    dates, and invalid amounts.

  - [ ] Preserve current categorization behavior.
  - [ ] Do not introduce automatic duplicate rejection unless separately
    requested.

  Done when the browser can reproduce the existing preview-and-confirm import
  workflow.

  ## Issue 12 — Implement category APIs

  - [ ] Add category list, create, and update endpoints.
  - [ ] Preserve unique names and newline-separated patterns.
  - [ ] Add account recategorization as an explicit mutation.
  - [ ] Restrict all endpoints to authenticated users.
  - [ ] Preserve the current global-category model.
  - [ ] Defer category deletion because the current UI does not implement it.

  Done when Django category forms and reassignment are replaceable.

  ## Issue 13 — Implement contract and file APIs

  - [ ] Add contract list, detail, create, and update endpoints.
  - [ ] Preserve active/inactive grouping and owner restrictions.
  - [ ] Include related transactions and calculated totals/date ranges.
  - [ ] Add authenticated multipart file upload.
  - [ ] Add authenticated file download with ownership verification.
  - [ ] Add file deletion where supported by the existing workflow.
  - [ ] Sanitize new storage names while retaining the user-facing filename.
  - [ ] Prevent absolute paths and .. traversal.
  - [ ] Continue resolving existing stored paths under the configured media root.

  Done when contracts and their existing files work without Django media serving.

  ## Issue 14 — Implement analytics APIs

  - [ ] Replace Dash and pandas-backed callbacks with explicit aggregate
    endpoints.

  - [ ] Add category totals for the selected account and filters.
  - [ ] Add three independently selectable month/year category comparisons.
  - [ ] Add monthly income and expense totals for the requested number of months.
  - [ ] Preserve income/expense color meaning and German month labels.
  - [ ] Return chart-ready series while leaving presentation details to React.
  - [ ] Apply the same account permissions as transaction endpoints.

  Done when no chart calculation depends on Django, Dash, or browser-side access
  to raw unrestricted transactions.

  ## Issue 15 — Create the frontend design system

  - [ ] Initialize shadcn/ui for Vite and TypeScript.
  - [ ] Configure Tailwind CSS, aliases, theme tokens, typography, spacing, and
    chart colors.

  - [ ] Add required shadcn components:
      - Button, input, field/form controls, select, combobox, and date picker.
      - Table, card, badge, separator, tabs, and pagination.
      - Dialog, alert dialog, dropdown menu, tooltip, and popover.
      - Sidebar/navigation, sheet, skeleton, spinner, and notifications.
      - Chart components backed by Recharts.

  - [ ] Build responsive desktop and mobile layouts.
  - [ ] Keep German interface text and Europe/Berlin date formatting.
  - [ ] Avoid copying the legacy Bootstrap markup.

  Done when representative forms, tables, dialogs, and charts render in the new
  visual system.

  ## Issue 16 — Add the frontend API layer and authentication shell

  - [ ] Manually mirror consumed backend request and response schemas as frontend
    Zod schemas and infer TypeScript types from them.
  - [ ] Add a small handwritten API client and resource wrappers using same-origin
    cookies and Zod validation for structured responses.
  - [ ] Read and send the CSRF token for mutations.
  - [ ] Configure TanStack Query and centralized API-error handling.
  - [ ] Configure React Router.
  - [ ] Build login, logout, protected-route, session-expired, not-found, and
    fatal-error screens.

  - [ ] Add the application navigation for accounts, charts, categories, and
    contracts.

  - [ ] Redirect unauthenticated users to login and restore their intended route
    after success.

  Done when authenticated navigation and session expiry work end to end.

  ## Issue 17 — Build account and depot screens

  - [ ] Build the account/depot dashboard with user grouping for superusers.
  - [ ] Display individual and total balances using exact decimal formatting.
  - [ ] Build depot detail with assets and transaction history.
  - [ ] Add the asset edit dialog.
  - [ ] Include loading, empty, permission-denied, and backend-error states.
  - [ ] Make tables and summary cards responsive.

  Done when the legacy overview and depot screens are replaceable.

  ## Issue 18 — Build transaction screens

  - [ ] Build the server-driven transaction data table.
  - [ ] Preserve all filters and keep them in URL search parameters.
  - [ ] Preserve filters when moving between pages and transaction detail.
  - [ ] Display filtered summaries.
  - [ ] Add detail, edit, delete-confirmation, and bulk-entry interfaces.
  - [ ] Build CSV upload, preview, row editing/removal, and atomic commit.
  - [ ] Add explicit recategorization confirmation.
  - [ ] Refetch affected balances, lists, and analytics after mutations.

  Done when all daily transaction work can be completed in React.

  ## Issue 19 — Build category, contract, and file screens

  - [ ] Build category list, create, and update screens.
  - [ ] Provide a multiline pattern editor.
  - [ ] Build active/inactive contract lists.
  - [ ] Build contract detail and edit screens.
  - [ ] Display related transactions and computed totals.
  - [ ] Build file upload, authenticated download, and delete controls.
  - [ ] Apply clear permission and validation messages.

  Done when the remaining Django forms and templates are replaceable.

  ## Issue 20 — Build analytics screens

  - [ ] Build account, date, amount, category, and transaction-type filters.
  - [ ] Build the all-time category chart.
  - [ ] Build three month/year comparison charts.
  - [ ] Build the monthly income-versus-expense chart.
  - [ ] Use responsive shadcn/Recharts components with accessible labels and
    tooltips.

  - [ ] Add empty states for accounts or filters without transactions.
  - [ ] Ensure chart totals agree with transaction summaries during manual
    verification.

  Done when Django Plotly Dash is no longer needed.

  ## Issue 21 — Serve one production application

  - [ ] Build the frontend into versioned static assets.
  - [ ] Serve /api, /health, /docs, and authenticated file routes before the SPA
    fallback.

  - [ ] Serve index.html for valid frontend routes.
  - [ ] Do not cache index.html aggressively; cache hashed assets immutably.
  - [ ] Keep frontend and API on one origin.
  - [ ] Do not add CORS unless a separate development origin requires it.
  - [ ] Confirm direct navigation and browser refresh work for every React route.

  Done when one FastAPI process can serve the complete application.

  ## Issue 22 — Replace development and deployment configuration

  - [ ] Replace the Django development command with coordinated backend/frontend
    commands.

  - [ ] Create a multi-stage Docker build:
      - Install and build the React frontend.
      - Install the locked Python environment.
      - Copy only required runtime files.
      - Run FastAPI with one Uvicorn worker.

  - [ ] Replace WSGI/Gunicorn and Django environment variables.
  - [ ] Add explicit health checking.
  - [ ] Ensure the production database and media directories are persistent
    mounts.

  - [ ] Run schema migration only while the application is stopped.
  - [ ] Update the README with setup, CLI, migration, backup, restore, and
    deployment instructions.
  - [ ] Before rehearsal, audit the new backend, frontend, runtimes, and shared
    tooling for newer stable releases; update manifests and lockfiles together.
  - [ ] Run outdated and vulnerability checks for both dependency ecosystems and
    record every unresolved finding with its compatibility or deployment reason.
  - [ ] Verify fresh locked installs, backend lint and type checks, frontend lint
    and type checks, and the production build after the audit.

  Done when a release image can be built and started against a copied production
  database.

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
