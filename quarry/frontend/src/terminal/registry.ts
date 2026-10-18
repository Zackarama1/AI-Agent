import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import type { Registry } from "./types";

const EMPTY: Registry = { functions: [], market_suffixes: {}, sector_suffixes: {} };

/** The function registry from /api/functions (cached; it only changes on deploy). */
export function useRegistry(): { registry: Registry; ready: boolean; error: boolean } {
  const q = useQuery({
    queryKey: ["functions"],
    queryFn: api.functions,
    staleTime: Infinity,
    retry: 2,
  });
  return {
    registry: q.data ? (q.data as Registry) : EMPTY,
    ready: q.isSuccess,
    error: q.isError,
  };
}
