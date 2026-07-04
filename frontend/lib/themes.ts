import type { MessageKey } from "@/lib/i18n";

/**
 * Curated thematic shortcuts for commune discovery. Commune names are proper
 * nouns (not translated); the theme label is an i18n key. Codes are INSEE
 * commune codes with good DVF coverage (single communes, no arrondissement).
 */
export type ThemeCommune = { code: string; nom: string };

export type Theme = {
  id: string;
  labelKey: MessageKey;
  emoji: string;
  communes: ThemeCommune[];
};

export const THEMES: Theme[] = [
  {
    id: "seaside",
    labelKey: "themes.seaside",
    emoji: "🌊",
    communes: [
      { code: "64122", nom: "Biarritz" },
      { code: "17300", nom: "La Rochelle" },
      { code: "35288", nom: "Saint-Malo" },
      { code: "34301", nom: "Sète" },
      { code: "06029", nom: "Cannes" },
    ],
  },
  {
    id: "mountain",
    labelKey: "themes.mountain",
    emoji: "⛰️",
    communes: [
      { code: "74010", nom: "Annecy" },
      { code: "38185", nom: "Grenoble" },
      { code: "74056", nom: "Chamonix-Mont-Blanc" },
      { code: "05061", nom: "Gap" },
      { code: "73011", nom: "Albertville" },
    ],
  },
  {
    id: "metropolis",
    labelKey: "themes.metropolis",
    emoji: "🏙️",
    communes: [
      { code: "33063", nom: "Bordeaux" },
      { code: "31555", nom: "Toulouse" },
      { code: "44109", nom: "Nantes" },
      { code: "59350", nom: "Lille" },
      { code: "67482", nom: "Strasbourg" },
    ],
  },
  {
    id: "student",
    labelKey: "themes.student",
    emoji: "🎓",
    communes: [
      { code: "34172", nom: "Montpellier" },
      { code: "35238", nom: "Rennes" },
      { code: "86194", nom: "Poitiers" },
      { code: "21231", nom: "Dijon" },
      { code: "63113", nom: "Clermont-Ferrand" },
    ],
  },
  {
    id: "overseas",
    labelKey: "themes.overseas",
    emoji: "🌴",
    communes: [
      { code: "97209", nom: "Fort-de-France" },
      { code: "97411", nom: "Saint-Denis (La Réunion)" },
      { code: "97120", nom: "Pointe-à-Pitre" },
      { code: "97302", nom: "Cayenne" },
      { code: "97611", nom: "Mamoudzou" },
    ],
  },
];
