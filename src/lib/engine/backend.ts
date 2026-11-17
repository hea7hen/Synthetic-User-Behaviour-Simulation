// The three LLM-backed agents (Persona Architect, User agents, Insight Analyst)
// behind one interface, so the orchestrator can run them on Gemini or on the
// scripted demo backend.

import type { Analytics } from "./analytics";
import { GeminiClient, type GeminiOptions } from "./llm";
import { stateLabel } from "./scenarios";
import {
  EMOTIONS,
  OCEAN_KEYS,
  type CohortBrief,
  type Emotion,
  type Insights,
  type OceanKey,
  type Persona,
  type PersonaDraft,
  type PersonaSkeleton,
  type Scenario,
  type Simulation,
  type Step,
} from "./types";
import { clamp } from "./util";

export interface DecisionContext {
  scenario: Scenario;
  stateId: string;
  history: Step[];
  persona?: Persona; // undefined for the no-persona baseline
  maxSteps: number;
  seed: string;
}

export interface RawDecision {
  thought: string;
  action: string;
  emotion: Emotion;
  factor: string;
  confidence: number;
}

export interface AnalysisContext {
  scenario: Scenario;
  simulation: Simulation;
  analytics: Analytics;
}

export interface AgentBackend {
  kind: "gemini" | "demo";
  writePersonas(skeletons: PersonaSkeleton[], brief: CohortBrief, signal?: AbortSignal): Promise<PersonaDraft[]>;
  decide(ctx: DecisionContext, signal?: AbortSignal): Promise<RawDecision>;
  analyze(ctx: AnalysisContext, signal?: AbortSignal): Promise<Insights>;
}

// ---------------------------------------------------------------- prompts

export function level(v: number): string {
  return v >= 80 ? "very high" : v >= 60 ? "high" : v >= 40 ? "moderate" : v >= 20 ? "low" : "very low";
}

const TRAIT_MEANING: Record<OceanKey, [string, string]> = {
  openness: ["curious, likes trying new products and ideas", "prefers the familiar, wary of anything new"],
  conscientiousness: ["careful and thorough, reads details before deciding", "impulsive, skims and decides quickly"],
  extraversion: ["outgoing, influenced by what is popular and social proof", "reserved, decides alone and distrusts hype"],
  agreeableness: ["trusting and cooperative, takes claims at face value", "sceptical, questions claims and motives"],
  neuroticism: ["anxious, sensitive to risk and easily put off by friction", "calm, not easily worried"],
};

