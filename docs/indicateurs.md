# HOMEPEDIA — Spécification des indicateurs

## Contexte et problématique

L'application vise à répondre à la question : **"Comment concilier capacité d'emprunt réelle et indicateurs de mixité sociale pour identifier les meilleures opportunités locales ?"**

L'utilisateur renseigne son profil financier (salaire net, apport, durée souhaitée) et ses critères de vie (écoles, calme, transports…). L'application croise sa capacité d'emprunt avec les données de territoire pour afficher sur une carte les zones accessibles et correspondant à ses valeurs.

---

## Conventions

### Granularité géographique

| Niveau | Quand l'utiliser |
|---|---|
| **Commune** | Toutes les sources — granularité par défaut |
| **IRIS** (~2 000 hab) | FiLoSoFi et INSEE RP uniquement, pour les communes de **plus de 20 000 habitants** |
| **Département / Région** | Chômage (DARES, *planifié*), taux d'intérêt (BCE, série MIR) — interpolés à la commune |

### Clé géographique commune
Toutes les tables utilisent le **code INSEE commune** (`code_commune`) comme clé de jointure, conforme au COG INSEE. Les données IRIS ajoutent un champ `code_iris` (9 caractères).

---

## Bloc 1 — Économique / Prix

> Sources : DVF, FiLoSoFi (INSEE), DARES / France Travail, BCE (série MIR), DGFiP  
> DAGs : `dag_logement`, `dag_demo`, `homepedia_emprunt`

| Indicateur | Source | Granularité | Notes |
|---|---|---|---|
| Prix médian au m² (appartement / maison) | DVF | commune × mois | Calculé sur `price_per_sqm_built` — déjà dans `app_city_housing_summary` |
| Évolution des prix 1 an / 5 ans | DVF | commune × année | Variation % entre deux périodes |
| Volume de transactions | DVF | commune × mois | Indicateur de dynamisme du marché |
| Surface médiane des biens vendus | DVF | commune | Correspond à la demande de surfaces |
| Répartition maison / appartement (%) | DVF | commune | Profil du parc immobilier |
| Revenu médian par unité de consommation | FiLoSoFi | commune + IRIS (>20k hab) | Cœur de la dimension "mixité sociale" |
| Taux de pauvreté | FiLoSoFi | commune + IRIS (>20k hab) | Population sous 60 % du revenu médian national |
| Ratio interdécile D9/D1 | FiLoSoFi | commune + IRIS (>20k hab) | Mesure des inégalités internes au territoire |
| Part des allocataires CAF | FiLoSoFi | commune | Signal de précarité |
| Taux de chômage | DARES / France Travail | bassin d'emploi → commune | Interpolé depuis le bassin d'emploi le plus proche — *planifié (pas de loader)* |
| Taux d'intérêt moyen des crédits immobiliers | BCE — série MIR France | national (mensuel) | **Implémenté** (`raw_interest_rate` → `normalized_interest_rate_monthly`, DAG `homepedia_emprunt`). Alimente `assumed_interest_rate` du simulateur de capacité d'emprunt |
| Taux d'usure — TAEG maximum légal | BdF | national (trimestriel) | Contrainte légale du simulateur |
| Taux de taxe foncière | DGFiP | commune | **Implémenté** (`raw_taxe_fonciere` → `normalized_taxe_fonciere_commune`, DAG `homepedia_emprunt`). Colonne `property_tax_rate_pct` du mart |

### Règles du simulateur de capacité d'emprunt

- **Entrées utilisateur** : salaire net mensuel, apport (montant fixe), durée souhaitée (en années)
- **Taux d'endettement plafonné à 35 %** (règle HCSF)
- **Mensualité maximale** = salaire net × 35 %
- **Capital empruntable** = mensualité × [(1 − (1 + taux_mensuel)^−n) / taux_mensuel]
- **Budget total** = capital empruntable + apport

---

