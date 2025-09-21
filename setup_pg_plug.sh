set +e
USER="${1:-plug_user}"
PASS="${2:-plug_pass}"
DB="${3:-plug_fusion}"
sudo -u postgres psql <<SQL
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${USER}') THEN
      EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', '${USER}', '${PASS}');
   END IF;
END$$;
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB}') THEN
      EXECUTE format('CREATE DATABASE %I OWNER %I', '${DB}', '${USER}');
   END IF;
END$$;
GRANT ALL PRIVILEGES ON DATABASE "${DB}" TO "${USER}";
SQL
echo "OK: User=${USER}, DB=${DB} angelegt (oder bereits vorhanden)."
