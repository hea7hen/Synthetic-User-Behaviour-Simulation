import { factorLabel } from "./scenarios";
import { ksTwoSample, mean, pearson, type Correlation, type KsResult } from "./stats";
import { OCEAN_KEYS, type Condition, type Persona, type Scenario, type Session, type Simulation } from "./types";

export interface ConditionSummary {
  total: number; // sessions that finished with a real outcome
  completed: number;
  abandoned: number;
  timeout: number;
  errors: number;
  conversionRate: number; // 0-1
  abandonmentRate: number;
  timeoutRate: number;
  avgSteps: number;
  avgStepsCompleted: number;
  avgStepsAbandoned: number;
}

export interface TraitCorrelation {
  trait: string;
  traitLabel: string;
  outcome: "abandoned" | "completed" | "steps";
  outcomeLabel: string;
  result: Correlation;
}

export interface Analytics {
  persona: ConditionSummary;
  baseline: ConditionSummary;
  funnel: { stateId: string; label: string; persona: number; baseline: number }[]; // % of journeys that reached the state
  dropoffs: { stateId: string; label: string; count: number; share: number }[];
  hesitation: { stateId: string; label: string; visits: number; hesitant: number; share: number }[];
  actions: { id: string; label: string; persona: number; baseline: number }[]; // % of actions taken
  factors: { id: string; label: string; count: number; share: number }[];
  correlations: TraitCorrelation[];
  ksSteps: KsResult | null;
  coercedSteps: number;
  totalSteps: number;
  avgLatencyMs: number;
}

const TRAITS: { key: string; label: string; get: (p: Persona) => number }[] = [
  ...OCEAN_KEYS.map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), get: (p: Persona) => p.ocean[k] })),
  { key: "riskTolerance", label: "Risk tolerance", get: (p) => p.riskTolerance },
  { key: "priceSensitivity", label: "Price sensitivity", get: (p) => p.priceSensitivity },
  { key: "digitalLiteracy", label: "Digital literacy", get: (p) => p.digitalLiteracy },
];

const finished = (s: Session) => s.status === "done" && s.outcome && s.outcome !== "error";

function summarize(sessions: Session[]): ConditionSummary {
  const done = sessions.filter(finished);
  const by = (o: string) => done.filter((s) => s.outcome === o);
  const total = done.length;
  const rate = (n: number) => (total ? n / total : 0);
  return {
    total,
    completed: by("completed").length,
    abandoned: by("abandoned").length,
    timeout: by("timeout").length,
    errors: sessions.filter((s) => s.status === "error").length,
    conversionRate: rate(by("completed").length),
    abandonmentRate: rate(by("abandoned").length),
    timeoutRate: rate(by("timeout").length),
    avgSteps: mean(done.map((s) => s.steps.length)),
    avgStepsCompleted: mean(by("completed").map((s) => s.steps.length)),
    avgStepsAbandoned: mean(by("abandoned").map((s) => s.steps.length)),
  };
}

function reached(session: Session, stateId: string): boolean {
  return session.terminalStateId === stateId || session.steps.some((st) => st.stateId === stateId);
}

