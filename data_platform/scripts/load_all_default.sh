#!/usr/bin/env bash
# Production load: fetch all four sources from default public URLs, then refresh dbt.
# Override any URL via environment variables (see below).
# Assumes Postgres is up (scripts/postgres_up.sh).
#
# Warning: DVF national full.csv.gz is large (~500 MB compressed, long download/load).
# Set SKIP_DBT=1 to only load raw tables; DVF_MAX_ROWS to cap ingestion for trials.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_use_dev_db
homepedia_require_venv_python
homepedia_activate_venv

# --- Default public URLs (override with env vars) ---
# DVF: geo-DVF April 2026 release (transactions through 2025).
: "${DVF_CSV_URL:=https://files.data.gouv.fr/geo-dvf/latest/csv/2025/full.csv.gz}"
# COG: Code officiel géographique au 1er janvier 2026.
: "${COG_COMMUNE_URL:=https://www.insee.fr/fr/statistiques/fichier/8740222/v_commune_2026.csv}"
: "${COG_DEPARTEMENT_URL:=https://www.insee.fr/fr/statistiques/fichier/8740222/v_departement_2026.csv}"
: "${COG_REGION_URL:=https://www.insee.fr/fr/statistiques/fichier/8740222/v_region_2026.csv}"
# BPE: équipements géolocalisés millésime 2024 (réf. géo 01/01/2024).
: "${BPE_URL:=https://www.insee.fr/fr/statistiques/fichier/8217525/BPE24.zip}"
: "${BPE_MILLESIME:=2024}"
# FiLoSoFi 2 communes (revenus 2023, tidy CSV). Loaded with url-v2.
: "${FILOSOFI_COMMUNE_URL:=https://www.insee.fr/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip}"
# Optional legacy wide commune file (Filosofi 1, e.g. cc_filosofi_*_COM.zip). Empty = skip.
: "${FILOSOFI_LEGACY_COMMUNE_URL:=}"
# Legacy wide IRIS (Filosofi 1, revenus 2021). Filosofi 2 2023 has no IRIS release.
: "${FILOSOFI_IRIS_URL:=https://www.insee.fr/fr/statistiques/fichier/8229323/BASE_TD_FILO_IRIS_2021_DISP_CSV.zip}"
# Interest rate: ECB SDW MIR series, France housing loans to households (new business), monthly.
: "${RATES_CSV_URL:=https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2C.A.R.A.2250.EUR.N?format=csvdata&detail=dataonly}"
# Taxe foncière: DGFiP fiscalité locale des particuliers (commune-level TFPB rates).
: "${TAXE_FONCIERE_URL:=https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-particuliers/exports/csv?select=insee_com,com,libcom,dep,exercice,e12vote,taux_global_tfb&use_labels=false&delimiter=;}"
# QPV: ANCT Quartiers Prioritaires 2024 list (COG 2024).
: "${QPV_URL:=https://static.data.gouv.fr/resources/quartiers-prioritaires-de-la-politique-de-la-ville-qpv/20260116-110350/listeqp2024-cog2024.csv}"
# INSEE RP 2021 activité des résidents (IRIS), CSP counts C21_ACT1564_CS1..CS6.
: "${RP_CSP_URL:=https://www.insee.fr/fr/statistiques/fichier/8268843/base-ic-activite-residents-2021_csv.zip}"
# SSMSI recorded-crime communal base (compressed CSV).
: "${DELINQUANCE_URL:=https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260326-124144/donnee-data.gouv-2025-geographie2025-produit-le2026-02-03.csv.gz}"
# La Poste base officielle des codes postaux (commune INSEE <-> code postal).
: "${CODE_POSTAL_URL:=https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw}"

# Optional: limit DVF rows during trials (unset = full file)
DVF_EXTRA=()
if [[ -n "${DVF_MAX_ROWS:-}" ]]; then
  DVF_EXTRA=(--max-rows "$DVF_MAX_ROWS")
fi

