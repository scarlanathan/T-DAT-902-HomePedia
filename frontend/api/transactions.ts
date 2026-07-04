import { apiGet } from "./client";
import type { TransactionRow } from "./types";

export function fetchTransactions(params: {
  code_commune?: string;
  from?: string;
  to?: string;
  type_local?: string;
  limit?: number;
  include_location?: boolean;
}): Promise<TransactionRow[]> {
  const { include_location = true, ...rest } = params;
  return apiGet<TransactionRow[]>("/transactions", {
    ...rest,
    include_location: include_location ? "true" : "false",
  });
}
