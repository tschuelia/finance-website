# Production data migration

This runbook preserves and adopts the production SQLite database and uploaded
media when moving the deployed application to FastAPI/React. The old application
runtime is intentionally not part of this repository; its source remains in Git
history at the `django-baseline` tag.

Never operate on the live database while an application process is running.
Rehearse the complete sequence against copies before the maintenance window.

## Preserved contract

The new backend deliberately retains the existing IDs and the `auth_user` and
`accounting_*` table/column names. `finances db bootstrap-existing` validates the
nine user/domain tables consumed by the new backend before stamping the protected
Alembic baseline. Historical Django support and obsolete tables are unmanaged and
remain untouched.

The adoption must preserve:

- every table and row, including unknown support tables;
- user IDs, usernames, flags, and password hashes;
- account, depot, asset, category, contract, file, and transaction IDs;
- foreign-key validity and financial aggregates;
- every media file, including files not currently referenced by a database row.

The legacy domain schema and its constraints are encoded in
`backend/app/db/schema.py` and the protected baseline migration. Do not use the
deleted Django migrations as operational tooling.

## Prepare and verify a recovery point

Resolve the actual durable host paths from the deployment configuration. The
examples below use `/srv/finances/data` and `/srv/finances/backups`; replace them
with explicit verified paths. Keep backups outside the repository.

Stop the deployed application and confirm no process has the database open. Then
create one timestamped database/media recovery point:

```sh
finances_data=/srv/finances/data
finances_backup_root=/srv/finances/backups
finances_backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
finances_backup_dir="$finances_backup_root/$finances_backup_stamp"
test -f "$finances_data/db.sqlite3"
test -d "$finances_data/media"
test ! -e "$finances_backup_dir"
install -d -m 0700 "$finances_backup_dir"
sqlite3 "$finances_data/db.sqlite3" ".backup '$finances_backup_dir/db.sqlite3'"
tar -C "$finances_data" -cpf "$finances_backup_dir/media.tar" media
sha256sum "$finances_backup_dir/db.sqlite3" "$finances_backup_dir/media.tar" > "$finances_backup_dir/SHA256SUMS"
sqlite3 "$finances_backup_dir/db.sqlite3" 'PRAGMA integrity_check;'
tar -tf "$finances_backup_dir/media.tar" >/dev/null
```

Require `ok` from SQLite, a successful archive check, and a valid checksum file.
Copy the recovery point to a separate protected system according to the operator's
retention policy.

## Rehearsal on copies

Restore the database and media backup into an isolated candidate directory. Set
the backend to those copies, capture the read-only inspection output, and run the
one-time adoption:

```sh
export FINANCES_DATABASE_PATH=/absolute/candidate/data/db.sqlite3
export FINANCES_MEDIA_ROOT=/absolute/candidate/data/media
export FINANCES_SESSION_SECRET='candidate-secret-with-at-least-32-characters'
pixi run finances db inspect
pixi run finances db bootstrap-existing
pixi run finances db upgrade
pixi run finances db status
pixi run finances db inspect
```

The first and final inspections must report compatible schemas, zero foreign-key
violations, and identical counts and financial aggregates for the preserved
domain tables. Status must report the Alembic head with no pending upgrade.

Start the candidate application and verify existing-user login, owner and
superuser boundaries, account/depot totals, transaction read/write workflows,
all four CSV formats, category reassignment, contract file access, analytics,
and the management CLI. A successful PBKDF2 login should continue working; it
will upgrade only that user's stored password hash to Argon2id.

Stop the candidate and rehearse the restore procedure below. Record the image
digest, commands, timings, inspections, verification results, and discrepancies.

## Production adoption

During an announced maintenance window:

1. Stop the current process and confirm SQLite is no longer open.
2. Create and verify the paired recovery point above.
3. Point the candidate image at the durable `/data` mount and run
   `finances db inspect`; stop if it reports any incompatibility or violation.
4. Run `finances db bootstrap-existing` exactly once.
5. Run `finances db upgrade`, then `finances db status` and a final inspection.
6. Start the FastAPI/React image and wait for `/health` to pass.
7. Verify existing login, totals, transaction mutation, contract-file download,
   analytics, and CLI access before ending maintenance.

If any adoption or validation step fails, keep the application stopped and
restore the paired recovery point. Do not run downgrade migrations against
production data.

## Restore

Verify the selected recovery point before changing active state:

```sh
finances_backup_stamp=20260814T120000Z
finances_backup_dir="/srv/finances/backups/$finances_backup_stamp"
cd "$finances_backup_dir"
sha256sum -c SHA256SUMS
sqlite3 db.sqlite3 'PRAGMA integrity_check;'
tar -tf media.tar >/dev/null
```

With the application stopped, move the current state aside, restore database and
media together, verify them, and only then restart:

```sh
finances_data=/srv/finances/data
finances_backup_stamp=20260814T120000Z
finances_backup_dir="/srv/finances/backups/$finances_backup_stamp"
finances_restore_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mv "$finances_data/db.sqlite3" "$finances_data/db.sqlite3.pre-restore-$finances_restore_stamp"
test ! -e "$finances_data/db.sqlite3-wal" || mv "$finances_data/db.sqlite3-wal" "$finances_data/db.sqlite3-wal.pre-restore-$finances_restore_stamp"
test ! -e "$finances_data/db.sqlite3-shm" || mv "$finances_data/db.sqlite3-shm" "$finances_data/db.sqlite3-shm.pre-restore-$finances_restore_stamp"
mv "$finances_data/media" "$finances_data/media.pre-restore-$finances_restore_stamp"
install -m 0600 "$finances_backup_dir/db.sqlite3" "$finances_data/db.sqlite3"
tar -C "$finances_data" -xpf "$finances_backup_dir/media.tar"
sqlite3 "$finances_data/db.sqlite3" 'PRAGMA integrity_check;'
```

Retain the moved state until the restored service has been validated and a new
verified recovery point exists.
