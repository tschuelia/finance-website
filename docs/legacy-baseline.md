# Legacy Django baseline

This document records the Django application immediately before the FastAPI and
React migration. The baseline is the annotated Git tag `django-baseline`, which
resolves to commit `1299c3747c2e253d3ce60f3923859ac7c02b7fd0`.

The recorded database values are aggregates from the local `db.sqlite3` and
`media/` snapshot inspected on 2026-08-13. They contain no usernames, transaction
details, filenames, passwords, session values, or other row-level data. The
database and media directory are ignored by Git and must never be committed.

## Runtime and deployment

### Local development

Install Pixi, install the repository hooks once, apply Django migrations, and
start the development server:

```sh
pixi install --locked
pixi run hooks-install
pixi run migrate
pixi run dev
```

The site is then available from the address printed by Django, normally
`http://127.0.0.1:8000/`. Useful non-mutating checks are:

```sh
pixi run check
pixi run test
pixi run lint
pixi run format-check
```

`pixi run check` exits successfully but reports the existing Django warning
`fields.W161`: `DepotAsset.last_update` receives a fixed date because the model
calls `datetime.date.today()` while defining the field. Issue 01 records this
legacy behavior and does not change the model.

`finances/settings.py` uses `db.sqlite3` and `media/` below the repository root.
Local development uses the checked-in settings, including `DEBUG=True`.

### Production startup and migrations

The Git remote identifies the Dokku application as `julia-finances` on
`jonasserver`. Both `Dockerfile` and `Procfile` select the external production
settings with:

```text
PYTHONPATH=/hetzner
DJANGO_SETTINGS_MODULE=settings_prod
```

The image installs the locked Pixi environment. The `Procfile` defines these
processes:

- `release`: runs `pixi run migrate` inside the built image before deployment.
- `web`: runs Gunicorn through `pixi run web`.

The equivalent application commands are:

```sh
pixi run migrate
pixi run web
```

Before a production operation, run the following on the Dokku host. Dokku host
commands are orchestration commands and therefore do not run inside Pixi:

```sh
dokku git:report julia-finances
dokku ps:report julia-finances
dokku storage:report julia-finances
dokku enter julia-finances web pixi run python -c 'from django.conf import settings; print(settings.DATABASES["default"]["NAME"]); print(settings.MEDIA_ROOT)'
```

Match the database and media paths printed from the container to the persistent
host mounts in `storage:report`. Abort backup, restore, migration, or deployment
if either path is not covered by persistent storage. Do not infer host paths from
the examples in this document.

From a local checkout, verify the destination and deploy an explicit branch to
Dokku's deployment branch:

```sh
pixi run git remote get-url dokku
pixi run git ls-remote dokku refs/heads/master
pixi run git push dokku <branch>:master
```

The push builds the Dockerfile, runs the `release` migration, and replaces the
web process only if the deployment succeeds. Production deployments must not be
performed from an incomplete migration issue.

## Pages and workflows

All application routes are protected by Django's `LoginRequiredMiddleware`
except the login route. Unauthenticated requests redirect to `/login/`.

