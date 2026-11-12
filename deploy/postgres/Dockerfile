# Both extensions are baked into the image rather than installed at runtime.
#
# pglogical replicates the geometry column as-is. If a station received a geometry row before its
# own PostGIS extension existed, the apply worker would crash and that station would silently stop
# replicating. Building them in removes the ordering problem entirely.
FROM postgres:16

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-16-pglogical \
        postgresql-16-postgis-3 \
    && rm -rf /var/lib/apt/lists/*

COPY postgresql.conf /etc/postgresql/custom.conf
COPY pg_hba_append.conf /tmp/pg_hba_append.conf
COPY init-extensions.sh /docker-entrypoint-initdb.d/00-init-extensions.sh

RUN chmod +x /docker-entrypoint-initdb.d/00-init-extensions.sh

CMD ["postgres", "-c", "config_file=/etc/postgresql/custom.conf"]
