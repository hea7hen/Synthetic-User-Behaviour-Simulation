// The orchestrator runs the multi-agent simulation:
//   1. one User agent per persona journey, plus no-persona Baseline agents,
//      working in parallel under a concurrency limit;
//   2. the Validator, which only lets agents take actions the journey allows;
//   3. the Insight Analyst, which reads the finished traces and reports friction.
// It has no UI or storage dependencies, so it can run in a browser or in tests.

import { computeAnalytics } from "./analytics";
import type { AgentBackend } from "./backend";
import { coerceAction } from "./fsm";
import { LlmError } from "./llm";
import { stateLabel } from "./scenarios";
import type { AgentRole, Persona, Scenario, Session, Simulation } from "./types";
import { abortError, isAbort } from "./util";

export interface RunOptions {
  concurrency: number;
  signal?: AbortSignal;
  onUpdate?: (sim: Simulation) => void;
}

/** Builds the queued sessions for a simulation: persona journeys and baseline journeys, interleaved. */
export function buildSessions(simId: string, personas: Persona[], runsPerPersona: number, baselineRuns: number): Session[] {
  const persona: Session[] = [];
  for (let r = 1; r <= runsPerPersona; r++)
    for (const p of personas)
      persona.push({
        id: `${simId}-${p.id}-r${r}`,
        condition: "persona",
        personaId: p.id,
        label: p.name,
        run: r,
        status: "queued",
        steps: [],
      });
  const baseline: Session[] = Array.from({ length: baselineRuns }, (_, i) => ({
    id: `${simId}-baseline-${i + 1}`,
    condition: "baseline",
    label: `Baseline agent ${i + 1}`,
    run: i + 1,
    status: "queued",
    steps: [],
  }));
  const out: Session[] = [];
  const max = Math.max(persona.length, baseline.length);
  for (let i = 0; i < max; i++) {
    if (persona[i]) out.push(persona[i]);
    if (baseline[i]) out.push(baseline[i]);
  }
  return out;
}

function snapshot(sim: Simulation): Simulation {
  return { ...sim, sessions: sim.sessions.map((s) => ({ ...s, steps: [...s.steps] })), log: [...sim.log] };
}