| Area | Routes and current behavior |
| --- | --- |
| Authentication | `/login/` uses Django authentication and redirects to the account overview. `/logout/` ends the Django session. |
| Account overview | `/` groups bank accounts and depots by owner. A regular user sees their own objects and combined balance; a superuser sees every user and a grand total. |
| Transactions | `/konto/<account-id>/` lists transactions newest first, 100 per page. Filters cover recipient/subject text, date range, absolute amount range, and categories. Filtered results add paid, received, net, and date-range summaries. |
| Transaction detail and mutations | Nested routes show, update, and delete a transaction. `/konto/<account-id>/addmulti` provides editable bulk entry. The delete route has no HTTP-method guard or confirmation and category reassignment is also invoked directly by its route. |
| CSV import | `/konto/<account-id>/upload` accepts a bank export, parses it in memory, and renders the same editable bulk-entry table before saving. Duplicate detection and bank-specific parsing remain in `accounting/csv_to_transactions.py`. The regular-user bulk form currently fails while trying to scope its contract field; the superuser path does not execute that faulty branch. |
| Categories | `/kategorien` lists global categories. Create and update edit the name and newline-separated matching patterns. A popup can create a category while editing a transaction. `/konto/<account-id>/updatecategories` reapplies pattern matching to that account's transactions. There is no category-delete UI. |
| Depots | `/depot/<depot-id>/` displays assets and their asset transactions. `/depot/<depot-id>/asset/<asset-id>/update` edits the current balance and last-update date. |
| Contracts | `/vertrag` lists active and inactive contracts visible to the user. Create/update edit owner, dates, status, name, and description. Detail shows linked transactions, balance, first/last transaction, and uploaded files. `/vertrag/<contract-id>/addfiles` adds or deletes contract files through an inline form set. |
| Analytics | `/charts/` embeds the `Charts` Django Dash application. It selects an account and filters by dates, absolute amount, categories, and income/expense type. It renders all-time category totals, three month/year category comparisons, and monthly income/expense history. `/konto/<account-id>/charts` is registered but currently fails because its view does not accept the route's `pk` argument. |
| Django admin | `/admin/` exposes categories, bank accounts, transactions, depots, depot assets, depot-asset transactions, contracts, and Django users. Contract files are managed through the contract UI rather than being registered directly. |

The admin log confirms historical creation/update of users, accounts, depots,
assets, and asset transactions, plus transaction deletion. Issue 08 replaces the
routine administrative duties with explicit CLI commands for user lifecycle and
superuser status, account/depot list-create-update, asset create-update, and
asset-transaction create-delete. Category, transaction, and contract workflows
move to the API and frontend in their respective migration issues.

## Authorization baseline and known gaps

The current intended rule for owned resources is "owner or superuser":

- Account and depot lists filter by owner for regular users and return all rows
  for superusers.
- Account, depot, contract-detail, and contract-file views call
  `check_user_permissions`, which permits the object's owner or a superuser.
- Contract lists and transaction-form contract choices are intended to be scoped
  to the current user; superusers can select any owner or contract.
- Django admin additionally requires staff access and uses Django's admin
  permissions.

The following legacy behavior is a security baseline, not behavior to preserve:

- Transaction detail, update, and delete authorize the account from the URL but
  load the transaction independently. They never prove that the transaction
  belongs to that account.
- Depot-asset update authorizes the depot from the URL but loads the asset
  independently. It never proves that the asset belongs to that depot.
- Contract update does not call the owner/superuser check. A logged-in user can
  address another contract by ID, and the form can change its owner.
- Category list/create/update and popup creation have no role or ownership check.
  Categories are global, so every logged-in user can mutate them.
- The full transaction edit form exposes all model fields, including bank
  account. Ownership of a newly selected account is not validated.
- The bulk-entry form intends to restrict contracts for regular users but treats
  the contract form field as a mapping. Form construction fails before applying
  any contract-owner filter.
- Dash initially offers only visible accounts, but callbacks load a submitted
  account ID without rechecking ownership.
- Transaction delete and account recategorization are state-changing routes
  without POST-only enforcement.

FastAPI endpoints must authorize the resource being returned or mutated and must
verify every nested parent-child relationship. They must not rely on a parent ID
or a client-filtered selector as proof of access.

## Expected SQLite schema

This is the production schema expected from the checked-in Django migrations and
confirmed against the approved local snapshot. Production was not queried while
capturing issue 01; production preflight must compare its schema before cutover.

Unless noted otherwise, `id` is an auto-incrementing integer primary key. Django
created foreign keys as deferred SQLite references with `NO ACTION`; Django's ORM
currently implements the model-level `CASCADE` and `SET_NULL` behavior. Foreign
key indexes exist for every foreign-key column. `?` marks a nullable column.

### Accounting tables

