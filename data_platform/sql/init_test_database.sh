#!/usr/bin/env bash
# Docker init: create isolated test database (first container boot only).
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
    SELECT format('CREATE DATABASE %I OWNER %I', 'homepedia_test', 'homepedia')
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'homepedia_test')\gexec
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname homepedia_test <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
EOSQL