## Bloc 2 — Population / Démographie

> Sources : INSEE Recensement (RP), RPLS, ANCT (QPV)  
> DAG : `dag_demo`, `dag_logement`

### Structure de la population

| Indicateur | Source | Granularité |
|---|---|---|
| Population totale | INSEE RP | commune |
| Densité (habitants / km²) | INSEE RP + IGN | commune |
| Évolution de la population sur 5 ans (%) | INSEE RP | commune |
| Répartition par tranches d'âge (0-14 / 15-29 / 30-44 / 45-59 / 60-74 / 75+) | INSEE RP | commune + IRIS (>20k hab) |
| Âge médian | INSEE RP | commune |

### Structure des ménages

| Indicateur | Source | Granularité |
|---|---|---|
| Taille moyenne des ménages | INSEE RP | commune |
| Part des ménages d'une personne (%) | INSEE RP | commune + IRIS (>20k hab) |
| Part des familles monoparentales (%) | INSEE RP | commune + IRIS (>20k hab) |
| Part des couples avec enfants (%) | INSEE RP | commune + IRIS (>20k hab) |

### Statut d'occupation du logement

| Indicateur | Source | Granularité | Notes |
|---|---|---|---|
| Taux de propriétaires (%) | INSEE RP | commune | |
| Taux de locataires dont parc social (%) | INSEE RP | commune | |
| Taux de vacance des logements (%) | INSEE RP | commune | |
| Taux de logements sociaux — SRU (%) | RPLS | commune | *planifié (pas de loader)* |
| Présence / proximité d'un QPV | ANCT | commune (géométrie PostGIS) | **Implémenté** (`raw_qpv` → `normalized_qpv_commune`, DAG `homepedia_demo`) — alimente `social_mix_score` |
| Diversité socio-professionnelle (indice de Simpson, 6 CSP de la population active) | INSEE RP | commune | **Implémenté** (`raw_rp_csp` → `normalized_rp_csp_commune`, DAG `homepedia_demo`) — colonne `csp_diversity_index` du mart |

---

## Bloc 3 — Énergie / Environnement / Infrastructures

> Sources : DPE (ADEME), BPE (INSEE), FINESS, GTFS, Interstats (SSMSI), Sit@del2  
> DAGs : `dag_logement`, `dag_cadre_vie`, `dag_transports`

### Énergie (DPE — ADEME) — *planifié (pas de loader)*

| Indicateur | Granularité | Notes |
|---|---|---|
| Distribution des classes DPE A → G (%) | commune | Clé pour anticiper les obligations de rénovation |
| Part des "passoires énergétiques" F + G (%) | commune | Risque d'invendabilité post-2028 |
| Consommation énergétique médiane (kWh/m²/an) | commune | Proxy du coût des charges |
| Émissions GES médianes | commune | Étiquette GES du DPE |

### Éducation (BPE — INSEE)

| Indicateur | Granularité | Notes |
|---|---|---|
| Nb écoles maternelles et primaires pour 1 000 hab | commune | Ratio normalisé |
| Nb collèges / lycées | commune | Présence + distance |
| Présence d'une université ou école supérieure | commune | Booléen + distance en km |

### Santé (BPE + FINESS) — *BPE implémenté ; FINESS planifié (pas de loader)*

| Indicateur | Granularité | Notes |
|---|---|---|
| Nb médecins généralistes pour 1 000 hab | commune | Ratio normalisé |
| Désert médical (seuil < 2 MG / 1 000 hab) | commune | Booléen |
| Présence d'un hôpital / urgences + distance (km) | commune | Distance à vol d'oiseau ou isochrone |
| Nb de pharmacies | commune | Ratio ou comptage |

### Commerces et services (BPE)

| Indicateur | Granularité | Notes |
|---|---|---|
| Présence d'un supermarché / hypermarché | commune | Booléen |
| Nb de commerces de proximité | commune | Épiceries, boulangeries, etc. |