export function computeAnalytics(sim: Simulation, scenario: Scenario): Analytics {
  const of = (c: Condition) => sim.sessions.filter((s) => s.condition === c);
  const personaDone = of("persona").filter(finished);
  const baselineDone = of("baseline").filter(finished);

  const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);

  const funnel = scenario.funnel.map((stateId) => ({
    stateId,
    label: scenario.states[stateId]?.short ?? scenario.terminals[stateId]?.short ?? stateId,
    persona: pct(personaDone.filter((s) => reached(s, stateId)).length, personaDone.length),
    baseline: pct(baselineDone.filter((s) => reached(s, stateId)).length, baselineDone.length),
  }));

  // Where persona journeys ended without completing.
  const dropCounts = new Map<string, number>();
  for (const s of personaDone) {
    if (s.outcome !== "abandoned") continue;
    const last = s.steps[s.steps.length - 1];
    if (last) dropCounts.set(last.stateId, (dropCounts.get(last.stateId) ?? 0) + 1);
  }
  const dropoffs = [...dropCounts.entries()]
    .map(([stateId, count]) => ({
      stateId,
      label: scenario.states[stateId]?.label ?? stateId,
      count,
      share: pct(count, personaDone.length),
    }))
    .sort((a, b) => b.count - a.count);

  const visitMap = new Map<string, { visits: number; hesitant: number }>();
  for (const s of personaDone) {
    for (const st of s.steps) {
      const v = visitMap.get(st.stateId) ?? { visits: 0, hesitant: 0 };
      v.visits++;
      if (st.emotion === "hesitant" || st.emotion === "anxious" || st.emotion === "frustrated") v.hesitant++;
      visitMap.set(st.stateId, v);
    }
  }
  const hesitation = [...visitMap.entries()]
    .map(([stateId, v]) => ({
      stateId,
      label: scenario.states[stateId]?.label ?? stateId,
      visits: v.visits,
      hesitant: v.hesitant,
      share: pct(v.hesitant, v.visits),
    }))
    .sort((a, b) => b.share - a.share);

  const actionLabels = new Map<string, string>();
  const countActions = (sessions: Session[]) => {
    const m = new Map<string, number>();
    let total = 0;
    for (const s of sessions)
      for (const st of s.steps) {
        m.set(st.actionId, (m.get(st.actionId) ?? 0) + 1);
        actionLabels.set(st.actionId, st.actionLabel);
        total++;
      }
    return { m, total };
  };
  const pa = countActions(personaDone);
  const ba = countActions(baselineDone);
  const actions = [...actionLabels.keys()]
    .map((id) => ({
      id,
      label: actionLabels.get(id) ?? id,
      persona: pct(pa.m.get(id) ?? 0, pa.total),
      baseline: pct(ba.m.get(id) ?? 0, ba.total),
    }))
    .sort((a, b) => b.persona + b.baseline - (a.persona + a.baseline));

  const factorCounts = new Map<string, number>();
  for (const s of personaDone) for (const st of s.steps) factorCounts.set(st.factor, (factorCounts.get(st.factor) ?? 0) + 1);
  const factors = [...factorCounts.entries()]
    .map(([id, count]) => ({ id, label: factorLabel(scenario, id), count, share: pct(count, pa.total) }))
    .sort((a, b) => b.count - a.count);

  // Trait-to-behaviour correlations, one data point per persona journey.
  const personaById = new Map(sim.personas.map((p) => [p.id, p]));
  const points = personaDone
    .map((s) => ({ s, p: s.personaId ? personaById.get(s.personaId) : undefined }))
    .filter((x): x is { s: Session; p: Persona } => Boolean(x.p));
  const outcomes: { key: TraitCorrelation["outcome"]; label: string; get: (s: Session) => number }[] = [
    { key: "abandoned", label: "Abandonment", get: (s) => (s.outcome === "abandoned" ? 1 : 0) },
    { key: "completed", label: "Conversion", get: (s) => (s.outcome === "completed" ? 1 : 0) },
    { key: "steps", label: "Journey length", get: (s) => s.steps.length },
  ];
  const correlations: TraitCorrelation[] = [];
  for (const t of TRAITS)
    for (const o of outcomes) {
      const result = pearson(
        points.map((x) => t.get(x.p)),
        points.map((x) => o.get(x.s)),
      );
      if (result) correlations.push({ trait: t.key, traitLabel: t.label, outcome: o.key, outcomeLabel: o.label, result });
    }
  correlations.sort((a, b) => Math.abs(b.result.r) - Math.abs(a.result.r));

  const allSteps = [...personaDone, ...baselineDone].flatMap((s) => s.steps);

  return {
    persona: summarize(of("persona")),
    baseline: summarize(of("baseline")),
    funnel,
    dropoffs,
    hesitation,
    actions,
    factors,
    correlations,
    ksSteps: ksTwoSample(
      personaDone.map((s) => s.steps.length),
      baselineDone.map((s) => s.steps.length),
    ),
    coercedSteps: allSteps.filter((s) => s.coerced).length,
    totalSteps: allSteps.length,
    avgLatencyMs: mean(allSteps.map((s) => s.latencyMs)),
  };
}
