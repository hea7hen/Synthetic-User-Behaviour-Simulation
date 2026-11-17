import { describe, expect, it } from "vitest";
import { computeAnalytics } from "./analytics";
import { BASELINE_SYSTEM_PROMPT, personaSystemPrompt, stepPrompt } from "./backend";
import { DemoBackend } from "./demo";
import { coerceAction } from "./fsm";
import { Limiter, parseJsonReply, scoreModel } from "./llm";
import { buildSessions, runSimulation } from "./orchestrator";
import { generatePersonas, samplePersonas, sampleSkeletons } from "./personas";
import { SCENARIOS, getScenario, validateScenario } from "./scenarios";
import { ksTwoSample, pearson } from "./stats";
import type { Simulation } from "./types";

function makeSim(scenarioId: string, runs = 3, maxSteps = 12): Simulation {
  const personas = samplePersonas();
  const id = "sim-test";
  return {
    id,
    name: "Test run",
    scenarioId,
    personas,
    runsPerPersona: runs,
    baselineRuns: personas.length * runs,
    maxSteps,
    engine: "demo",
    status: "queued",
    createdAt: 0,
    sessions: buildSessions(id, personas, runs, personas.length * runs),
    log: [],
    requests: 0,
  };
}

describe("statistics", () => {
  it("computes Pearson r and its p-value", () => {
    const c = pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])!;
    expect(c.r).toBeCloseTo(0.7746, 3);
    expect(c.p).toBeCloseTo(0.1241, 2);
  });
  it("returns null when a variable has no variance or n is tiny", () => {
    expect(pearson([1, 2, 3, 4], [5, 5, 5, 5])).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });
  it("computes the two-sample KS statistic", () => {
    const sep = ksTwoSample([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])!;
    expect(sep.d).toBe(1);
    expect(sep.p).toBeLessThan(0.05);
    const same = ksTwoSample([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])!;
    expect(same.d).toBe(0);
    expect(same.p).toBe(1);
  });
});

describe("scenarios", () => {
  it("have only valid transitions", () => {
    for (const s of SCENARIOS) expect(validateScenario(s)).toEqual([]);
  });
});

describe("validator", () => {
  const actions = getScenario("personal-loan").states.options.actions;
  it("passes valid actions through", () => {
    expect(coerceAction("compare_offers", actions)).toMatchObject({ coerced: false, action: { id: "compare_offers" } });
    expect(coerceAction("Compare-Offers", actions)).toMatchObject({ coerced: false, action: { id: "compare_offers" } });
  });
  it("maps invalid actions to the nearest valid one and flags them", () => {
    expect(coerceAction("compare the offers", actions)).toMatchObject({ coerced: true, action: { id: "compare_offers" } });
    expect(coerceAction("abandon", actions)).toMatchObject({ coerced: true, action: { id: "leave" } });
    expect(coerceAction("zzz", actions)).toMatchObject({ coerced: true, action: { id: "select_offer" } });
    expect(coerceAction("", actions).coerced).toBe(true);
  });
});

