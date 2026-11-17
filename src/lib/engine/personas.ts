import type { AgentBackend } from "./backend";
import type { CohortBrief, Ocean, Persona, PersonaSkeleton } from "./types";
import { clamp, rng, shuffle, uid } from "./util";

/**
 * Samples demographics and trait scores before any model call. Each trait is
 * spread evenly across the cohort (stratified) so a small pool still covers
 * low, middle and high values.
 */
export function sampleSkeletons(brief: CohortBrief, seed: string): PersonaSkeleton[] {
  const n = clamp(Math.round(brief.count), 1, 30);
  const rand = rng(seed);
  const spread = () =>
    shuffle(
      Array.from({ length: n }, (_, i) => Math.round(clamp(((i + 0.2 + rand() * 0.6) / n) * 100, 3, 97))),
      rand,
    );
  const cols = {
    openness: spread(),
    conscientiousness: spread(),
    extraversion: spread(),
    agreeableness: spread(),
    neuroticism: spread(),
    risk: spread(),
    literacy: spread(),
    price: spread(),
  };
  const lo = Math.min(brief.ageMin, brief.ageMax);
  const hi = Math.max(brief.ageMin, brief.ageMax);
  return Array.from({ length: n }, (_, i) => ({
    key: `p${i + 1}`,
    age: Math.round(lo + rand() * (hi - lo)),
    gender: rand() < 0.5 ? "Female" : "Male",
    ocean: {
      openness: cols.openness[i],
      conscientiousness: cols.conscientiousness[i],
      extraversion: cols.extraversion[i],
      agreeableness: cols.agreeableness[i],
      neuroticism: cols.neuroticism[i],
    },
    riskTolerance: cols.risk[i],
    digitalLiteracy: cols.literacy[i],
    priceSensitivity: cols.price[i],
  }));
}