export function personaSystemPrompt(p: Persona): string {
  const traits = OCEAN_KEYS.map((k) => {
    const v = Math.round(p.ocean[k]);
    const meaning = v >= 50 ? TRAIT_MEANING[k][0] : TRAIT_MEANING[k][1];
    return `- ${k[0].toUpperCase() + k.slice(1)}: ${v}/100 (${level(v)}): ${meaning}`;
  }).join("\n");
  return [
    "You are role-playing one specific person who is using a digital product. You are not an AI assistant and you are not trying to be helpful or to finish a task for its own sake. Think, feel and decide exactly as this person would, including hesitating, getting annoyed, or walking away.",
    "",
    "WHO YOU ARE",
    `Name: ${p.name}`,
    `Age: ${p.age}. Gender: ${p.gender}. Occupation: ${p.occupation}. Location: ${p.location}.`,
    p.monthlyIncome ? `Monthly income: ${p.monthlyIncome}.` : "",
    p.backstory ? `Backstory: ${p.backstory}` : "",
    p.goals.length ? `Goals: ${p.goals.join("; ")}.` : "",
    p.frustrations.length ? `Frustrations: ${p.frustrations.join("; ")}.` : "",
    "",
    "PERSONALITY (Big Five, 0-100)",
    traits,
    "",
    "OTHER TRAITS (0-100)",
    `- Risk tolerance: ${Math.round(p.riskTolerance)} (${level(p.riskTolerance)})`,
    `- Digital literacy: ${Math.round(p.digitalLiteracy)} (${level(p.digitalLiteracy)})`,
    `- Price sensitivity: ${Math.round(p.priceSensitivity)} (${level(p.priceSensitivity)})`,
    "",
    "Stay consistent with this profile at every step.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export const BASELINE_SYSTEM_PROMPT =
  "You are a user of a digital product. At each step you are shown the current screen and you choose what to do next.";

export function stepPrompt(ctx: DecisionContext): string {
  const { scenario, stateId, history, maxSteps } = ctx;
  const state = scenario.states[stateId];
  const past = history.length
    ? history
        .map(
          (h, i) =>
            `${i + 1}. On "${stateLabel(scenario, h.stateId)}" you thought: "${h.thought}" and chose "${h.actionLabel}".`,
        )
        .join("\n")
    : "Nothing yet. This is your first screen.";
  return [
    `PRODUCT: ${scenario.product}`,
    `SITUATION: ${scenario.goal}`,
    "",
    `STEP ${history.length + 1} of at most ${maxSteps}.`,
    "",
    `WHAT YOU SEE NOW: ${state.label}`,
    state.screen,
    "",
    "WHAT HAS HAPPENED SO FAR",
    past,
    "",
    "ACTIONS AVAILABLE ON THIS SCREEN",
    state.actions.map((a) => `- ${a.id}: ${a.label}`).join("\n"),
    "",
    "Choose exactly one action from the list. Leaving is a valid choice.",
    "Reply with JSON only, in this shape:",
    `{"thought": "<one or two sentences in the first person explaining the choice>", "action": "<one action id from the list>", "emotion": "<one of: ${EMOTIONS.join(", ")}>", "factor": "<what mattered most, one of: ${scenario.factors.map((f) => f.id).join(", ")}>", "confidence": <number from 0 to 1>}`,
  ].join("\n");
}

function architectPrompt(skeletons: PersonaSkeleton[], brief: CohortBrief): string {
  return [
    `Write realistic user personas for the audience segment "${brief.segment}", based in or around ${brief.location}.`,
    brief.context ? `Research context: ${brief.context}` : "",
    "",
    "Each profile below already has an age, gender and trait scores (0-100). Do not change them. For each one, invent a person whose life story fits those numbers: a neurotic, risk-averse profile should read differently from a calm, risk-tolerant one.",
    "",
    "PROFILES",
    JSON.stringify(skeletons, null, 1),
    "",
    "Reply with JSON only: an array with one object per profile, in the same order, each shaped as",
    '{"key": "<the profile key>", "name": "<full name that fits the location>", "occupation": "<job title>", "monthlyIncome": "<amount with currency>", "goals": ["<2 or 3 short goals>"], "frustrations": ["<2 or 3 short frustrations with digital products or money>"], "backstory": "<3 or 4 sentences>"}',
  ]
    .filter(Boolean)
    .join("\n");
}

function analystPrompt(ctx: AnalysisContext): string {
  const { scenario, simulation, analytics: a } = ctx;
  const personaById = new Map(simulation.personas.map((p) => [p.id, p]));
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // A few verbatim moments where personas hesitated or left, as evidence.
  const quotes: string[] = [];
  for (const s of simulation.sessions) {
    if (s.condition !== "persona" || quotes.length >= 14) continue;
    const p = s.personaId ? personaById.get(s.personaId) : undefined;
    const moments = s.steps.filter(
      (st) => st.emotion === "hesitant" || st.emotion === "anxious" || st.emotion === "frustrated" || st.nextStateId === "abandoned",
    );
    for (const st of moments.slice(-2)) {
      quotes.push(
        `- ${s.label}${p ? ` (neuroticism ${Math.round(p.ocean.neuroticism)}, risk tolerance ${Math.round(p.riskTolerance)})` : ""} on "${stateLabel(scenario, st.stateId)}", feeling ${st.emotion}: "${st.thought}" -> ${st.actionLabel}`,
      );
    }
  }

  return [
    `SCENARIO: ${scenario.name}. ${scenario.product}`,
    "",
    `PERSONA-CONDITIONED JOURNEYS: ${a.persona.total} finished. Completed ${pct(a.persona.conversionRate)}, abandoned ${pct(a.persona.abandonmentRate)}, hit the step limit ${pct(a.persona.timeoutRate)}. Average ${a.persona.avgSteps.toFixed(1)} steps.`,
    a.baseline.total
      ? `NO-PERSONA BASELINE: ${a.baseline.total} finished. Completed ${pct(a.baseline.conversionRate)}, abandoned ${pct(a.baseline.abandonmentRate)}. Average ${a.baseline.avgSteps.toFixed(1)} steps.`
      : "NO-PERSONA BASELINE: not run.",
    "",
    "SCREENS AND THEIR CONTENT",
    Object.values(scenario.states)
      .map((s) => `- ${s.id} (${s.label}): ${s.screen}`)
      .join("\n"),
    "",
    "WHERE PERSONA JOURNEYS WERE ABANDONED",
    a.dropoffs.length ? a.dropoffs.map((d) => `- ${d.stateId}: ${d.count} journeys`).join("\n") : "- none",
    "",
    "SHARE OF VISITS WITH HESITANT, ANXIOUS OR FRUSTRATED REACTIONS",
    a.hesitation.map((h) => `- ${h.stateId}: ${Math.round(h.share)}% of ${h.visits} visits`).join("\n") || "- none",
    "",
    "STRONGEST TRAIT CORRELATIONS (Pearson r, p-value, n)",
    a.correlations
      .slice(0, 6)
      .map((c) => `- ${c.traitLabel} vs ${c.outcomeLabel}: r=${c.result.r.toFixed(2)}, p=${c.result.p.toFixed(3)}, n=${c.result.n}`)
      .join("\n") || "- not enough data",
    "",
    "MOMENTS OF FRICTION, IN THE AGENTS' OWN WORDS",
    quotes.join("\n") || "- none recorded",
    "",
    "Write the findings for a product team. Base every claim on the data above. These are synthetic users, so treat findings as candidate issues to check with real users, and say so in the caveats. Mention the sample size.",
    "Reply with JSON only:",
    `{"summary": "<3 or 4 plain sentences>", "frictionPoints": [{"stateId": "<one of: ${Object.keys(scenario.states).join(", ")}>", "title": "<short name of the issue>", "severity": "high|medium|low", "evidence": "<what in the data shows it>", "recommendation": "<one concrete change to test>"}], "personaPatterns": ["<how a kind of persona behaved, 2 to 4 items>"], "caveats": ["<1 to 3 limits of this evidence>"]}`,
  ].join("\n");
}

// ---------------------------------------------------------------- Gemini backend

const asText = (v: unknown, fallback = ""): string => (typeof v === "string" ? v.trim() : fallback);
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => asText(x)).filter(Boolean).slice(0, 5) : []);

