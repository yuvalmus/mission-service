#!/bin/bash
set -e

cat /tmp/pg_hba_append.conf >> "$PGDATA/pg_hba.conf"

# PostGIS must exist before any replicated geometry can be applied, and pglogical
# must exist before a node can be created. Both are created at cluster init so
# neither is ever a race at runtime.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS pglogical;
EOSQL

# Newer PostgreSQL builds only allow allow-listed libraries to act as logical
# decoding output plugins, and pglogical is not on the default list - without
# this, every subscription fails with "may not be used as an output plugin".
#
# Applied only when the server has the setting, so older builds still start.
# ALTER SYSTEM cannot run inside a DO block, so the existence check happens here
# in the shell and the statement itself runs at top level.
HAS_ALLOW_LIST=$(psql -tA --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "SELECT 1 FROM pg_settings WHERE name = 'output_plugin_libraries'")

if [ "$HAS_ALLOW_LIST" = "1" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -c "ALTER SYSTEM SET output_plugin_libraries = 'pgoutput', 'test_decoding', 'pglogical_output', 'pglogical'"
fi