/** The Persona Architect: sample the numbers, then have the backend write the people. */
export async function generatePersonas(
  backend: AgentBackend,
  brief: CohortBrief,
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<Persona[]> {
  const skeletons = sampleSkeletons(brief, `${brief.segment}-${Date.now()}`);
  const out: Persona[] = [];
  const batchSize = 5; // one model call per batch keeps request counts low
  for (let i = 0; i < skeletons.length; i += batchSize) {
    const batch = skeletons.slice(i, i + batchSize);
    const drafts = await backend.writePersonas(batch, brief, signal);
    batch.forEach((sk, j) => {
      const d = drafts[j];
      out.push({
        id: uid("per"),
        name: d.name,
        age: sk.age,
        gender: sk.gender,
        occupation: d.occupation,
        location: brief.location,
        segment: brief.segment,
        monthlyIncome: d.monthlyIncome,
        ocean: sk.ocean,
        riskTolerance: sk.riskTolerance,
        digitalLiteracy: sk.digitalLiteracy,
        priceSensitivity: sk.priceSensitivity,
        goals: d.goals,
        frustrations: d.frustrations,
        backstory: d.backstory,
        source: backend.kind,
        createdAt: Date.now(),
      });
    });
    onProgress?.(out.length, skeletons.length);
  }
  return out;
}

const o = (openness: number, conscientiousness: number, extraversion: number, agreeableness: number, neuroticism: number): Ocean => ({
  openness,
  conscientiousness,
  extraversion,
  agreeableness,
  neuroticism,
});

/** Six hand-written personas for a first run. */
export function samplePersonas(): Persona[] {
  const now = Date.now();
  const base = { location: "Bengaluru, India", source: "sample" as const };
  const list: Omit<Persona, "id" | "createdAt" | "location" | "source">[] = [
    {
      name: "Aarav Sharma",
      age: 28,
      gender: "Male",
      occupation: "Software engineer",
      segment: "Young Professionals",
      monthlyIncome: "Rs 95,000",
      ocean: o(78, 55, 62, 58, 30),
      riskTolerance: 74,
      digitalLiteracy: 92,
      priceSensitivity: 45,
      goals: ["Fund a certification course without touching savings", "Finish applications in one sitting"],
      frustrations: ["Slow KYC steps", "Apps that push add-ons"],
      backstory:
        "Aarav has used three lending apps and two credit cards. He decides fast, trusts well-designed products, and gets impatient when a flow asks for things twice.",
    },
    {
      name: "Meera Iyer",
      age: 34,
      gender: "Female",
      occupation: "School teacher",
      segment: "Young Professionals",
      monthlyIncome: "Rs 48,000",
      ocean: o(45, 88, 40, 70, 58),
      riskTolerance: 30,
      digitalLiteracy: 60,
      priceSensitivity: 82,
      goals: ["Cover her mother's medical bill", "Know the full cost before agreeing"],
      frustrations: ["Fees that appear late", "Small-print terms"],
      backstory:
        "Meera budgets every month in a notebook. She reads terms line by line and once cancelled a loan after finding a processing fee that was not mentioned upfront.",
    },
    {
      name: "Rohan Das",
      age: 23,
      gender: "Male",
      occupation: "Delivery partner",
      segment: "Students",
      monthlyIncome: "Rs 22,000",
      ocean: o(50, 32, 66, 60, 76),
      riskTolerance: 38,
      digitalLiteracy: 55,
      priceSensitivity: 88,
      goals: ["Repair his bike so he can keep working", "Keep the EMI as low as possible"],
      frustrations: ["Being asked for bank statements", "Fear of being rejected"],
      backstory:
        "Rohan's income changes week to week. He has no credit history, worries about what lenders do with his data, and usually backs out when a form feels invasive.",
    },
    {
      name: "Priya Menon",
      age: 41,
      gender: "Female",
      occupation: "Boutique owner",
      segment: "Self-employed",
      monthlyIncome: "Rs 1,10,000",
      ocean: o(64, 72, 74, 48, 36),
      riskTolerance: 66,
      digitalLiteracy: 70,
      priceSensitivity: 60,
      goals: ["Buy stock before the festival season", "Compare lenders on total cost"],
      frustrations: ["Lenders that assume a salary slip", "Countdown timers and pressure tactics"],
      backstory:
        "Priya has run her boutique for nine years and negotiates everything. She is comfortable with debt when the numbers work and sceptical of marketing claims.",
    },
    {
      name: "Kabir Singh",
      age: 52,
      gender: "Male",
      occupation: "Operations manager",
      segment: "High Net Worth",
      monthlyIncome: "Rs 2,40,000",
      ocean: o(35, 80, 45, 42, 28),
      riskTolerance: 55,
      digitalLiteracy: 48,
      priceSensitivity: 35,
      goals: ["Bridge a short cash gap for a property payment", "Deal with a regulated, reputable lender"],
      frustrations: ["Unknown brands", "Being asked for camera and SMS access"],
      backstory:
        "Kabir banks with the same branch he has used for twenty years. He will pay more for a lender he trusts and checks registration details before sharing anything.",
    },
    {
      name: "Ananya Rao",
      age: 26,
      gender: "Female",
      occupation: "Graphic designer",
      segment: "Young Professionals",
      monthlyIncome: "Rs 55,000",
      ocean: o(86, 40, 58, 72, 84),
      riskTolerance: 22,
      digitalLiteracy: 85,
      priceSensitivity: 70,
      goals: ["Pay a rental deposit for a new flat", "Avoid anything that could hurt her credit score"],
      frustrations: ["Pre-ticked consent boxes", "Not knowing who gets her data"],
      backstory:
        "Ananya is fluent with apps but anxious about money. A friend was harassed by a loan app's recovery agents, so she looks for warning signs at every step.",
    },
  ];
  return list.map((p, i) => ({ ...p, ...base, id: uid(`per${i}`), createdAt: now + i }));
}
