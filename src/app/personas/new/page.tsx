"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, Card, Field, LinkButton, PageHeader, Slider, TraitBar, inputClass } from "@/components/ui";
import { OCEAN_KEYS, type Ocean, type Persona } from "@/lib/engine/types";
import { uid } from "@/lib/engine/util";
import { useStore } from "@/lib/store";

const STEPS = ["Basic info", "Personality", "Behaviour & goals", "Review"];

const TRAIT_HINT: Record<keyof Ocean, string> = {
  openness: "Low: prefers the familiar. High: curious, tries new things.",
  conscientiousness: "Low: decides quickly. High: reads the details first.",
  extraversion: "Low: decides alone. High: swayed by what is popular.",
  agreeableness: "Low: sceptical of claims. High: trusting.",
  neuroticism: "Low: calm. High: anxious, put off by friction.",
};

const NEXT_HINT = [
  ["Next: personality", "Add OCEAN traits to condition how this persona interprets options and makes decisions."],
  ["Next: behaviour and goals", "Set risk tolerance and what this person wants, so the agent has motives as well as traits."],
  ["Next: review", "Check the full profile before saving it."],
  ["Ready to save", "This persona can be used in any simulation."],
];

export default function NewPersonaPage() {
  const router = useRouter();
  const addPersonas = useStore((s) => s.addPersonas);
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [age, setAge] = useState("28");
  const [gender, setGender] = useState("Female");
  const [occupation, setOccupation] = useState("");
  const [location, setLocation] = useState("Bengaluru, India");
  const [segment, setSegment] = useState("Young Professionals");
  const [income, setIncome] = useState("");
  const [ocean, setOcean] = useState<Ocean>({ openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 });
  const [risk, setRisk] = useState(50);
  const [literacy, setLiteracy] = useState(60);
  const [price, setPrice] = useState(50);
  const [goals, setGoals] = useState("");
  const [frustrations, setFrustrations] = useState("");
  const [backstory, setBackstory] = useState("");

  const ageNum = Number(age);
  const basicOk = name.trim().length > 1 && occupation.trim().length > 1 && Number.isFinite(ageNum) && ageNum >= 18 && ageNum <= 100;
  const lines = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  const save = () => {
    const persona: Persona = {
      id: uid("per"),
      name: name.trim(),
      age: Math.round(ageNum),
      gender,
      occupation: occupation.trim(),
      location: location.trim() || "Not specified",
      segment: segment.trim() || "General",
      monthlyIncome: income.trim(),
      ocean,
      riskTolerance: risk,
      digitalLiteracy: literacy,
      priceSensitivity: price,
      goals: lines(goals),
      frustrations: lines(frustrations),
      backstory: backstory.trim(),
      source: "manual",
      createdAt: Date.now(),
    };
    addPersonas([persona]);
    router.push(`/personas/${persona.id}`);
  };

  return (
    <>
      <PageHeader title="Create a persona" subtitle="Build a coherent profile for a controlled simulation." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={i > step && !basicOk}
            onClick={() => setStep(i)}
            className={clsx(
              "rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed",
              i === step ? "bg-ink text-white" : "bg-white hover:bg-white/60",
            )}
          >
            <span className={clsx("mr-2", i === step ? "text-lime" : "text-muted")}>0{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2.1fr_1fr]">
        <Card>
          {step === 0 && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Basic information</h2>
              <p className="mt-2 text-[15px] text-muted">The demographic context behind each decision.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full name *">
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
                </Field>
                <Field label="Age *" hint="18 to 100">
                  <input className={inputClass} type="number" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
                </Field>
                <Field label="Gender *">
                  <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                  </select>
                </Field>
                <Field label="Occupation *">
                  <input className={inputClass} value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="School teacher" />
                </Field>
                <Field label="Location">
                  <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Audience segment">
                  <input className={inputClass} value={segment} onChange={(e) => setSegment(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Monthly income">
                    <input className={inputClass} value={income} onChange={(e) => setIncome(e.target.value)} placeholder="Rs 60,000" />
                  </Field>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Personality</h2>
              <p className="mt-2 text-[15px] text-muted">Big Five (OCEAN) traits, each from 0 to 100.</p>
              <div className="mt-5 space-y-5">
                {OCEAN_KEYS.map((k) => (
                  <Slider
                    key={k}
                    label={k[0].toUpperCase() + k.slice(1)}
                    value={ocean[k]}
                    onChange={(v) => setOcean((o) => ({ ...o, [k]: v }))}
                    hint={TRAIT_HINT[k]}
                  />
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Behaviour and goals</h2>
              <p className="mt-2 text-[15px] text-muted">How this person handles risk, technology and money, and what they want.</p>
              <div className="mt-5 space-y-5">
                <Slider label="Risk tolerance" value={risk} onChange={setRisk} hint="Low: avoids uncertainty. High: comfortable taking chances." />
                <Slider label="Digital literacy" value={literacy} onChange={setLiteracy} hint="Low: needs help with apps. High: fluent." />
                <Slider label="Price sensitivity" value={price} onChange={setPrice} hint="Low: pays for convenience. High: watches every fee." />
                <Field label="Goals" hint="One per line.">
                  <textarea className={inputClass} rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} />
                </Field>
                <Field label="Frustrations" hint="One per line.">
                  <textarea className={inputClass} rows={3} value={frustrations} onChange={(e) => setFrustrations(e.target.value)} />
                </Field>
                <Field label="Backstory" hint="A few sentences about their life and past experience with products like this.">
                  <textarea className={inputClass} rows={4} value={backstory} onChange={(e) => setBackstory(e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Review</h2>
              <p className="mt-2 text-[15px] text-muted">This is the profile the agent will be given at every step.</p>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  {OCEAN_KEYS.map((k) => (
                    <TraitBar key={k} label={k[0].toUpperCase() + k.slice(1)} value={ocean[k]} />
                  ))}
                </div>
                <div className="space-y-3">
                  <TraitBar label="Risk tolerance" value={risk} />
                  <TraitBar label="Digital literacy" value={literacy} />
                  <TraitBar label="Price sensitivity" value={price} />
                </div>
              </div>
              <div className="mt-6 space-y-4 text-[15px]">
                <div>
                  <div className="text-sm font-semibold text-muted">Goals</div>
                  <div>{lines(goals).join("; ") || "None listed"}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-muted">Frustrations</div>
                  <div>{lines(frustrations).join("; ") || "None listed"}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-muted">Backstory</div>
                  <div>{backstory.trim() || "No backstory written"}</div>
                </div>
              </div>
            </>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            {step === 0 ? (
              <LinkButton href="/personas" variant="secondary" className="min-w-[150px]">
                Back
              </LinkButton>
            ) : (
              <Button variant="secondary" className="min-w-[150px]" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button className="min-w-[186px]" disabled={!basicOk} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button className="min-w-[186px]" disabled={!basicOk} onClick={save}>
                Save persona
              </Button>
            )}
          </div>
          {!basicOk && step === 0 && <p className="mt-3 text-right text-xs text-muted">Add a name, an age from 18 to 100 and an occupation to continue.</p>}
        </Card>

        <div className="rounded-2xl bg-blue-soft p-6">
          <div className="text-[11px] font-bold tracking-wide text-blue">LIVE PREVIEW</div>
          <div className="mt-4">
            <Avatar name={name || "New Persona"} size={92} />
          </div>
          <h3 className="mt-4 text-[28px] font-semibold tracking-tight">{name || "New persona"}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {age || "?"} · {gender}
            <br />
            {occupation || "Occupation"}
            <br />
            {location || "Location"}
          </p>
          <h4 className="mt-5 text-lg font-semibold">{NEXT_HINT[step][0]}</h4>
          <p className="mt-2 text-[15px] text-muted">{NEXT_HINT[step][1]}</p>
        </div>
      </div>
    </>
  );
}
