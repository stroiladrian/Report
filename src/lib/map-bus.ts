"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny bridge between the header (which shows the map's search / locate buttons on the home screen)
 * and the map explorer below it. Keeps both components independent.
 */
type State = { explorer: boolean; filterCount: number };
let state: State = { explorer: false, filterCount: 0 };
const subs = new Set<() => void>();

export const mapBus = {
  set(patch: Partial<State>) {
    state = { ...state, ...patch };
    subs.forEach((s) => s());
  },
  emit(event: "filters" | "locate") {
    window.dispatchEvent(new CustomEvent(`cr:map-${event}`));
  },
  on(event: "filters" | "locate", cb: () => void) {
    const h = () => cb();
    window.addEventListener(`cr:map-${event}`, h);
    return () => window.removeEventListener(`cr:map-${event}`, h);
  },
};

const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => subs.delete(cb);
};
const SERVER: State = { explorer: false, filterCount: 0 };

export function useMapBus(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
