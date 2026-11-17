"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ModelInfo } from "./engine/llm";
import type { Persona, Simulation } from "./engine/types";

export interface Settings {
  apiKey: string;
  model: string;
  models: ModelInfo[];
  requestsPerMinute: number;
  concurrency: number;
  temperature: number;
  displayName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "",
  models: [],
  requestsPerMinute: 15,
  concurrency: 5,
  temperature: 0.9,
  displayName: "",
};

interface State {
  settings: Settings;
  personas: Persona[];
  simulations: Simulation[];
  updateSettings: (patch: Partial<Settings>) => void;
  addPersonas: (list: Persona[]) => void;
  removePersona: (id: string) => void;
  upsertSimulation: (sim: Simulation) => void;
  removeSimulation: (id: string) => void;
  clearData: () => void;
}

const MAX_SIMULATIONS = 30;

export const useStore = create<State>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      personas: [],
      simulations: [],
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      addPersonas: (list) => set((s) => ({ personas: [...s.personas, ...list] })),
      removePersona: (id) => set((s) => ({ personas: s.personas.filter((p) => p.id !== id) })),
      upsertSimulation: (sim) =>
        set((s) => {
          const exists = s.simulations.some((x) => x.id === sim.id);
          const next = exists ? s.simulations.map((x) => (x.id === sim.id ? sim : x)) : [sim, ...s.simulations];
          return { simulations: next.slice(0, MAX_SIMULATIONS) };
        }),
      removeSimulation: (id) => set((s) => ({ simulations: s.simulations.filter((x) => x.id !== id) })),
      // Clears personas and runs. The API key and settings are kept.
      clearData: () => set({ personas: [], simulations: [] }),
    }),
    {
      name: "subs-store-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings, personas: s.personas, simulations: s.simulations }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
          // A run lives in the page's memory. If the page was reloaded mid-run, say so.
          simulations: (p.simulations ?? []).map((sim) =>
            sim.status === "running" || sim.status === "queued" || sim.status === "analyzing"
              ? {
                  ...sim,
                  status: "failed" as const,
                  error: "The page was closed or reloaded while this run was in progress. Journeys that had finished were kept.",
                  endedAt: sim.endedAt ?? Date.now(),
                  sessions: sim.sessions.map((s) => (s.status === "running" ? { ...s, status: "queued" as const } : s)),
                }
              : sim,
          ),
        };
      },
    },
  ),
);

export function hasKey(settings: Settings): boolean {
  return settings.apiKey.trim().length > 0 && settings.model.trim().length > 0;
}
