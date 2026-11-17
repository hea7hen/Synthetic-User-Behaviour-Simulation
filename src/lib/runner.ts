"use client";

// Runs simulations in the browser and writes progress to the store. A run keeps
// going while you move between pages, and stops if the tab is closed or reloaded.

import { GeminiBackend, type AgentBackend } from "./engine/backend";
import { DemoBackend } from "./engine/demo";
import { buildSessions, runSimulation } from "./engine/orchestrator";
import { getScenario } from "./engine/scenarios";
import type { EngineKind, Persona, Simulation } from "./engine/types";
import { uid } from "./engine/util";
import { currentEngine, useStore, type Settings } from "./store";

const controllers = new Map<string, AbortController>();

export function makeBackend(engine: EngineKind, settings: Settings): AgentBackend {
  if (engine === "gemini") {
    return new GeminiBackend({
      apiKey: settings.apiKey.trim(),
      model: settings.model,
      temperature: settings.temperature,
      requestsPerMinute: settings.requestsPerMinute,
      concurrency: settings.concurrency,
    });
  }
  return new DemoBackend();
}

export interface SimulationConfig {
  name: string;
  scenarioId: string;
  personas: Persona[];
  runsPerPersona: number;
  baselineRuns: number;
  maxSteps: number;
  engine: EngineKind;
}

export function createSimulation(config: SimulationConfig, settings: Settings): Simulation {
  const id = uid("sim");
  return {
    id,
    name: config.name,
    scenarioId: config.scenarioId,
    personas: config.personas,
    runsPerPersona: config.runsPerPersona,
    baselineRuns: config.baselineRuns,
    maxSteps: config.maxSteps,
    engine: config.engine,
    model: config.engine === "gemini" ? settings.model : undefined,
    status: "queued",
    createdAt: Date.now(),
    sessions: buildSessions(id, config.personas, config.runsPerPersona, config.baselineRuns),
    log: [],
    requests: 0,
  };
}

export function startSimulation(sim: Simulation): void {
  const { settings, upsertSimulation } = useStore.getState();
  upsertSimulation(sim);
  const controller = new AbortController();
  controllers.set(sim.id, controller);
  runSimulation(sim, getScenario(sim.scenarioId), makeBackend(sim.engine, settings), {
    concurrency: settings.concurrency,
    signal: controller.signal,
    onUpdate: (next) => useStore.getState().upsertSimulation(next),
  })
    .then((final) => useStore.getState().upsertSimulation(final))
    .catch((e: unknown) =>
      useStore.getState().upsertSimulation({
        ...sim,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
        endedAt: Date.now(),
      }),
    )
    .finally(() => controllers.delete(sim.id));
}

export function cancelSimulation(id: string): void {
  controllers.get(id)?.abort();
}

/** Starts a fresh run with the same setup as an earlier one. */
export function rerunSimulation(prev: Simulation): Simulation {
  const settings = useStore.getState().settings;
  const sim = createSimulation(
    {
      name: prev.name,
      scenarioId: prev.scenarioId,
      personas: prev.personas,
      runsPerPersona: prev.runsPerPersona,
      baselineRuns: prev.baselineRuns,
      maxSteps: prev.maxSteps,
      engine: currentEngine(settings),
    },
    settings,
  );
  startSimulation(sim);
  return sim;
}

export function estimateCalls(personaCount: number, runsPerPersona: number, baselineRuns: number, funnelLength: number) {
  const journeys = personaCount * runsPerPersona + baselineRuns;
  // Journeys usually take a step or two more than the shortest path.
  const calls = Math.round(journeys * (funnelLength + 1)) + 1;
  return { journeys, calls };
}
