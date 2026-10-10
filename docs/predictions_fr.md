# Prédictions du marché immobilier

Page `/predictions` de l'application : évolution attendue du prix médian au m²
(logements anciens, DVF) sur 1 an et 2 ans, pour la France, les régions, les
départements et les communes ayant assez de ventes, selon trois scénarios de taux.

## Chaîne de traitement

```
DVF 2021→2025 (load_dvf_history.sh)
  → raw_dvf_transaction → stg / normalized (dbt)
  → app_price_history            (mart dbt : médiane trimestrielle par niveau × type de bien)
  → forecast/forecast_prices.py  (modèle Python, numpy/pandas)
  → app_price_forecast*          (tables écrites par le job, déclarées en source dbt `forecast`)
  → GET /forecast/*              (module NestJS backend/src/modules/forecast)
  → /predictions                 (ForecastDashboard, Next.js)
```

Commandes : voir `docs/lancement_projet_fr.md` § 2 « Prédictions du marché ».
Airflow : tâche `forecast_prices` après `dbt_test` dans `homepedia_gold_refresh`.

### `app_price_history`

- Grain : `level` (france, region, departement, commune) × `code` ×
  `property_type` (all, appartement, maison) × `period_quarter`.
- Calcul au grain de la mutation : prix divisé par la surface habitable totale,
  comme dans `dvf_mutation_price`. Les mutations contenant un local commercial
  sont exclues, et les prix au m² sont bornés entre 100 et 30 000 €.
- Les médianes de département et de région sont calculées sur les mutations,
  jamais en moyennant des médianes communales.
- Paris, Lyon et Marseille sont enregistrés par arrondissement dans DVF. Leurs
  ventes sont aussi agrégées sous la commune parente (75056, 69123, 13055).

## Modèle

Pour une série (unité géographique × type de bien), on note y le log du prix
médian trimestriel :

```
y_t     = log P_t − β·r_{t−2} − s_{q(t)}      prix net de l'effet taux et de la saisonnalité
y_t     ≈ a + b·t                             MCO pondérés (poids √ventes)
b*      = w·b + (1−w)·b*_parent               w = τ² / (τ² + se²)   (bayésien empirique)
ŷ_{T+h} = a + b*·Σ_{k=1..h} φ^k + β·r^{scénario}_{T+h−2} + s_{q(T+h)}
```