| Table | Columns and constraints |
| --- | --- |
| `accounting_bankaccount` | `id`; `name varchar(255)`; `bank varchar(255)`; `current_amount decimal`; `owner_id integer -> auth_user.id` |
| `accounting_bankdepot` | `id`; `name varchar(255)`; `owner_id integer -> auth_user.id` |
| `accounting_category` | `id`; `name varchar(255) UNIQUE`; `patterns text` |
| `accounting_contract` | `id`; `name varchar(255)`; `description text?`; `owner_id integer -> auth_user.id`; `is_active bool`; `end_date date?`; `start_date date?` |
| `accounting_contractfile` | `id`; `file varchar(100)`; `filename varchar(255)`; `contract_id bigint -> accounting_contract.id` |
| `accounting_contracttransaction` | `id`; `contract_id bigint -> accounting_contract.id`; `transaction_id bigint -> accounting_transaction.id`. Obsolete, empty many-to-many table retained for compatibility. |
| `accounting_depotasset` | `id`; `name varchar(255)`; `current_balance decimal`; `bank_depot_id bigint? -> accounting_bankdepot.id`; `last_update date` |
| `accounting_depotassettransaction` | `id`; `amount decimal`; `date_issue date`; `asset_id bigint? -> accounting_depotasset.id` |
| `accounting_transaction` | `id`; `recipient varchar(255)`; `amount decimal`; `subject varchar(1024)`; `date_issue date`; `date_booking date?`; `full_subject_string text`; `bank_account_id bigint? -> accounting_bankaccount.id`; `category_id bigint? -> accounting_category.id`; `contract_id bigint? -> accounting_contract.id` |

### Authentication and Django support tables

| Table | Columns and constraints |
| --- | --- |
| `auth_user` | `id`; `password varchar(128)`; `last_login datetime?`; `is_superuser bool`; `username varchar(150) UNIQUE`; `last_name varchar(150)`; `email varchar(254)`; `is_staff bool`; `is_active bool`; `date_joined datetime`; `first_name varchar(150)` |
| `auth_group` | `id`; `name varchar(150) UNIQUE` |
| `auth_permission` | `id`; `content_type_id integer -> django_content_type.id`; `codename varchar(100)`; `name varchar(255)`; unique on `(content_type_id, codename)` |
| `auth_group_permissions` | `id`; `group_id integer -> auth_group.id`; `permission_id integer -> auth_permission.id`; unique on `(group_id, permission_id)` |
| `auth_user_groups` | `id`; `user_id integer -> auth_user.id`; `group_id integer -> auth_group.id`; unique on `(user_id, group_id)` |
| `auth_user_user_permissions` | `id`; `user_id integer -> auth_user.id`; `permission_id integer -> auth_permission.id`; unique on `(user_id, permission_id)` |
| `django_admin_log` | `id`; `object_id text?`; `object_repr varchar(200)`; `action_flag smallint unsigned`; `change_message text`; `content_type_id integer? -> django_content_type.id`; `user_id integer -> auth_user.id`; `action_time datetime` |
| `django_content_type` | `id`; `app_label varchar(100)`; `model varchar(100)`; unique on `(app_label, model)` |
| `django_migrations` | `id`; `app varchar(255)`; `name varchar(255)`; `applied datetime` |
| `django_session` | `session_key varchar(40) PRIMARY KEY`; `session_data text`; `expire_date datetime` |
| `django_plotly_dash_statelessapp` | `id`; `app_name varchar(100) UNIQUE`; `slug varchar(110) UNIQUE` |
| `django_plotly_dash_dashapp` | `id`; `instance_name varchar(100) UNIQUE`; `slug varchar(110) UNIQUE`; `base_state text`; `creation datetime`; `update datetime`; `save_on_change bool`; `stateless_app_id integer -> django_plotly_dash_statelessapp.id` |

SQLite also maintains the internal `sqlite_sequence` table for auto-increment
counters. It is data to preserve, not an application model.

## Recorded aggregate baseline

The snapshot has 21 application/support tables plus `sqlite_sequence`.

| Table | Rows |
| --- | ---: |
| `accounting_bankaccount` | 4 |
| `accounting_bankdepot` | 2 |
| `accounting_category` | 11 |
| `accounting_contract` | 3 |
| `accounting_contractfile` | 2 |
| `accounting_contracttransaction` | 0 |
| `accounting_depotasset` | 3 |
| `accounting_depotassettransaction` | 3 |
| `accounting_transaction` | 2,484 |
| `auth_group` | 0 |
| `auth_group_permissions` | 0 |
| `auth_permission` | 68 |
| `auth_user` | 2 |
| `auth_user_groups` | 0 |
| `auth_user_user_permissions` | 0 |
| `django_admin_log` | 2,939 |
| `django_content_type` | 17 |
| `django_migrations` | 34 |
| `django_plotly_dash_dashapp` | 0 |
| `django_plotly_dash_statelessapp` | 3 |
| `django_session` | 15 |
| `sqlite_sequence` | 16 |