export async function runSimulation(
  input: Simulation,
  scenario: Scenario,
  backend: AgentBackend,
  opts: RunOptions,
): Promise<Simulation> {
  const sim = snapshot(input);
  const personaById = new Map(sim.personas.map((p) => [p.id, p]));
  const inner = new AbortController();
  const onOuterAbort = () => inner.abort();
  opts.signal?.addEventListener("abort", onOuterAbort, { once: true });
  if (opts.signal?.aborted) inner.abort();
  let fatal: Error | null = null;

  let lastEmit = 0;
  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < 150) return;
    lastEmit = now;
    opts.onUpdate?.(snapshot(sim));
  };
  const log = (agent: AgentRole, text: string) => {
    sim.log.push({ t: Date.now(), agent, text });
    if (sim.log.length > 400) sim.log.splice(0, sim.log.length - 400);
  };

  sim.status = "running";
  sim.startedAt = Date.now();
  sim.error = undefined;
  const personaCount = sim.sessions.filter((s) => s.condition === "persona").length;
  log(
    "orchestrator",
    `Starting ${personaCount} persona journeys and ${sim.sessions.length - personaCount} baseline journeys on "${scenario.name}" with up to ${opts.concurrency} agents at once.`,
  );
  emit(true);

  const runSession = async (session: Session) => {
    const persona = session.personaId ? personaById.get(session.personaId) : undefined;
    const role: AgentRole = session.condition;
    session.status = "running";
    session.startedAt = Date.now();
    let stateId = scenario.entry;
    session.currentStateId = stateId;
    emit();

    for (let i = 0; i < sim.maxSteps; i++) {
      if (inner.signal.aborted) throw abortError();
      const state = scenario.states[stateId];
      const started = Date.now();
      const raw = await backend.decide(
        { scenario, stateId, history: session.steps, persona, maxSteps: sim.maxSteps, seed: session.id },
        inner.signal,
      );
      sim.requests++;
      const { action, coerced } = coerceAction(raw.action, state.actions);
      session.steps.push({
        index: i,
        stateId,
        thought: raw.thought,
        requestedAction: raw.action,
        actionId: action.id,
        actionLabel: action.label,
        coerced,
        emotion: raw.emotion,
        factor: raw.factor,
        confidence: raw.confidence,
        nextStateId: action.to,
        latencyMs: Date.now() - started,
        elapsedMs: Date.now() - (session.startedAt ?? started),
      });
      if (coerced) {
        log("validator", `${session.label} asked for "${raw.action || "nothing"}" on ${state.label}, which is not allowed there. Mapped to "${action.label}".`);
      }
      log(role, `${session.label} on ${state.label}: ${action.label}.`);
      stateId = action.to;
      session.currentStateId = stateId;
      const terminal = scenario.terminals[stateId];
      if (terminal) {
        session.outcome = terminal.outcome;
        session.terminalStateId = stateId;
        break;
      }
      emit();
    }
    if (!session.outcome) session.outcome = "timeout";
    session.status = "done";
    session.endedAt = Date.now();
    log(
      role,
      `${session.label} finished: ${session.outcome === "timeout" ? "reached the step limit" : stateLabel(scenario, session.terminalStateId ?? "")} after ${session.steps.length} steps.`,
    );
    emit();
  };

  const queue = [...sim.sessions];
  const worker = async () => {
    while (queue.length && !inner.signal.aborted) {
      const session = queue.shift()!;
      try {
        await runSession(session);
      } catch (e) {
        if (isAbort(e)) {
          if (session.status === "running") session.status = "queued";
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        session.status = "error";
        session.outcome = "error";
        session.error = message;
        session.endedAt = Date.now();
        log("orchestrator", `${session.label} stopped with an error: ${message}`);
        if (e instanceof LlmError && e.fatal) {
          fatal = e;
          inner.abort();
          return;
        }
        emit();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, sim.sessions.length)) }, worker));

  const finish = (status: Simulation["status"], error?: string) => {
    opts.signal?.removeEventListener("abort", onOuterAbort);
    sim.status = status;
    sim.error = error;
    sim.endedAt = Date.now();
    emit(true);
    return snapshot(sim);
  };

  const finishedOk = sim.sessions.filter((s) => s.status === "done").length;
  if (fatal) {
    log("orchestrator", "Run stopped.");
    return finish("failed", (fatal as Error).message);
  }
  if (opts.signal?.aborted) {
    log("orchestrator", `Run cancelled. ${finishedOk} of ${sim.sessions.length} journeys had finished.`);
    return finish("cancelled");
  }
  if (finishedOk === 0) {
    const first = sim.sessions.find((s) => s.error)?.error;
    return finish("failed", first ?? "No journey finished.");
  }

  // Hand the finished traces to the Insight Analyst.
  sim.status = "analyzing";
  log("analyst", `Reading ${finishedOk} finished journeys.`);
  emit(true);
  try {
    const analytics = computeAnalytics(sim, scenario);
    sim.insights = await backend.analyze({ scenario, simulation: sim, analytics }, opts.signal);
    sim.requests++;
    sim.insightsError = undefined;
    log("analyst", `Reported ${sim.insights.frictionPoints.length} friction points.`);
  } catch (e) {
    if (isAbort(e)) {
      log("orchestrator", "Analysis cancelled. Journey results were kept.");
      return finish("cancelled");
    }
    sim.insightsError = e instanceof Error ? e.message : String(e);
    log("analyst", `Could not write insights: ${sim.insightsError}`);
  }
  log("orchestrator", "Run complete.");
  return finish("completed");
}