| Paramètre | Estimation | Valeur (entraînement d'octobre 2026) |
|---|---|---|
| β, élasticité au taux | panel départemental, variations sur 1 an, effets fixes, borné à [−8 %, −0,5 %] | ≈ −4,2 % de prix par point de taux |
| Décalage de l'effet taux | backtest (2 ou 4 trimestres testés) | 2 trimestres |
| s, saisonnalité | résidus de tendance du panel départemental, par type de bien | T3 ≈ +1,6 %, T1 ≈ −0,9 % |
| Fenêtre de tendance | backtest | 8 trimestres (12 pour les communes) |
| φ, amortissement | backtest (grille de 0 à 1) | voir `app_price_forecast_model` |

- **Hiérarchie de rétrécissement** : commune → département → région → France.
  Une commune bruitée hérite donc essentiellement de la dynamique de son département.
- **Communes couvertes** : celles qui comptent au moins 40 ventes sur les
  4 derniers trimestres et au moins 6 trimestres exploitables (≥ 5 ventes) dans
  la fenêtre, soit environ 3 400 communes pour « tous biens ». Pour les autres,
  l'application affiche la prévision du département.
- **Dernier trimestre** : il est écarté si son volume national tombe sous 60 %
  de la moyenne des 4 précédents, signe d'enregistrements DVF encore incomplets.

### Scénarios (`forecast/scenarios.py`)

Le taux moyen du crédit immobilier neuf (série BCE MIR France, observée jusqu'à
août 2026) suit, à partir du dernier mois observé, une trajectoire linéaire
jusqu'aux points d'ancrage :

| Scénario | Fin 2026 | Fin 2027 | Hypothèse |
|---|---|---|---|
| Optimiste | +0,09 pt | +0,09 pt | taux stabilisés ≈ 3,4 %, baisse de la BCE anticipée à l'automne 2027 |
| Central | +0,29 pt | +0,59 pt | ≈ 3,6 % puis ≈ 3,9 % (Cafpi, Mouillart) |
| Pessimiste | +0,59 pt | +0,99 pt | OAT 10 ans > 4,4 % : ≈ 3,9 % puis ≈ 4,3 % |

Les écarts sont mesurés par rapport au taux de Crédit Logement/CSA, 3,31 % en
août 2026. Les trimestres dont le taux est déjà observé (jusqu'à T3 2026)
utilisent le taux réel dans les trois scénarios.

### Intervalles et fiabilité

- **Backtest à origine glissante** : à partir du 8ᵉ trimestre d'historique,
  horizons de 1 à 8 trimestres, avec les taux réalisés. Les erreurs logarithmiques
  sont regroupées par horizon et par classe de volume annuel (< 100, 100–400,
  400–2 000, ≥ 2 000 ventes).
- **IC 80 %** : prévision + quantiles 10 % et 90 % de ces erreurs. La couverture
  observée est d'environ 77 à 80 % pour les départements et les communes.
- **Fiabilité** : « élevée » si la demi-largeur de l'IC à 1 an est inférieure à
  6 %, « moyenne » si elle est inférieure à 12 %, « faible » au-delà.
- **Référence naïve** : le prix moyen des 4 derniers trimestres, maintenu.
  `app_price_forecast_backtest` donne le MAPE du modèle et celui de cette
  référence. La colonne `n_series` compte les couples série × origine évalués.

Résultats d'octobre 2026, en MAPE modèle contre naïf :

| Niveau | Horizon 1 trimestre | Horizon 4 trimestres | Horizon 8 trimestres |
|---|---|---|---|
| France | 1,4 % / 2,0 % | 1,1 % / 3,5 % | 1,4 % / 2,2 % |
| Départements | 2,8 % / 3,1 % | 3,2 % / 4,0 % | 4,2 % / 4,2 % |
| Communes | ≈ 10,4 % / 10,0 % | ≈ 11,0 % / 11,0 % | ≈ 11,6 % / 11,7 % |

Au niveau communal, l'erreur est dominée par le bruit d'échantillonnage de la
médiane trimestrielle : les deux méthodes se valent. La prévision communale
garde l'intérêt de séparer la dynamique propre de la commune de la tendance
départementale.

## Limites

- **Couverture** : DVF ne couvre ni l'Alsace-Moselle (57, 67, 68) ni Mayotte.
  Ces territoires n'ont pas de prévision.
- **Nature de l'indicateur** : le prix médian DVF dépend de la composition des
  ventes, ce qui le distingue de l'indice hédonique Notaires-Insee. Les écarts
  avec le consensus présenté dans l'application sont donc normaux.
- **Date des données** : l'historique s'arrête au T4 2025 (millésime DVF
  d'avril 2026). Les premiers trimestres prévus (T1–T3 2026) sont déjà passés et
  peuvent être comparés aux indices publiés.
- **Look-ahead** : β et la saisonnalité sont estimés sur tout l'historique, y
  compris pendant le backtest. Ce léger biais d'anticipation rend le backtest un
  peu optimiste.
- **Avertissement** : ces estimations statistiques ne constituent pas un conseil
  en investissement.

## Sources du consensus (au 10/10/2026)

- Indice Notaires-Insee, T2 2026 : −0,8 % sur 1 an (insee.fr/fr/statistiques/9040119, 08/09/2026).
- Notaires de France, note de conjoncture n°72 (juillet 2026) : environ −0,6 % sur 1 an d'après les avant-contrats.
- Observatoire Crédit Logement/CSA : taux moyen de 3,31 % en août 2026.
- Taux d'usure T4 2026 (prêts de 20 ans et plus) : 5,40 %.
- BCE : taux de dépôt à 2,50 % (hausse du 10/09/2026).
- S&P Global (13/07/2026) : +1,4 % en 2026, +2,2 % en 2027.
- Crédit Agricole (05/06/2026) : +0,8 % fin 2026.
- SeLoger-Meilleurs Agents (02/09/2026) : +2 à +3 % en 2027 dans le scénario favorable.