# Optional: keep only proximity-relevant BPE types (unset = full BPE file)
BPE_EXTRA=(--millesime "$BPE_MILLESIME")
if [[ -n "${BPE_TYPEQU_FILTER:-}" ]]; then
  BPE_EXTRA+=(--typequ-filter "$BPE_TYPEQU_FILTER")
fi

echo "==> DVF (geo-DVF national)"
echo "    $DVF_CSV_URL"
"$SCRIPT_DIR/load_dvf.sh" url --url "$DVF_CSV_URL" --truncate "${DVF_EXTRA[@]}"

echo "==> COG communes"
echo "    $COG_COMMUNE_URL"
"$SCRIPT_DIR/load_cog.sh" url --url "$COG_COMMUNE_URL" --truncate

echo "==> COG départements"
echo "    $COG_DEPARTEMENT_URL"
"$SCRIPT_DIR/load_cog.sh" url --url "$COG_DEPARTEMENT_URL" --truncate

echo "==> COG régions"
echo "    $COG_REGION_URL"
"$SCRIPT_DIR/load_cog.sh" url --url "$COG_REGION_URL" --truncate

echo "==> BPE (équipements)"
echo "    $BPE_URL"
"$SCRIPT_DIR/load_bpe.sh" url --url "$BPE_URL" --truncate "${BPE_EXTRA[@]}"

echo "==> FiLoSoFi communes (Filosofi 2, tidy)"
echo "    $FILOSOFI_COMMUNE_URL"
"$SCRIPT_DIR/load_filosofi.sh" url-v2 --url "$FILOSOFI_COMMUNE_URL" --truncate

if [[ -n "${FILOSOFI_LEGACY_COMMUNE_URL:-}" ]]; then
  echo "==> FiLoSoFi communes (legacy wide)"
  echo "    $FILOSOFI_LEGACY_COMMUNE_URL"
  "$SCRIPT_DIR/load_filosofi.sh" url-wide --url "$FILOSOFI_LEGACY_COMMUNE_URL" --truncate
fi

if [[ -n "${FILOSOFI_IRIS_URL:-}" ]]; then
  echo "==> FiLoSoFi IRIS (legacy wide)"
  echo "    $FILOSOFI_IRIS_URL"
  "$SCRIPT_DIR/load_filosofi.sh" url-wide --url "$FILOSOFI_IRIS_URL" --truncate
fi

echo "==> Taux de crédit immobilier (BCE MIR)"
echo "    $RATES_CSV_URL"
"$SCRIPT_DIR/load_rates.sh" url --url "$RATES_CSV_URL" --truncate

echo "==> Taxe foncière (DGFiP)"
echo "    $TAXE_FONCIERE_URL"
"$SCRIPT_DIR/load_taxe_fonciere.sh" url --url "$TAXE_FONCIERE_URL" --truncate

echo "==> QPV (ANCT)"
echo "    $QPV_URL"
"$SCRIPT_DIR/load_qpv.sh" url --url "$QPV_URL" --truncate

echo "==> INSEE RP — CSP (activité des résidents)"
echo "    $RP_CSP_URL"
"$SCRIPT_DIR/load_rp_csp.sh" url --url "$RP_CSP_URL" --truncate

echo "==> Délinquance communale (SSMSI)"
echo "    $DELINQUANCE_URL"
"$SCRIPT_DIR/load_delinquance.sh" url --url "$DELINQUANCE_URL" --truncate

echo "==> Codes postaux (La Poste)"
echo "    $CODE_POSTAL_URL"
"$SCRIPT_DIR/load_codes_postaux.sh" url --url "$CODE_POSTAL_URL" --truncate

if [[ "${SKIP_DBT:-}" == "1" ]]; then
  echo "done: production sources loaded (SKIP_DBT=1, dbt skipped)."
  exit 0
fi

if ! command -v dbt >/dev/null 2>&1; then
  echo "error: dbt not on PATH; run scripts/bootstrap_venv.sh or set SKIP_DBT=1" >&2
  exit 1
fi

echo "==> dbt deps / run / test"
cd "$DATA_PLATFORM_ROOT/dbt"
dbt deps
dbt run
dbt test
echo "done: production sources loaded and dbt models refreshed."
