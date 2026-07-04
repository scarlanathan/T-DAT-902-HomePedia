# Lignage des données — comment les sources se croisent pour produire les métriques

Ce document montre **quelles données s'entremêlent** pour produire chaque métrique de
HOMEPEDIA, et **où** ce croisement se fait. Il complète :
- [`data_flow.md`](data_flow.md) — les *couches* de l'entrepôt (raw → stg → … → app) ;
- [`scores_explain_fr.md`](scores_explain_fr.md) — la *sémantique UI* de chaque métrique ;
- [`indicateurs.md`](indicateurs.md) — la *spécification* des indicateurs.

Ici, le focus est le **croisement inter-sources**.

---

## 1. Le principe : une clé de jointure universelle

Toutes les sources sont ramenées au **même grain géographique** — le **code commune INSEE**
(5 caractères) — qui sert de **clé de croisement**. La dimension temporelle utilise le **mois**
(`period_month`) pour les séries (DVF, taux).

```
                         ┌───────────────────────────┐
   Toutes les sources ──▶│  code_commune (INSEE, 5c)  │◀── clé de jointure unique
                         │  + period_month (mensuel)  │◀── axe temporel
                         └───────────────────────────┘
```

C'est ce qui permet de **croiser** un prix DVF, un revenu FiLoSoFi, un taux BCE, une densité
d'équipements BPE, un taux de délinquance SSMSI… sur **la même commune**, dans un seul score.

---

## 2. Inventaire des sources

| Source | Producteur | Ce qu'elle apporte | Grain natif |
|---|---|---|---|
| **DVF** | DGFiP / Etalab | prix de vente, surface, type de bien | parcelle → commune × mois |
| **COG** | INSEE | référentiel officiel communes/dpt/région | commune |
| **BPE** | INSEE | équipements (écoles, santé, commerces, sport) | équipement → commune |
| **FiLoSoFi** | INSEE | revenu médian, taux de pauvreté, déciles | commune / IRIS |
| **Taux crédit** | BCE (série MIR) | taux mensuel des crédits habitat France | national × mois |
| **Taxe foncière** | DGFiP | taux global bâti (TFPB) | commune × exercice |
| **QPV** | ANCT | quartiers prioritaires | quartier → commune |
| **RP‑CSP** | INSEE | population active par catégorie socioprofessionnelle | IRIS → commune |
| **Délinquance** | SSMSI | taux de délinquance par indicateur | commune × année |
| **Codes postaux** | La Poste / Etalab | correspondance commune ↔ code postal | (commune, code postal) |
| **IGN geo** | france‑geojson | polygones des communes (carte) | commune |

---

## 3. Schéma de croisement — vers `app_opportunity_score`

Chaque source passe par ses modèles `stg_ → normalized_`, puis converge sur `code_commune` :

```
 DVF ─────▶ app_city_housing_summary ─┐  (prix médian €/m², par mois)
                                       │
 FiLoSoFi ▶ app_city_social_summary ──┤  (revenu médian, pauvreté)
 RP‑CSP ──▶ normalized_rp_csp_commune ┤  (diversité CSP — indice de Simpson)
 QPV ─────▶ normalized_qpv_commune ───┤  (nb de QPV)
                                       │        ┌─────────────────────────────┐
 BPE ─────▶ app_city_equipment_summary┤───────▶│   app_opportunity_score      │
 SSMSI ───▶ normalized_delinquance ───┤  join   │  (grain commune × mois)      │
                                       │  sur    │  price / social / quality    │
 BCE ─────▶ normalized_interest_rate ─┤ code_    │  + capacité d'emprunt        │
 DGFiP ───▶ normalized_taxe_fonciere ─┘ commune  │  + composite pondérable      │
                                                 └─────────────────────────────┘
 COG ─────▶ dim_location   (référentiel + nom + dpt/région, clé de toutes les jointures)
 La Poste ▶ dim_commune_postal (recherche par code postal)
 IGN ─────▶ polygones communes (rendu carte)
```

Jointures exactes (dbt `app_opportunity_score.sql`) : tout se joint sur `code_commune`, et le
**taux BCE** se joint sur `rate_month = period_month` (le bon taux pour le bon mois).

---

