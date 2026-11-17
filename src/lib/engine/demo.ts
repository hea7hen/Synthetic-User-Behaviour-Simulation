// Demo backend: scripted agents that need no API key. Trait effects are built
// into the script, so demo results show how the system works. They are not
// evidence about real users or about what a language model would do.

import type { AgentBackend, AnalysisContext, DecisionContext, RawDecision } from "./backend";
import type { CohortBrief, Emotion, Insights, PersonaDraft, PersonaSkeleton, ScenarioAction } from "./types";
import { clamp, rng, sleep } from "./util";

const FIRST_NAMES_F = ["Meera", "Priya", "Ananya", "Kavya", "Sneha", "Divya", "Ishita", "Nandini", "Farah", "Lakshmi"];
const FIRST_NAMES_M = ["Aarav", "Rohan", "Kabir", "Vikram", "Arjun", "Imran", "Suresh", "Nikhil", "Dev", "Harish"];
const LAST_NAMES = ["Sharma", "Iyer", "Das", "Menon", "Singh", "Rao", "Khan", "Patel", "Nair", "Reddy", "Joshi", "Fernandes"];
const JOBS_YOUNG = ["Software engineer", "Sales executive", "Graphic designer", "Delivery partner", "Junior accountant", "Nurse"];
const JOBS_MID = ["School teacher", "Shop owner", "Operations manager", "Bank clerk", "Freelance consultant", "Cab driver"];
const JOBS_SENIOR = ["Retired government officer", "Small business owner", "Senior manager", "Homemaker", "Clinic doctor"];

function pick<T>(xs: T[], rand: () => number): T {
  return xs[Math.floor(rand() * xs.length)];
}

export class DemoBackend implements AgentBackend {
  kind = "demo" as const;
  /** delayMs paces the scripted agents so the live view is readable. */
  constructor(private delayMs = 320) {}

  private async pause(signal?: AbortSignal, rand: () => number = Math.random) {
    if (this.delayMs > 0) await sleep(this.delayMs * (0.5 + rand()), signal);
    else if (signal?.aborted) await sleep(0, signal);
  }

  async writePersonas(skeletons: PersonaSkeleton[], brief: CohortBrief, signal?: AbortSignal): Promise<PersonaDraft[]> {
    await this.pause(signal);
    return skeletons.map((sk) => {
      const rand = rng(`persona-${sk.key}-${brief.segment}`);
      const female = /female|woman/i.test(sk.gender);
      const name = `${pick(female ? FIRST_NAMES_F : FIRST_NAMES_M, rand)} ${pick(LAST_NAMES, rand)}`;
      const occupation = pick(sk.age < 30 ? JOBS_YOUNG : sk.age < 50 ? JOBS_MID : JOBS_SENIOR, rand);
      const income = `Rs ${(25 + Math.floor(rand() * 12) * 10).toLocaleString("en-IN")},000`;
      const careful = sk.ocean.conscientiousness >= 55;
      const anxious = sk.ocean.neuroticism >= 55;
      const bold = sk.riskTolerance >= 55;
      return {
        key: sk.key,
        name,
        occupation,
        monthlyIncome: income,
        goals: [
          bold ? "Get things done quickly without paperwork" : "Avoid any decision that could go wrong later",
          sk.priceSensitivity >= 55 ? "Pay as little in fees and interest as possible" : "Find an option that is simple to manage",
        ],
        frustrations: [
          anxious ? "Apps that ask for personal data before explaining why" : "Slow processes with too many screens",
          careful ? "Important terms hidden in small print" : "Long forms and documents to read",
        ],
        backstory: `${name.split(" ")[0]} is a ${sk.age}-year-old ${occupation.toLowerCase()} from ${brief.location}. ${
          careful ? "They compare options carefully and read the terms before agreeing to anything." : "They tend to decide quickly and dislike reading long terms."
        } ${anxious ? "Money decisions make them nervous, and a past bad experience with hidden charges has made them wary." : "They are relaxed about money decisions and rarely second-guess a choice."} ${
          sk.digitalLiteracy >= 55 ? "They are comfortable doing everything on their phone." : "They are not fully comfortable with apps and often ask family for help."
        }`,
      };
    });
  }

