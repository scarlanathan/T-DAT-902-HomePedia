"use client";

import { useEffect, useState } from "react";
import { listAllLocationsByDepartment } from "@/api";
import type { LocationRow } from "@/api";
import { COMMUNE_LOAD_ERROR_KEY } from "@/components/CommunePicker";

export function useDepartmentCommunes(codeDepartement?: string) {
  const [communes, setCommunes] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codeDepartement) {
      setCommunes([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listAllLocationsByDepartment(codeDepartement)
      .then((rows) => {
        if (!cancelled) setCommunes(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setCommunes([]);
          setError(COMMUNE_LOAD_ERROR_KEY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [codeDepartement]);

  return { communes, loading, error };
}
