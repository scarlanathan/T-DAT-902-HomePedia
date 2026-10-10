import type { MessageKey } from "@/lib/i18n";

/**
 * External market consensus, compiled by hand (figures as of 2026-10-10).
 * Values are fixed; labels and notes are translated.
 */
export type ConsensusUnit = "pct" | "signedPct" | "count";

export type ConsensusItem = {
  id: string;
  labelKey: MessageKey;
  value: number;
  /** Upper bound when the source gives a range (e.g. +2 to +3 %). */
  valueMax?: number;
  unit: ConsensusUnit;
  noteKey?: MessageKey;
  source: string;
  /** Publication date (or data month), YYYY-MM-DD. */
  date: string;
  /** Show only month and year (source gives no exact day). */
  monthOnly?: boolean;
  url?: string;
  /** observed = measured price change, forecast = third-party outlook, market = volumes & rates. */
  kind: "observed" | "forecast" | "market";
};

export const CONSENSUS_AS_OF = "2026-10-10";

export const FORECAST_CONSENSUS: ConsensusItem[] = [
  {
    id: "notairesInsee",
    kind: "observed",
    labelKey: "forecast.consensus.items.notairesInsee",
    noteKey: "forecast.consensus.items.notairesInseeNote",
    value: -0.8,
    unit: "signedPct",
    source: "Indice Notaires-Insee (T2 2026)",
    date: "2026-09-08",
    url: "https://www.insee.fr/fr/statistiques/9040119",
  },
  {
    id: "avantContrats",
    kind: "observed",
    labelKey: "forecast.consensus.items.avantContrats",
    noteKey: "forecast.consensus.items.avantContratsNote",
    value: -0.6,
    unit: "signedPct",
    source: "Notaires de France, note de conjoncture n°72",
    date: "2026-07-01",
    monthOnly: true,
    url: "https://www.notaires.fr/fr/immobilier-fiscalite/etudes-et-analyses-immobilieres",
  },
  {
    id: "volumes",
    kind: "market",
    labelKey: "forecast.consensus.items.volumes",
    noteKey: "forecast.consensus.items.volumesNote",
    value: 958000,
    unit: "count",
    source: "Insee",
    date: "2026-09-08",
    url: "https://www.insee.fr/fr/statistiques/9040119",
  },
  {
    id: "creditRate",
    kind: "market",
    labelKey: "forecast.consensus.items.creditRate",
    noteKey: "forecast.consensus.items.creditRateNote",
    value: 3.31,
    unit: "pct",
    source: "Observatoire Crédit Logement/CSA",
    date: "2026-08-01",
    monthOnly: true,
    url: "https://www.lobservatoirecreditlogement.fr/",
  },
  {
    id: "usury",
    kind: "market",
    labelKey: "forecast.consensus.items.usury",
    noteKey: "forecast.consensus.items.usuryNote",
    value: 5.4,
    unit: "pct",
    source: "Banque de France",
    date: "2026-10-01",
    monthOnly: true,
    url: "https://www.banque-france.fr/fr/statistiques/taux-et-cours/taux-dusure",
  },
  {
    id: "ecb",
    kind: "market",
    labelKey: "forecast.consensus.items.ecb",
    noteKey: "forecast.consensus.items.ecbNote",
    value: 2.5,
    unit: "pct",
    source: "BCE",
    date: "2026-09-10",
    url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html",
  },
  {
    id: "sp",
    kind: "forecast",
    labelKey: "forecast.consensus.items.sp",
    noteKey: "forecast.consensus.items.spNote",
    value: 1.4,
    unit: "signedPct",
    source: "S&P Global Ratings",
    date: "2026-07-13",
    url: "https://www.spglobal.com/ratings/",
  },
  {
    id: "creditAgricole",
    kind: "forecast",
    labelKey: "forecast.consensus.items.creditAgricole",
    noteKey: "forecast.consensus.items.creditAgricoleNote",
    value: 0.8,
    unit: "signedPct",
    source: "Crédit Agricole S.A. (études économiques)",
    date: "2026-06-05",
    url: "https://etudes-economiques.credit-agricole.com/",
  },
  {
    id: "seloger",
    kind: "forecast",
    labelKey: "forecast.consensus.items.seloger",
    noteKey: "forecast.consensus.items.selogerNote",
    value: 2,
    valueMax: 3,
    unit: "signedPct",
    source: "SeLoger-Meilleurs Agents",
    date: "2026-09-02",
    url: "https://www.meilleursagents.com/",
  },
];