export class GeminiBackend implements AgentBackend {
  kind = "gemini" as const;
  private client: GeminiClient;
  constructor(opts: GeminiOptions) {
    this.client = new GeminiClient(opts);
  }

  async writePersonas(skeletons: PersonaSkeleton[], brief: CohortBrief, signal?: AbortSignal): Promise<PersonaDraft[]> {
    const system =
      "You are the Persona Architect in a user-research simulation system. You write grounded, specific, non-stereotyped personas. You reply with JSON only.";
    const raw = await this.client.json<unknown>(system, architectPrompt(skeletons, brief), signal, 0.9);
    const list = Array.isArray(raw) ? raw : ((raw as { personas?: unknown[] })?.personas ?? []);
    return skeletons.map((sk, i) => {
      const found =
        (list as Record<string, unknown>[]).find((d) => d && d.key === sk.key) ?? (list as Record<string, unknown>[])[i] ?? {};
      return {
        key: sk.key,
        name: asText(found.name, `Persona ${i + 1}`),
        occupation: asText(found.occupation, "Not specified"),
        monthlyIncome: asText(found.monthlyIncome),
        goals: asList(found.goals),
        frustrations: asList(found.frustrations),
        backstory: asText(found.backstory),
      };
    });
  }

  async decide(ctx: DecisionContext, signal?: AbortSignal): Promise<RawDecision> {
    const system = ctx.persona ? personaSystemPrompt(ctx.persona) : BASELINE_SYSTEM_PROMPT;
    const raw = await this.client.json<Record<string, unknown>>(system, stepPrompt(ctx), signal);
    const emotion = asText(raw.emotion).toLowerCase() as Emotion;
    const factor = asText(raw.factor).toLowerCase();
    const confidence = Number(raw.confidence);
    return {
      thought: asText(raw.thought, "(no reasoning given)"),
      action: asText(raw.action),
      emotion: EMOTIONS.includes(emotion) ? emotion : "neutral",
      factor: ctx.scenario.factors.some((f) => f.id === factor) ? factor : "other",
      confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5,
    };
  }

  async analyze(ctx: AnalysisContext, signal?: AbortSignal): Promise<Insights> {
    const system =
      "You are the Insight Analyst in a user-research simulation system. You read simulation evidence and report usability friction plainly, without overclaiming. You reply with JSON only.";
    const raw = await this.client.json<Record<string, unknown>>(system, analystPrompt(ctx), signal, 0.3);
    const points = Array.isArray(raw.frictionPoints) ? (raw.frictionPoints as Record<string, unknown>[]) : [];
    return {
      summary: asText(raw.summary),
      frictionPoints: points
        .map((p) => {
          const severity = asText(p.severity).toLowerCase();
          return {
            stateId: ctx.scenario.states[asText(p.stateId)] ? asText(p.stateId) : "",
            title: asText(p.title, "Friction point"),
            severity: (severity === "high" || severity === "low" ? severity : "medium") as "high" | "medium" | "low",
            evidence: asText(p.evidence),
            recommendation: asText(p.recommendation),
          };
        })
        .slice(0, 6),
      personaPatterns: asList(raw.personaPatterns),
      caveats: asList(raw.caveats),
      generatedBy: "gemini",
    };
  }
}