  async decide(ctx: DecisionContext, signal?: AbortSignal): Promise<RawDecision> {
    const rand = rng(`${ctx.seed}-${ctx.history.length}`);
    await this.pause(signal, rand);
    const state = ctx.scenario.states[ctx.stateId];
    const progress = state.actions.filter((a) => a.kind === "progress");
    const fallback = progress[0] ?? state.actions[0];

    // Baseline: no persona, so it takes the direct path every time.
    if (!ctx.persona) {
      return {
        thought: `The next step toward finishing is to ${fallback.label.toLowerCase()}.`,
        action: fallback.id,
        emotion: "neutral",
        factor: fallback.factor ?? "other",
        confidence: 0.8,
      };
    }

    const p = ctx.persona;
    const n = p.ocean.neuroticism / 100;
    const c = p.ocean.conscientiousness / 100;
    const o = p.ocean.openness / 100;
    const agree = p.ocean.agreeableness / 100;
    const risk = p.riskTolerance / 100;
    const price = p.priceSensitivity / 100;
    const lit = p.digitalLiteracy / 100;

    const visited = new Set(ctx.history.map((h) => h.stateId));
    const timesHere = ctx.history.filter((h) => h.stateId === ctx.stateId).length;
    const sideTrips = ctx.history.filter((h) => {
      const a = ctx.scenario.states[h.stateId]?.actions.find((x) => x.id === h.actionId);
      return a && a.kind !== "progress";
    }).length;
    const reassured = ctx.history.some((h) => {
      const a = ctx.scenario.states[h.stateId]?.actions.find((x) => x.id === h.actionId);
      return a?.kind === "reassure";
    });

    const moneyScreen = ["fees", "price", "interest_rate", "emi"].includes(state.frictionFactor);
    let pLeave =
      state.friction *
      (0.05 + 0.32 * n + 0.2 * (1 - risk) + 0.08 * (1 - agree) + (moneyScreen ? 0.14 * price : 0) + (state.frictionFactor === "effort" ? 0.14 * (1 - lit) : 0));
    pLeave *= 0.6; // calibrated so a mixed cohort abandons roughly a third to a half of journeys
    if (reassured) pLeave *= 0.6;
    const leave = state.actions.find((a) => a.kind === "leave");

    const sideOptions = state.actions.filter(
      (a) => a.kind !== "progress" && a.kind !== "leave" && (a.to === ctx.stateId ? timesHere === 0 : !visited.has(a.to)),
    );
    const pSide = sideOptions.length ? clamp(0.08 + 0.5 * c + 0.18 * o + 0.15 * n - 0.22 * sideTrips, 0, 0.85) : 0;

    const roll = rand();
    let chosen: ScenarioAction;
    if (leave && roll < pLeave) chosen = leave;
    else if (roll < pLeave + pSide) {
      const reassure = sideOptions.find((a) => a.kind === "reassure");
      chosen = reassure && n > 0.5 ? reassure : pick(sideOptions, rand);
    } else chosen = fallback;

    const act = chosen.label.toLowerCase();
    let thought: string;
    let emotion: Emotion;
    if (chosen.kind === "leave") {
      thought = pick(
        [
          `I am not comfortable with ${state.concern}. I would rather stop here.`,
          `Seeing ${state.concern} puts me off. This is not worth the risk for me.`,
          `${state.concern[0].toUpperCase() + state.concern.slice(1)} is where I draw the line. I will look elsewhere.`,
        ],
        rand,
      );
      emotion = n > 0.6 ? "anxious" : "frustrated";
    } else if (chosen.kind === "reassure") {
      thought = `I am uneasy about ${state.concern}, so before going further I want to ${act}.`;
      emotion = n > 0.6 ? "anxious" : "hesitant";
    } else if (chosen.kind === "explore") {
      thought = pick(
        [`I do not want to rush this. Let me ${act} first.`, `Before I commit to anything I want to ${act}.`],
        rand,
      );
      emotion = o > 0.55 ? "curious" : "hesitant";
    } else if (chosen.kind === "adjust") {
      thought = `I noticed ${state.concern}. I want to ${act} before I continue.`;
      emotion = c > 0.6 ? "neutral" : "hesitant";
    } else {
      const worried = pLeave > 0.07;
      thought = worried
        ? `I have doubts about ${state.concern}, but I need this, so I will ${act}.`
        : pick([`This looks fine to me. I will ${act}.`, `Nothing here worries me, so I will ${act}.`], rand);
      emotion = worried ? "hesitant" : risk > 0.6 ? "confident" : "neutral";
    }

    return {
      thought,
      action: chosen.id,
      emotion,
      factor: chosen.kind === "leave" || chosen.kind === "reassure" ? state.frictionFactor : (chosen.factor ?? state.frictionFactor),
      confidence: clamp(chosen.kind === "progress" ? 0.55 + 0.4 * risk - 0.2 * n : 0.45 + 0.3 * c, 0.1, 0.98),
    };
  }

  async analyze(ctx: AnalysisContext, signal?: AbortSignal): Promise<Insights> {
    await this.pause(signal);
    const { analytics: a, scenario } = ctx;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const frictionPoints = a.dropoffs.slice(0, 4).map((d, i) => {
      const state = scenario.states[d.stateId];
      const hes = a.hesitation.find((h) => h.stateId === d.stateId);
      return {
        stateId: d.stateId,
        title: `Drop-off at ${d.label}`,
        severity: (i === 0 ? "high" : d.share >= 10 ? "medium" : "low") as "high" | "medium" | "low",
        evidence: `${d.count} of ${a.persona.total} persona journeys ended here${hes ? `, and ${Math.round(hes.share)}% of visits showed hesitant, anxious or frustrated reactions` : ""}.`,
        recommendation: state ? `Test a version of this screen that addresses ${state.concern}.` : "Review this screen with real users.",
      };
    });
    const top = a.correlations[0];
    return {
      summary: `Across ${a.persona.total} persona-conditioned journeys on ${scenario.name}, ${pct(a.persona.conversionRate)} completed and ${pct(a.persona.abandonmentRate)} abandoned.${
        a.baseline.total ? ` The no-persona baseline completed ${pct(a.baseline.conversionRate)} of ${a.baseline.total} journeys.` : ""
      }${a.dropoffs[0] ? ` Most drop-off happened at ${a.dropoffs[0].label}.` : " No journeys were abandoned."}`,
      frictionPoints,
      personaPatterns: top
        ? [
            `${top.traitLabel} moved with ${top.outcomeLabel.toLowerCase()} most strongly (r = ${top.result.r.toFixed(2)}, n = ${top.result.n}).`,
            "Careful personas took more side trips to read terms before continuing.",
          ]
        : ["Not enough journeys to describe persona patterns."],
      caveats: [
        `Based on ${a.persona.total} synthetic journeys on one scenario. Treat each finding as a candidate issue to confirm with real users.`,
        "Trait correlations come from a small sample and many pairs are tested at once.",
      ],
      generatedBy: "demo",
    };
  }
}
