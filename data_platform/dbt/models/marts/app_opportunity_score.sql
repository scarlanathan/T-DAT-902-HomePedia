{{
  config(
    materialized='table',
    tags=['app', 'score'],
  )
}}

/*
  Mart "opportunity score" - grain commune × period_month.

  Score composite (0-100) pondérant 3 dimensions normalisées :
    - price_score            (DVF, rang percentile inversé du prix médian €/m² par mois)
    - social_mix_score       (FiLoSoFi revenu + pauvreté, mixité CSP RP, présence QPV)
    - quality_of_life_score  (densité d'équipements BPE + sécurité SSMSI)

  Capacité d'emprunt réelle (borrow_dim) :
    - assumed_interest_rate  = taux mensuel BCE/BdF (housing_loan_rate) pour le mois,
                               à défaut var('assumed_interest_rate').
    - borrowing_capacity_eur = mensualité soutenable (revenu médian × DTI / 12) capitalisée
                               sur assumed_term_months au taux mensuel.
    - price_to_capacity_ratio= prix médian de vente / capacité d'emprunt.

  Les dimensions NULL sont exclues du dénominateur - le score reste calculable
  avec une seule dimension disponible. Poids surchargeables via vars dbt :
    dbt run --vars '{w_price: 0.6, w_social: 0.2, w_quality: 0.2}'
*/

WITH base AS (
    SELECT
        code_commune,
        nom_commune,
        period_month,
        sale_line_count,
        median_valeur_fonciere,
        median_price_per_sqm_built AS price_median_per_sqm
    FROM {{ ref('app_city_housing_summary') }}
),

months AS (
    SELECT DISTINCT period_month FROM base
),

price_dim AS (
    SELECT
        code_commune,
        period_month,
        100.0 * (1.0 - PERCENT_RANK() OVER (
            PARTITION BY period_month
            ORDER BY price_median_per_sqm
        )) AS price_score
    FROM base
    WHERE price_median_per_sqm IS NOT NULL
),

-- ---- Social dimension: income + poverty (FiLoSoFi) + CSP mix (RP) + QPV (ANCT) ----
social_base AS (
    SELECT
        soc.code_commune,
        soc.median_income_eur,
        soc.poverty_rate,
        soc.inequality_ratio,
        csp.csp_diversity_index,
        COALESCE(qpv.qpv_count, 0) AS qpv_count
    FROM {{ ref('app_city_social_summary') }} soc
    LEFT JOIN {{ ref('normalized_rp_csp_commune') }} csp ON csp.code_commune = soc.code_commune
    LEFT JOIN {{ ref('normalized_qpv_commune') }} qpv ON qpv.code_commune = soc.code_commune
),

social_ranked AS (
    SELECT
        code_commune,
        median_income_eur,
        poverty_rate,
        inequality_ratio,
        csp_diversity_index,
        qpv_count,
        PERCENT_RANK() OVER (ORDER BY median_income_eur)    AS income_rank,
        PERCENT_RANK() OVER (ORDER BY poverty_rate)         AS poverty_rank,
        PERCENT_RANK() OVER (ORDER BY csp_diversity_index)  AS csp_rank,
        PERCENT_RANK() OVER (ORDER BY qpv_count)            AS qpv_rank
    FROM social_base
    WHERE median_income_eur IS NOT NULL
       OR poverty_rate IS NOT NULL
),

social_dim AS (
    SELECT
        b.code_commune,
        m.period_month,
        b.median_income_eur,
        b.poverty_rate,
        b.csp_diversity_index,
        b.qpv_count AS qpv_share,
        CASE
            WHEN b.median_income_eur IS NULL AND b.poverty_rate IS NULL THEN NULL
            ELSE 100.0 * (
                0.35 * COALESCE(b.income_rank, 0.5)
              + 0.30 * (1.0 - COALESCE(b.poverty_rank, 0.5))
              + 0.20 * COALESCE(b.csp_rank, 0.5)
              + 0.15 * (1.0 - COALESCE(b.qpv_rank, 0.0))
            )
        END AS social_mix_score
    FROM social_ranked b
    CROSS JOIN months m
),

-- ---- Quality of life: equipment density (BPE) + safety (SSMSI) ----
equipment_ranked AS (
    SELECT
        code_commune,
        equipment_total_count,
        PERCENT_RANK() OVER (ORDER BY equipment_total_count) AS density_rank
    FROM {{ ref('app_city_equipment_summary') }}
    WHERE equipment_total_count > 0
),

crime_ranked AS (
    SELECT
        code_commune,
        total_crime_rate_per_1000,
        PERCENT_RANK() OVER (ORDER BY total_crime_rate_per_1000) AS crime_rank
    FROM {{ ref('normalized_delinquance_commune') }}
    WHERE total_crime_rate_per_1000 IS NOT NULL
),

