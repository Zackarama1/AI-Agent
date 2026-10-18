import { useSyncExternalStore } from "react";

import type { FormFactor } from "../api/client";

// Touch-first devices (iPad, phones) and narrow windows get the tablet layout:
// docking by drag is awkward on glass, fixed panes are not.
const QUERY = "(pointer: coarse), (max-width: 899px)";
const OVERRIDE_KEY = "quarry.formFactor";

function readStored(): string | null {
  try {
    return localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

function override(): FormFactor | null {
  const v = new URLSearchParams(window.location.search).get("ff") ?? readStored();
  return v === "desktop" || v === "tablet" ? v : null;
}

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function snapshot(): FormFactor {
  return override() ?? (window.matchMedia(QUERY).matches ? "tablet" : "desktop");
}

export function useFormFactor(): FormFactor {
  return useSyncExternalStore(subscribe, snapshot, () => "desktop");
}
