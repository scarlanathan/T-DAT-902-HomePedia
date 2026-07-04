# Déploiement de HOMEPEDIA en ligne

Stack conteneurisée : **Postgres/PostGIS + API NestJS + frontend Next.js**, orchestrée par
`docker-compose.prod.yml` (racine du dépôt). Objectif : une commande pour tout lancer.

> ⚠️ Je (l'assistant) ne peux pas exécuter le déploiement à ta place : il faut **tes accès**
> (serveur/cloud, domaine, secrets). Ce guide + les fichiers Docker fournis te permettent de
> déployer toi-même en quelques minutes.

## 1. Prérequis
- Docker + Docker Compose v2 sur la machine cible (VPS, ou local pour tester).
- Ports libres : `3000` (front), `3001` (API), `5432` (Postgres, interne).

## 2. Secrets (fichier `.env` à la racine, à côté du compose)
```env
POSTGRES_PASSWORD=un-mot-de-passe-fort
JWT_SECRET=une-chaine-aleatoire-longue
# URL PUBLIQUE de l'API vue par le navigateur (compilée dans le bundle Next au build) :
NEXT_PUBLIC_API_URL=https://api.mondomaine.fr    # en local : http://localhost:3001
CORS_ORIGIN=https://mondomaine.fr                # en local : http://localhost:3000
COOKIE_SECURE=true                               # true derrière HTTPS
```
`NEXT_PUBLIC_API_URL` est **figée au build** du frontend : si tu changes de domaine, rebuild
l'image front (`--build`).

## 3. Lancer la stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
- Front : http://localhost:3000
- API + Swagger : http://localhost:3001/docs

## 4. Charger les données (indispensable — le warehouse démarre vide)
Les conteneurs montent une base **vide**. Il faut exécuter une fois les loaders + dbt contre
elle (voir [lancement_projet_fr.md](lancement_projet_fr.md) et
[data/raw/SOURCES.md](../data_platform/data/raw/SOURCES.md)).

Publie temporairement le port Postgres pour charger depuis l'hôte, puis retire-le :
```bash
# ajoute temporairement sous le service postgres :  ports: ["5432:5432"]
cd data_platform
./scripts/bootstrap_venv.sh
DATABASE_URL="postgresql://homepedia:$POSTGRES_PASSWORD@localhost:5432/homepedia" \
  ./scripts/load_all_default.sh        # DVF, COG, BPE, FiLoSoFi, taux, taxe, QPV, RP, délinquance, codes postaux + dbt
```
Astuce essais rapides : `DVF_MAX_ROWS=50000 SKIP_DBT=1 ./scripts/load_all_default.sh`.

## 5. Mise à jour
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Alternatives cloud (managé)
| Composant | Option simple |
|---|---|
| **Frontend** | Vercel (import du dossier `frontend/`, définir `NEXT_PUBLIC_API_URL`) |
| **API** | Render / Railway / Fly.io (Docker `backend/Dockerfile`, variables d'env de l'étape 2) |
| **Postgres** | Neon / Supabase / Render Postgres (activer l'extension **PostGIS**) |

Avec un Postgres managé, pointe `POSTGRES_*` de l'API dessus et exécute l'étape 4 contre lui.

## Fichiers ajoutés
- `backend/Dockerfile`, `backend/.dockerignore`
- `frontend/Dockerfile`, `frontend/.dockerignore`
- `docker-compose.prod.yml`