### Transports (GTFS + BPE) — *GTFS planifié (pas de loader) : `transit_accessibility` reste NULL*

| Indicateur | Granularité | Notes |
|---|---|---|
| Présence d'une gare ferroviaire + distance (km) | commune | Booléen + distance |
| Nb de lignes TC desservant la commune | commune | Bus, métro, tram |

### Sécurité (Interstats — SSMSI) — **implémenté**

`raw_delinquance` → `normalized_delinquance_commune` (taux total pour mille, dernière année) — DAG `homepedia_cadre_vie`. Alimente `quality_of_life_score` via un indice inverse du taux de délinquance.

| Indicateur | Granularité | Notes |
|---|---|---|
| Taux total de délinquance pour 1 000 hab | commune | Indice inverse intégré au `quality_of_life_score` |
| Taux de criminalité pour 1 000 hab | communes > 20 000 hab uniquement | Crimes et délits |
| Taux de cambriolages pour 1 000 hab | communes > 20 000 hab uniquement | Signal "qualité de vie / calme" |

> ⚠️ Les données Interstats détaillées ne couvrent que les communes de plus de 20 000 habitants. Pour les communes plus petites, ces indicateurs sont absents (non imputés).

### Dynamisme de construction (Sit@del2) — *planifié (pas de loader)*

| Indicateur | Granularité | Notes |
|---|---|---|
| Nb de permis de construire accordés sur 5 ans | commune | Signal d'attractivité et de future offre |

---

## Score composite — `app_opportunity_score`

Grain : **commune × mois**. Le score final agrège trois dimensions, chacune normalisée de 0 à 100.

```
score_final = w_price × price_score
            + w_social × social_mix_score
            + w_quality × quality_of_life_score

Poids par défaut (configurables via dbt vars) :
  w_price   = 0.50
  w_social  = 0.25
  w_quality = 0.25
```

| Dimension | Indicateurs inclus |
|---|---|
| `price_score` | Percentile inversé du prix/m² (implémenté dans dbt) |
| `social_mix_score` | Revenu médian UC + taux de pauvreté + **diversité CSP (indice de Simpson sur les 6 CSP de la population active, RP INSEE)** + **présence QPV (ANCT)** — tous implémentés |
| `quality_of_life_score` | Densité d'équipements BPE + **sécurité (indice inverse du taux de délinquance SSMSI)** — implémentés. Accessibilité transit (GTFS) prévue, `transit_accessibility` reste NULL pour l'instant |

### Capacité d'emprunt réelle

Le mart calcule désormais la capacité d'emprunt à partir du **taux d'intérêt réel BCE** (série MIR), qui remplace l'ancienne valeur `0.035` codée en dur.

| Colonne | Définition |
|---|---|
| `assumed_interest_rate` | Taux mensuel **réel** issu de la série MIR de la BCE (mensuel) |
| `borrowing_capacity_eur` | Mensualité soutenable (revenu médian × DTI / 12) capitalisée au taux mensuel sur la durée du prêt |
| `price_to_capacity_ratio` | Prix médian ÷ `borrowing_capacity_eur` |
| `csp_diversity_index` | Indice de diversité de Simpson sur les 6 CSP de la population active (RP INSEE) |
| `property_tax_rate_pct` | Taux de taxe foncière communale (DGFiP) |

---

## Visualisations associées

| Visualisation | Données utilisées |
|---|---|
| Carte choroplèthe — zones "accessibles vs hors budget" | `price_score` × budget utilisateur |
| Radar chart — profil du quartier vs moyenne ville | Tous les blocs (6-8 axes) |
| Gauge de faisabilité (%) | Score composite pondéré par les critères utilisateur |
| Courbe d'évolution des prix | DVF commune × mois |
| Distribution DPE (barres) | Bloc 3 — Énergie |
| Carte de chaleur démographique | Bloc 2 — Tranche d'âge choisie par filtre |
