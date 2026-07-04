import { apiGet } from "./client";
import type { MapTransactionPoint } from "./types";

export function fetchMapTransactions(params: {
  bbox: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<MapTransactionPoint[]> {
  return apiGet<MapTransactionPoint[]>("/map/transactions", params);
}