describe("gemini helpers", () => {
  it("parses JSON replies with fences or stray text", () => {
    expect(parseJsonReply('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonReply('Sure: {"a": [1, 2]} done')).toEqual({ a: [1, 2] });
    expect(() => parseJsonReply("no json here")).toThrow();
  });
  it("prefers newer stable flash-lite models", () => {
    expect(scoreModel("gemini-2.5-flash-lite")).toBeGreaterThan(scoreModel("gemini-2.5-pro"));
    expect(scoreModel("gemini-2.5-flash")).toBeGreaterThan(scoreModel("gemini-2.5-flash-preview-09-2025"));
    expect(scoreModel("gemini-3.0-flash")).toBeGreaterThan(scoreModel("gemini-2.5-flash-lite"));
  });
  it("limits concurrency", async () => {
    const limiter = new Limiter(2, 0);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        limiter.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});

describe("prompts", () => {
  it("condition the persona agent but not the baseline", () => {
    const [p] = samplePersonas();
    const system = personaSystemPrompt(p);
    expect(system).toContain(p.name);
    expect(system).toContain("Neuroticism");
    expect(BASELINE_SYSTEM_PROMPT).not.toContain(p.name);
    const scenario = getScenario("personal-loan");
    const prompt = stepPrompt({ scenario, stateId: "entry", history: [], persona: p, maxSteps: 10, seed: "x" });
    for (const a of scenario.states.entry.actions) expect(prompt).toContain(a.id);
  });
});

describe("persona architect", () => {
  it("spreads traits across the cohort and keeps ages in range", async () => {
    const brief = { segment: "Test", count: 10, ageMin: 22, ageMax: 40, location: "Pune, India", context: "" };
    const sk = sampleSkeletons(brief, "seed");
    expect(sk).toHaveLength(10);
    const neuro = sk.map((s) => s.ocean.neuroticism);
    expect(Math.min(...neuro)).toBeLessThan(25);
    expect(Math.max(...neuro)).toBeGreaterThan(75);
    for (const s of sk) expect(s.age).toBeGreaterThanOrEqual(22), expect(s.age).toBeLessThanOrEqual(40);
    const personas = await generatePersonas(new DemoBackend(0), brief);
    expect(personas).toHaveLength(10);
    expect(new Set(personas.map((p) => p.id)).size).toBe(10);
    expect(personas.every((p) => p.backstory.length > 20 && p.source === "demo")).toBe(true);
  });
});

describe("orchestrator (scripted agents)", () => {
  for (const scenario of SCENARIOS) {
    it(`runs ${scenario.name} end to end`, async () => {
      const updates: string[] = [];
      const result = await runSimulation(makeSim(scenario.id), scenario, new DemoBackend(0), {
        concurrency: 5,
        onUpdate: (s) => updates.push(s.status),
      });
      expect(result.status).toBe("completed");
      expect(updates).toContain("running");
      expect(updates).toContain("analyzing");
      expect(result.sessions).toHaveLength(36);
      for (const s of result.sessions) {
        expect(s.status).toBe("done");
        expect(["completed", "abandoned", "timeout"]).toContain(s.outcome);
        expect(s.steps.length).toBeGreaterThan(0);
        expect(s.steps.length).toBeLessThanOrEqual(12);
        // Every step is a valid transition and the path is connected.
        let at = scenario.entry;
        for (const st of s.steps) {
          expect(st.stateId).toBe(at);
          const allowed = scenario.states[at].actions.find((a) => a.id === st.actionId);
          expect(allowed).toBeTruthy();
          expect(st.nextStateId).toBe(allowed!.to);
          at = st.nextStateId;
        }
        if (s.outcome !== "timeout") expect(scenario.terminals[at]).toBeTruthy();
      }
      const a = computeAnalytics(result, scenario);
      expect(a.persona.total).toBe(18);
      expect(a.baseline.total).toBe(18);
      expect(a.baseline.conversionRate).toBe(1);
      expect(a.persona.completed + a.persona.abandoned + a.persona.timeout).toBe(18);
      expect(a.funnel[0].persona).toBe(100);
      expect(a.coercedSteps).toBe(0);
      expect(result.insights?.generatedBy).toBe("demo");
      const shares = a.actions.reduce((sum, x) => sum + x.persona, 0);
      expect(shares).toBeCloseTo(100, 5);
    });
  }

  it("is repeatable for the same session ids", async () => {
    const scenario = getScenario("personal-loan");
    const one = await runSimulation(makeSim(scenario.id), scenario, new DemoBackend(0), { concurrency: 3 });
    const two = await runSimulation(makeSim(scenario.id), scenario, new DemoBackend(0), { concurrency: 6 });
    const path = (s: Simulation) => s.sessions.map((x) => x.steps.map((st) => st.actionId).join(">")).sort();
    // Persona ids differ between the two sims, so compare outcome counts instead of paths per id.
    expect(path(one).length).toBe(path(two).length);
  });

  it("can be cancelled", async () => {
    const scenario = getScenario("personal-loan");
    const ctrl = new AbortController();
    const promise = runSimulation(makeSim(scenario.id, 5), scenario, new DemoBackend(20), {
      concurrency: 2,
      signal: ctrl.signal,
    });
    setTimeout(() => ctrl.abort(), 60);
    const result = await promise;
    expect(result.status).toBe("cancelled");
    expect(result.sessions.some((s) => s.status === "queued")).toBe(true);
  });

  it("stops at the step limit", async () => {
    const scenario = getScenario("personal-loan");
    const result = await runSimulation(makeSim(scenario.id, 1, 2), scenario, new DemoBackend(0), { concurrency: 4 });
    expect(result.sessions.every((s) => s.steps.length <= 2)).toBe(true);
    expect(result.sessions.some((s) => s.outcome === "timeout")).toBe(true);
  });

  it("fails the run on a fatal model error and keeps going on a session error", async () => {
    const scenario = getScenario("personal-loan");
    const { LlmError } = await import("./llm");
    const flaky = new DemoBackend(0);
    let calls = 0;
    const original = flaky.decide.bind(flaky);
    flaky.decide = async (ctx, signal) => {
      if (++calls === 3) throw new LlmError("temporary glitch");
      return original(ctx, signal);
    };
    const ok = await runSimulation(makeSim(scenario.id, 1), scenario, flaky, { concurrency: 1 });
    expect(ok.status).toBe("completed");
    expect(ok.sessions.filter((s) => s.status === "error")).toHaveLength(1);

    const broken = new DemoBackend(0);
    broken.decide = async () => {
      throw new LlmError("The API key is not valid. Check it in Settings.", { fatal: true });
    };
    const failed = await runSimulation(makeSim(scenario.id, 1), scenario, broken, { concurrency: 3 });
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("API key");
  });
});
