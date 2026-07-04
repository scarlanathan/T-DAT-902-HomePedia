# Guide de présentation - indicateurs du tableau de bord

Ce document suit **l'interface HOMEPEDIA** : mêmes titres de cartes, mêmes libellés de métriques, mêmes textes d'aide que dans l'application (fichiers i18n `fr.ts`).

Pour chaque métrique :

| Élément UI | Rôle en présentation |
|------------|----------------------|
| **Valeur** | Le chiffre principal affiché |
| **Indice** (sous la valeur) | Phrase courte pour interpréter d'un coup d'œil |
| **?** (popover) | Explication détaillée à montrer si on vous pose une question |
| **Calcul** | Logique mathématique ou source de données (pour vous, pas affiché dans l'UI) |

Ordre d'affichage sur le tableau de bord : **Marché immobilier** → **Indicateurs sociaux** → **Équipements publics** → **Score d'opportunité** → **Historique prix / m²**.

Implémentation technique : mart dbt [`app_opportunity_score.sql`](../data_platform/dbt/models/marts/app_opportunity_score.sql).

---

## Marché immobilier

**Sous-titre :** Prix et volumes de vente  
**Source :** DVF - *Demandes de Valeurs Foncières, filtrées par commune et type de bien.*  
**Filtre :** Type de bien (Tous types / Appartement / Maison)

### Ventes

| | |
|---|---|
| **Valeur** | Nombre entier de ventes |
| **Indice** | *Ventes déclarées* |
| **?** | Nombre de ventes immobilières déclarées pour la commune et le type de bien sélectionnés. |
| **Calcul** | Comptage des lignes DVF `Vente` avec `valeur_fonciere` positive, pour la commune et la période filtrées. |

### Prix médian

| | |
|---|---|
| **Valeur** | Montant en € (ex. `250 000 €`) |
| **Indice** | *Prix de vente médian* |
| **?** | Prix de vente déclaré médian sur les transactions correspondantes. |
| **Calcul** | 50e percentile (`percentile_cont(0.5)`) de `valeur_fonciere` sur les ventes filtrées. |

### €/m² (bâti)

| | |
|---|---|
| **Valeur** | Prix au m² en € (ex. `4 200 €/m²`) |
| **Indice** | *Surface bâtie uniquement* |
| **?** | Prix médian au m² de surface bâtie, lorsque disponible. |
| **Calcul** | 50e percentile de `price_per_sqm_built` au niveau **vente** (id_mutation) : prix total / somme des surfaces bâties (maison ou appartement), pas par ligne DVF. |

### Période

| | |
|---|---|
| **Valeur** | Plage de dates (ex. `2020-01-15 → 2024-06-30`) |
| **Indice** | *Première à dernière vente* |
| **?** | Dates de vente la plus ancienne et la plus récente dans cette vue. |
| **Calcul** | `MIN` et `MAX` de `date_mutation` sur les ventes incluses dans le filtre. |

---

## Accessibilité

**Sous-titre :** Prix d'achat rapporté à la capacité d'emprunt locale  
**Source :** Homepedia (DVF + INSEE Filosofi + BCE + DGFiP) - *Croisement du prix médian de vente, du revenu médian des ménages et du taux de crédit habitat en vigueur.*  
**Composant UI :** `AffordabilityCard` (tableau de bord commune).

### Accessibilité

| | |
|---|---|
| **Valeur** | Multiplicateur (ex. `1,8×`) - ligne mise en avant, avec verdict *Accessible / Tendu / Peu accessible* |
| **Indice** | *Prix médian rapporté à la capacité d'emprunt. Plus bas = plus accessible* |
| **?** | Rapport entre le prix médian de vente de la commune et la capacité d'emprunt d'un ménage médian. Un ratio de 1,8× signifie que le prix médian représente 1,8 fois ce qu'un ménage médian peut emprunter. Plus le ratio est bas, plus le logement est accessible. |
| **Calcul** | `price_to_capacity_ratio` = prix médian de vente (`median_valeur_fonciere`) ÷ capacité d'emprunt (`borrowing_capacity_eur`). Le verdict découpe ce ratio en paliers *Accessible / Tendu / Peu accessible*. |

### Capacité d'emprunt

| | |
|---|---|
| **Valeur** | Montant en € (ex. `210 000 €`), avec le taux réel utilisé (ex. `3,10 %`) |
| **Indice** | *Montant empruntable par un ménage médian* |
| **?** | Estimation du capital qu'un ménage au revenu médian de la commune peut emprunter, sur 20 ans, au taux de crédit habitat en vigueur. |
| **Calcul** | `borrowing_capacity_eur` : mensualité soutenable = revenu médian × taux d'endettement (DTI, **35 %**) / 12, capitalisée sur `assumed_term_months` (**240 mois**) au taux mensuel `assumed_interest_rate`. Ce taux est le **taux mensuel RÉEL de la BCE** (série MIR crédits habitat France `M.FR.B.A2C.A.R.A.2250.EUR.N`, ex. `3,10 %`), et non un `0.035` codé en dur. |

### Prix médian de vente

| | |
|---|---|
| **Valeur** | Montant en € (ex. `250 000 €`) |
| **Indice** | *Prix de vente médian de la commune* |
| **?** | Prix de vente déclaré médian sur la commune, utilisé comme numérateur du ratio d'accessibilité. |
| **Calcul** | `median_valeur_fonciere` - médiane DVF de `valeur_fonciere` sur les ventes de la commune. |

### Taxe foncière

| | |
|---|---|
| **Valeur** | Pourcentage (ex. `24,5 %`) |
| **Indice** | *Charge annuelle récurrente* |
| **?** | Taux global de taxe foncière sur les propriétés bâties appliqué dans la commune : charge annuelle récurrente à prévoir après l'achat, en plus du remboursement du crédit. |
| **Calcul** | `property_tax_rate_pct` - taux global bâti publié par la **DGFiP**. |

---

## Indicateurs sociaux

**Sous-titre :** Revenus, pauvreté et inégalités  
**Source :** INSEE Filosofi - *Indicateurs de revenus, pauvreté et allocations familiales au niveau communal, publiés par l'INSEE.*  
**Détail source :** *Millésime de référence : {année}*

### Revenu médian

| | |
|---|---|
| **Valeur** | Montant en €/an (ex. `22 500 €`) |
| **Indice** | *€/an par ménage* |
| **?** | Revenu médian disponible des ménages de la commune (€ par an). |
| **Calcul** | Champ FiLoSoFi `med` - revenu médian disponible par unité de consommation. Dernier millésime par commune. |

### Taux de pauvreté

| | |
|---|---|
| **Valeur** | Pourcentage (ex. `14,2 %`) |
| **Indice** | *Sous le seuil de pauvreté* |
| **?** | Part des ménages sous le seuil de pauvreté national. |
| **Calcul** | Champ FiLoSoFi `tp60` - part de la population sous 60 % du niveau de vie médian national. |

### Inégalités

| | |
|---|---|
| **Valeur** | Multiplicateur (ex. `3,1×`) |
| **Indice** | *Un ratio plus faible signifie des revenus plus proches* - ou, si D1/D9 disponibles : *10 % modestes : {d1}/an · 10 % aisés : {d9}/an. Un ratio plus faible signifie des revenus plus proches* |
| **?** (sans montants D1/D9) | Ratio interdécile INSEE (D9/D1) : revenu des 10 % les plus aisés divisé par celui des 10 % les plus modestes. Les communes françaises se situent souvent entre 3 et 8, sans plafond fixe. Plus bas = plus égalitaire. |
| **?** (avec ratio seul) | Les 10 % les plus aisés gagnent environ {ratio} fois plus que les 10 % les plus modestes. Plus bas = mieux : vers 3, l'écart est modéré ; au-delà de 6, les inégalités sont marquées. |
| **?** (avec D1 et D9) | 10 % modestes : env. {d1}/an. 10 % aisés : env. {d9}/an (écart {ratio}×). Plus bas = mieux : un ratio plus faible signifie des revenus plus proches. |
| **Calcul** | Champ FiLoSoFi `rd` = **D9 / D1** (9e décile ÷ 1er décile du revenu par unité de consommation). Champs `d1` et `d9` pour les montants absolus. **Non utilisé** dans le score Mix social (affiché à part). |

### Bénéficiaires CAF

| | |
|---|---|
| **Valeur** | Pourcentage (ex. `18,5 %`) |
| **Indice** | *Part allocations familiales* - ou, si quartiers IRIS : *{n} quartier(s)* |
| **?** | Part des ménages bénéficiaires des allocations familiales (CAF). Si la commune a des zones IRIS : mention du détail par quartier disponible. |
| **Calcul** | Champ FiLoSoFi `pcaf` (`income_share_caf_pct`). Le nombre de quartiers IRIS vient d'un comptage séparé côté API. |

---

## Équipements publics

**Sous-titre :** Écoles, santé et commerces  
**Source :** Équipements publics (INSEE) - *Écoles, santé, commerces et loisirs ouverts aux habitants.*  
**Détail source :** *Millésime de référence : {année}*

### Total

| | |
|---|---|
| **Valeur** | Nombre entier |
| **Indice** | *Dans la commune* |
| **?** | Ensemble des équipements publics recensés dans la commune. |
| **Calcul** | `equipment_total_count` - décompte BPE de tous les équipements (toutes catégories). Alimente aussi le score **Équipements** du score d'opportunité. |

### Éducation

| | |
|---|---|
| **Valeur** | Nombre entier |
| **Indice** | *Écoles & bibliothèques* |
| **?** | Écoles, bibliothèques et équipements éducatifs similaires. |
| **Calcul** | `education_count` - filtre BPE `equipment_category = 'education'`. |

### Santé

| | |
|---|---|
| **Valeur** | Nombre entier |
| **Indice** | *Hôpitaux & pharmacies* |
| **?** | Hôpitaux, pharmacies et autres structures de soins. |
| **Calcul** | `health_count` - filtre BPE `equipment_category = 'health'`. |

### Commerces & loisirs

| | |
|---|---|
| **Valeur** | Nombre entier (somme affichée dans l'UI) |
| **Indice** | *Commerces & loisirs* |
| **?** | Commerces, loisirs et autres services de proximité. |
| **Calcul** | Somme frontend de `commerce_count` + `sport_count` + `other_count` (pas un champ unique en base). |

---

## Score d'opportunité

**Sous-titre :** Prix, mix social et équipements  
**Source :** Score Homepedia - *Classement combinant les prix immobiliers, les indicateurs sociaux et les équipements à proximité.*  
**Détail source :** *Dernier mois de référence : {mois}*

Tous les scores sont sur **0-100**. **Plus c'est élevé, mieux c'est.**

### Global

| | |
|---|---|
| **Valeur** | `{score} / 100` (ex. `58 / 100`) - ligne mise en avant |
| **Indice** | *Plus c'est élevé, mieux c'est* |
| **?** | Classement global de 0 à 100. Un score plus élevé indique une meilleure opportunité. |
| **Calcul** | Moyenne pondérée des trois dimensions ci-dessous. Poids par défaut : **Prix 50 %**, **Mix social 25 %**, **Équipements 25 %**. Les dimensions sans donnée sont exclues et les poids restants sont re-normalisés. |

```
composite = (0,50×prix + 0,25×mix + 0,25×équipements) / (somme des poids disponibles)
```

Exemple : prix = 80, mix = 60, pas d'équipements → `(0,50×80 + 0,25×60) / 0,75 ≈ 93`.

### Prix

| | |
|---|---|
| **Valeur** | `{score} / 100` |
| **Indice** | *Un score plus élevé signifie un logement plus abordable* |
| **?** (sans prix médian) | Score d'accessibilité de 0 à 100. Basé sur le prix de vente typique au m² dans la commune sur le mois, comparé à toutes les communes. Un score plus élevé signifie un logement plus abordable. |
| **?** (avec prix médian) | Prix de vente typique ce mois : {price} (médiane des ventes déclarées avec surface bâtie). Le score 0-100 classe l'accessibilité par rapport à toutes les communes. Un score plus élevé signifie un logement plus abordable. |
| **Calcul** | Source DVF, médiane €/m² du mois (`price_median_per_sqm`). Classement **dans le même mois** sur toutes les communes : |

```
price_rank = PERCENT_RANK() par mois, ordre croissant sur le prix au m²
price_score = 100 × (1 - price_rank)
```

Moins cher dans le mois → rang bas → **score proche de 100**.

### Mix social

| | |
|---|---|
| **Valeur** | `{score} / 100` |
| **Indice** | *Un score plus élevé signifie des revenus plus élevés, moins de pauvreté, une meilleure mixité sociale et moins de QPV* |
| **?** (sans données) | Score de 0 à 100. Classe la commune sur le revenu médian des ménages, le taux de pauvreté, la diversité des catégories socioprofessionnelles et la présence de quartiers prioritaires (QPV) par rapport à toutes les communes. Un score plus élevé signifie des revenus plus élevés, moins de pauvreté et une meilleure mixité sociale. |
| **?** (avec revenu et pauvreté) | Revenu médian : {income}/an. Taux de pauvreté : {poverty}. Le score 0-100 classe cette commune par rapport aux autres en tenant compte aussi de la diversité socioprofessionnelle et de la présence de QPV. Un score plus élevé signifie des revenus plus élevés, moins de pauvreté et une meilleure mixité sociale. |
| **Calcul** | Sources FiLoSoFi (dernier millésime), RP INSEE et ANCT. Le score combine **quatre composantes** classées sur **toutes les communes** : |

```
income_rank  = PERCENT_RANK() sur revenu médian (plus haut = mieux)
poverty_rank = PERCENT_RANK() sur taux de pauvreté (plus bas = mieux)
csp_rank     = PERCENT_RANK() sur csp_diversity_index
               (indice de Simpson des 6 CSP, RP INSEE ; plus divers = mieux)
qpv_component = faible présence de QPV (ANCT ; moins de QPV = mieux)

social_mix_score = combinaison de (income_rank, 1 - poverty_rank,
                   csp_rank, qpv_component)  → 0-100, plus élevé = mieux
```

Si une entrée manque, sa composante vaut 0,5 (neutre).

### Équipements

| | |
|---|---|
| **Valeur** | `{score} / 100` |
| **Indice** | *Un score plus élevé signifie plus d'équipements à proximité et une meilleure sécurité* |
| **?** (sans décompte) | Score de 0 à 100. Classe la commune sur ses équipements publics (écoles, santé, commerces, loisirs) et sa sécurité (taux de délinquance inversé) par rapport à toutes les communes. Un score plus élevé signifie plus d'équipements à proximité et une meilleure sécurité. |
| **?** (avec décompte) | Équipements publics dans la commune : {count}. Le score 0-100 classe cette commune par rapport aux autres en tenant compte aussi de la sécurité. Un score plus élevé signifie plus d'équipements à proximité et une meilleure sécurité. |
| **Calcul** | Sources BPE (`equipment_total_count`, même total que la carte Équipements publics) et SSMSI. Le score combine **deux composantes** classées sur toutes les communes : |

```
density_rank  = PERCENT_RANK() sur equipment_total_count (plus haut = mieux)
safety_rank   = indice inverse du taux de délinquance SSMSI
                (moins de délinquance = mieux)

quality_of_life_score = combinaison de (density_rank, safety_rank)
                        → 0-100, plus élevé = mieux
```

Plus d'équipements et moins de délinquance → score plus élevé.

---

## Historique prix / m²

**Sous-titre :** Médiane mensuelle au m²  
**Source :** DVF - *Prix médian mensuel de vente au m², issu des ventes immobilières déclarées.*

| | |
|---|---|
| **Graphique** | Courbe de la médiane €/m² par mois pour la commune |
| **Axe Y** | €/m² |
| **Série** | *Médiane / m²* |
| **Calcul** | Même logique que **€/m² (bâti)** sur la carte Marché immobilier, mais agrégée **mois par mois** (`app_city_housing_summary`, grain commune × mois). |

---

## Aide-mémoire présentation

1. **Commencer par le contexte** : commune sélectionnée, filtres actifs (type de bien, période).
2. **Marché immobilier** : chiffres bruts DVF (volume, prix, €/m²).
3. **Indicateurs sociaux** : profil social FiLoSoFi (revenus, pauvreté, inégalités D9/D1).
4. **Équipements publics** : décomptes BPE par catégorie.
5. **Score d'opportunité** : synthèse 0-100 - expliquer que c'est un **classement relatif** vs les autres communes, pas une note absolue.
6. **Historique** : tendance dans le temps sur le même indicateur €/m².

### `PERCENT_RANK()` (pour les questions techniques)

Fonction SQL utilisée pour les scores 0-100 : position relative entre 0 (plus bas) et 1 (plus haut) dans la distribution, avec gestion des ex æquo.