## 4. Composition métrique par métrique (le cœur)

Chaque métrique finale = **le croisement d'une ou plusieurs sources**. Toutes les sous‑métriques
de score sont sur **0–100, plus élevé = mieux**.

| Métrique | Sources croisées | Comment elles se combinent | Modèle dbt |
|---|---|---|---|
| **`price_score`** | DVF | percentile **inversé** du prix médian €/m² du mois (moins cher → score haut) | `app_opportunity_score` |
| **`social_mix_score`** | FiLoSoFi **×** RP‑CSP **×** QPV | `0.35·rang(revenu) + 0.30·(1−rang(pauvreté)) + 0.20·rang(diversité CSP) + 0.15·(1−rang(QPV))` | idem + `normalized_rp_csp_commune`, `normalized_qpv_commune` |
| **`quality_of_life_score`** | BPE **×** SSMSI | `0.60·rang(densité équipements) + 0.40·(1−rang(taux délinquance))` | idem + `normalized_delinquance_commune` |
| **`csp_diversity_index`** | RP‑CSP | indice de **Simpson** `1 − Σ(pᵢ²)` sur les 6 CSP de la population active | `normalized_rp_csp_commune` |
| **`safety_index`** | SSMSI | percentile **inverse** du taux total de délinquance (dernière année) | `normalized_delinquance_commune` |
| **`borrowing_capacity_eur`** | FiLoSoFi (revenu) **×** BCE (taux) | annuité : `(revenu/12 × DTI)` capitalisée sur la durée au **taux mensuel réel BCE** | `normalized_interest_rate_monthly` + FiLoSoFi |
| **`price_to_capacity_ratio`** | DVF **×** (FiLoSoFi × BCE) | `prix médian de vente ÷ capacité d'emprunt` — **le cœur de la problématique** | `app_opportunity_score` |
| **`property_tax_rate_pct`** | Taxe foncière | taux global bâti (dernier exercice) — charge récurrente | `normalized_taxe_fonciere_commune` |
| **`composite_score`** | **les 3 dimensions** | moyenne pondérée `w_price·price + w_social·social + w_quality·quality` (dimensions NULL exclues du dénominateur) | `app_opportunity_score` |

> **Lecture** : le `composite_score` croise, en une seule note, **jusqu'à 8 sources** (DVF,
> FiLoSoFi, RP‑CSP, QPV, BPE, SSMSI — et indirectement BCE/DGFiP via l'accessibilité).

---

## 5. Personnalisation — le profil utilisateur croise les métriques

Le profil (onboarding) ajoute **deux entrées utilisateur** qui se croisent avec les métriques :

| Entrée profil | Se croise avec | Résultat |
|---|---|---|
| **revenu · apport · DTI · durée** | taux réel BCE + prix DVF | **capacité d'emprunt personnelle** + ratio prix/capacité *pour l'utilisateur* (bloc Accessibilité) |
| **pondérations** prix / mixité / qualité | `price_score`, `social_mix_score`, `quality_of_life_score` | **classement personnalisé** (`/stats/commune-ranking?metric=personalized`) + score « Votre score » |

Ainsi la même donnée (les 3 sous‑scores) est **re‑combinée selon les priorités de chaque
utilisateur** — la conciliation « capacité d'emprunt × mixité » devient personnelle.

---

## 6. Où c'est calculé (traçabilité fichiers)

- **Ingestion** : `data_platform/ingestion/<source>/load_raw_*.py` (+ `schema.sql`).
- **Nettoyage / cast** : `data_platform/dbt/models/staging/stg_*.sql`.
- **Règles métier / dédup / agrégation commune** : `data_platform/dbt/models/core/normalized_*.sql`.
- **Croisement final** : `data_platform/dbt/models/marts/app_opportunity_score.sql`.
- **Marts intermédiaires** : `app_city_housing_summary`, `app_city_social_summary`,
  `app_city_equipment_summary`, `dim_location`, `dim_commune_postal`.
- **Personnalisation** : backend `stats.service.ts` (ranking pondéré), frontend
  `lib/preferences.ts` (capacité + composite pondéré).

Provenance et URLs des sources : [`../data_platform/data/raw/SOURCES.md`](../data_platform/data/raw/SOURCES.md).