`PRAGMA foreign_key_check` returns zero violations. All transactions have a bank
account, all assets have a depot, and all asset transactions have an asset. The
nullable category and contract links are used: 1,352 transactions have no
category and 2,480 have no contract.

| Financial aggregate | Value |
| --- | ---: |
| Bank-account starting balances | `11910.46` |
| Transaction net | `26882.57` |
| Calculated account balances | `38793.03` |
| Depot current balances | `3184.87` |
| Account plus depot balance displayed on the overview | `41977.90` |
| Depot-asset transaction net | `1650.00` |
| Contract-linked transaction net | `-1394.46` |

The database contains 2 contract-file references to 2 distinct paths. `media/`
contains 6 files: no referenced file is missing and 4 files are unreferenced.
Unreferenced files are retained during the migration and in every backup.

### Reproduce the read-only snapshot

Run this from the repository root. It opens SQLite in read-only immutable mode
and prints only schema names, counts, integrity results, and aggregates:

```sh
pixi run python <<'PY'
import sqlite3
from decimal import Decimal
from pathlib import Path

database_path = Path('db.sqlite3').resolve()
media_root = Path('media')
connection = sqlite3.connect(
    f'file:{database_path}?mode=ro&immutable=1',
    uri=True,
)

tables = [
    row[0]
    for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    )
]
for table in tables:
    count = connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    print(f'{table}: {count}')

violations = list(connection.execute('PRAGMA foreign_key_check'))
print(f'foreign-key violations: {len(violations)}')


def decimal_total(query: str) -> Decimal:
    return sum(
        (Decimal(str(row[0])) for row in connection.execute(query)),
        Decimal('0'),
    )


starting = decimal_total('SELECT current_amount FROM accounting_bankaccount')
transactions = decimal_total('SELECT amount FROM accounting_transaction')
depots = decimal_total('SELECT current_balance FROM accounting_depotasset')
asset_transactions = decimal_total(
    'SELECT amount FROM accounting_depotassettransaction'
)
contract_transactions = decimal_total(
    'SELECT amount FROM accounting_transaction WHERE contract_id IS NOT NULL'
)
print(f'account starting balances: {starting}')
print(f'transaction net: {transactions}')
print(f'calculated account balances: {starting + transactions}')
print(f'depot current balances: {depots}')
print(f'displayed combined balance: {starting + transactions + depots}')
print(f'depot-asset transaction net: {asset_transactions}')
print(f'contract-linked transaction net: {contract_transactions}')

references = {
    row[0]
    for row in connection.execute('SELECT file FROM accounting_contractfile')
}
files = {
    str(path.relative_to(media_root))
    for path in media_root.rglob('*')
    if path.is_file()
}
print(f'media references: {len(references)}')
print(f'media files: {len(files)}')
print(f'missing references: {len(references - files)}')
print(f'unreferenced files: {len(files - references)}')
connection.close()
PY
```

Do not add queries that print user rows, sessions, transaction rows, filenames,
password hashes, or financial details.

## Backup, restore, and recovery

Always back up the database and the entire media directory as one recovery point.
Keep the backup outside the repository, restrict its permissions, record
checksums, and retain unreferenced media files. A database-only or media-only
backup is incomplete.

### Local backup and verification

Stop the development server, replace `/absolute/secure/backup/root` with a path
outside this checkout, and run:

