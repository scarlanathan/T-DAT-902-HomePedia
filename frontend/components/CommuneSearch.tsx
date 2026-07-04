"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { searchLocations, type LocationRow } from "@/api";
import { IconSearch } from "@/components/ui/icons";
import { inputClassName } from "@/components/ui/field-styles";
import { communePostalCode, formatCommuneLabel } from "@/lib/commune-display";
import { useLocale } from "@/lib/locale-context";

type Props = {
  codeCommune: string;
  nomCommune: string;
  codePostal?: string;
  onSelect: (loc: LocationRow) => void;
  onClear?: () => void;
};

export function CommuneSearch({
  codeCommune,
  nomCommune,
  codePostal,
  onSelect,
  onClear,
}: Props) {
  const { t } = useLocale();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!codeCommune) {
      setQuery("");
      return;
    }
    setQuery(
      formatCommuneLabel({
        nom_commune: nomCommune,
        code_postal: codePostal ?? null,
        code_commune: codeCommune,
      }),
    );
  }, [codeCommune, nomCommune, codePostal]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchLocations(trimmed, 15);
      setResults(rows);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onInputChange = (value: string) => {
    setQuery(value);
    if (value === "") {
      setResults([]);
      setOpen(false);
      if (codeCommune) onClear?.();
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(value), 280);
  };

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-ink-400">
          <IconSearch />
        </span>
        <input
          type="search"
          className={`${inputClassName} pl-10`}
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder={t("communeSearch.placeholder")}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && results.length > 0}
        />
        {open && results.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-auto rounded-xl border border-ink-200/90 bg-white py-1 text-base shadow-elevated ring-1 ring-ink-200/50 dark:border-ink-700/90 dark:bg-ink-900 dark:ring-ink-700/50"
          >
            {results.map((loc) => (
              <li key={loc.location_id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="w-full px-4 py-3 text-left transition hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(loc);
                    setQuery(formatCommuneLabel(loc));
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-ink-900 dark:text-ink-50">
                    {loc.nom_commune ?? t("common.emDash")}
                  </span>{" "}
                  <span className="text-ink-500">
                    ({communePostalCode(loc)})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {searching ? (
        <span className="text-sm text-ink-500">{t("communeSearch.searching")}</span>
      ) : null}
    </label>
  );
}