quality_dim AS (
    SELECT
        e.code_commune,
        m.period_month,
        e.equipment_total_count AS equipment_density,
        CAST(NULL AS NUMERIC) AS transit_accessibility,
        CASE WHEN c.crime_rank IS NOT NULL THEN 100.0 * (1.0 - c.crime_rank) END AS safety_index,
        (
            0.60 * 100.0 * e.density_rank
          + COALESCE(0.40 * 100.0 * (1.0 - c.crime_rank), 0)
        ) / (0.60 + CASE WHEN c.crime_rank IS NOT NULL THEN 0.40 ELSE 0 END) AS quality_of_life_score
    FROM equipment_ranked e
    CROSS JOIN months m
    LEFT JOIN crime_ranked c ON c.code_commune = e.code_commune
),

-- ---- Property tax (DGFiP) — recurring holding cost ----
tax_dim AS (
    SELECT
        code_commune,
        taux_global_tfb_pct AS property_tax_rate_pct
    FROM {{ ref('normalized_taxe_fonciere_commune') }}
),

-- ---- Borrowing capacity: real monthly rate (BCE/BdF) × median income ----
rate_dim AS (
    SELECT rate_month, housing_loan_rate_pct
    FROM {{ ref('normalized_interest_rate_monthly') }}
),

borrow_dim AS (
    SELECT
        b.code_commune,
        b.period_month,
        b.median_valeur_fonciere,
        COALESCE(r.housing_loan_rate_pct / 100.0, {{ var('assumed_interest_rate', 0.035) }})
            AS assumed_interest_rate,
        CAST({{ var('assumed_term_months', 240) }} AS INT) AS assumed_term_months,
        CAST({{ var('assumed_max_dti', 0.35) }} AS NUMERIC) AS assumed_max_dti,
        sr.median_income_eur
    FROM base b
    LEFT JOIN rate_dim r ON r.rate_month = b.period_month
    LEFT JOIN social_ranked sr ON sr.code_commune = b.code_commune
),

borrow_calc AS (
    SELECT
        code_commune,
        period_month,
        assumed_interest_rate,
        assumed_term_months,
        assumed_max_dti,
        median_income_eur,
        median_valeur_fonciere,
        (assumed_interest_rate / 12.0) AS monthly_rate,
        (median_income_eur / 12.0) * assumed_max_dti AS max_monthly_payment
    FROM borrow_dim
),

borrow_final AS (
    SELECT
        code_commune,
        period_month,
        assumed_interest_rate,
        assumed_term_months,
        assumed_max_dti,
        CASE
            WHEN median_income_eur IS NULL OR monthly_rate IS NULL OR monthly_rate <= 0 THEN NULL
            ELSE max_monthly_payment
                 * (1.0 - power(1.0 + monthly_rate, -assumed_term_months))
                 / monthly_rate
        END AS borrowing_capacity_eur,
        median_valeur_fonciere
    FROM borrow_calc
)

SELECT
    b.code_commune,
    b.nom_commune,
    b.period_month,
    b.sale_line_count,
    b.median_valeur_fonciere,
    b.price_median_per_sqm,
    s.median_income_eur,
    s.poverty_rate,
    s.csp_diversity_index,
    s.qpv_share,
    q.equipment_density,
    q.transit_accessibility,
    q.safety_index,
    t.property_tax_rate_pct,
    bo.assumed_interest_rate,
    bo.assumed_term_months,
    bo.assumed_max_dti,
    bo.borrowing_capacity_eur,
    CASE
        WHEN bo.borrowing_capacity_eur IS NULL OR bo.borrowing_capacity_eur <= 0 THEN NULL
        ELSE b.median_valeur_fonciere / bo.borrowing_capacity_eur
    END AS price_to_capacity_ratio,
    p.price_score,
    s.social_mix_score,
    q.quality_of_life_score,
    (
        COALESCE(p.price_score           * {{ var('w_price',   0.50) }}, 0)
      + COALESCE(s.social_mix_score      * {{ var('w_social',  0.25) }}, 0)
      + COALESCE(q.quality_of_life_score * {{ var('w_quality', 0.25) }}, 0)
    ) / NULLIF(
        CASE WHEN p.price_score           IS NOT NULL THEN {{ var('w_price',   0.50) }} ELSE 0 END
      + CASE WHEN s.social_mix_score      IS NOT NULL THEN {{ var('w_social',  0.25) }} ELSE 0 END
      + CASE WHEN q.quality_of_life_score IS NOT NULL THEN {{ var('w_quality', 0.25) }} ELSE 0 END
    , 0) AS composite_score
FROM base b
LEFT JOIN price_dim   p  ON p.code_commune  = b.code_commune AND p.period_month  = b.period_month
LEFT JOIN social_dim  s  ON s.code_commune  = b.code_commune AND s.period_month  = b.period_month
LEFT JOIN quality_dim q  ON q.code_commune  = b.code_commune AND q.period_month  = b.period_month
LEFT JOIN tax_dim     t  ON t.code_commune  = b.code_commune
LEFT JOIN borrow_final bo ON bo.code_commune = b.code_commune AND bo.period_month = b.period_month