```sh
finances_backup_root=/absolute/secure/backup/root
finances_backup_stamp="$(pixi run date -u +%Y%m%dT%H%M%SZ)"
finances_backup_dir="$finances_backup_root/$finances_backup_stamp"
pixi run mkdir -p "$finances_backup_dir"
pixi run chmod 0700 "$finances_backup_dir"
pixi run python - "$finances_backup_dir/db.sqlite3" <<'PY'
import sqlite3
import sys

source = sqlite3.connect('file:db.sqlite3?mode=ro', uri=True)
destination = sqlite3.connect(sys.argv[1])
source.backup(destination)
destination.close()
source.close()
PY
pixi run tar -C . -cpf "$finances_backup_dir/media.tar" media
pixi run shasum -a 256 "$finances_backup_dir/db.sqlite3" "$finances_backup_dir/media.tar"
pixi run python - "$finances_backup_dir/db.sqlite3" <<'PY'
import sqlite3
import sys

connection = sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
print(connection.execute('PRAGMA integrity_check').fetchone()[0])
connection.close()
PY
pixi run tar -tf "$finances_backup_dir/media.tar" >/dev/null
```

Record the two checksum lines securely with the backup. The integrity result must
be `ok`, and the archive check must exit successfully. The aggregate inventory
command above verifies database references against the complete `media/` tree
without printing filenames.

### Production backup and verification

Run the production preflight first. On the Dokku host, set the following three
variables to explicit paths obtained from that preflight; do not paste these
example names without resolving the real mounts:

```sh
finances_database=/absolute/persistent/host/path/db.sqlite3
finances_media_parent=/absolute/persistent/host/path
finances_media_name=media
finances_backup_dir=/var/backups/julia-finances/<UTC-timestamp>
```

Check each resolved target before stopping the application:

```sh
realpath "$finances_database"
realpath "$finances_media_parent/$finances_media_name"
test -f "$finances_database"
test -d "$finances_media_parent/$finances_media_name"
test ! -e "$finances_backup_dir"
```

Then take a consistent backup during a maintenance window:

```sh
dokku ps:stop julia-finances
install -d -m 0700 "$finances_backup_dir"
sqlite3 "$finances_database" ".backup '$finances_backup_dir/db.sqlite3'"
tar -C "$finances_media_parent" -cpf "$finances_backup_dir/media.tar" "$finances_media_name"
sha256sum "$finances_backup_dir/db.sqlite3" "$finances_backup_dir/media.tar" > "$finances_backup_dir/SHA256SUMS"
sqlite3 "$finances_backup_dir/db.sqlite3" 'PRAGMA integrity_check;'
tar -tf "$finances_backup_dir/media.tar" >/dev/null
dokku ps:start julia-finances
```

Require `ok` from SQLite, a successful archive check, and successful application
startup. Copy the backup to a separate protected system according to the
operator's retention policy. Do not deploy while creating this baseline backup.

### Restore

Restoration is destructive to the active state and requires an approved
maintenance window. First verify the chosen recovery point:

```sh
cd /var/backups/julia-finances/<UTC-timestamp>
sha256sum -c SHA256SUMS
sqlite3 db.sqlite3 'PRAGMA integrity_check;'
tar -tf media.tar >/dev/null
```

Re-run the production preflight and assign the same explicit
`finances_database`, `finances_media_parent`, and `finances_media_name` values.
Set `finances_backup_dir` to the verified recovery point. Stop the app and move
the current state aside instead of deleting it:

```sh
finances_restore_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dokku ps:stop julia-finances
mv "$finances_database" "${finances_database}.pre-restore-$finances_restore_stamp"
test ! -e "${finances_database}-wal" || mv "${finances_database}-wal" "${finances_database}-wal.pre-restore-$finances_restore_stamp"
test ! -e "${finances_database}-shm" || mv "${finances_database}-shm" "${finances_database}-shm.pre-restore-$finances_restore_stamp"
install -m 0600 "$finances_backup_dir/db.sqlite3" "$finances_database"
mv "$finances_media_parent/$finances_media_name" "$finances_media_parent/$finances_media_name.pre-restore-$finances_restore_stamp"
tar -C "$finances_media_parent" -xpf "$finances_backup_dir/media.tar"
sqlite3 "$finances_database" 'PRAGMA integrity_check;'
dokku ps:start julia-finances
```

Verify login, account/depot totals, transaction access, and contract-file access
before ending the maintenance window. Retain the `.pre-restore-*` state until the
restored application and media have been validated and a new recovery point has
been created. A local restore follows the same process with the development
server stopped and all commands run through `pixi run`.

The migration cutover has its own rehearsal and rollback gates. This baseline
procedure does not authorize a cutover or schema change.
