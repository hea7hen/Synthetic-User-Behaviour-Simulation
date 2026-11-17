"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar, Badge, Button, Card, DarkCard, Field, LinkButton, Notice, PageHeader, inputClass } from "@/components/ui";
import { generatePersonas } from "@/lib/engine/personas";
import type { Persona } from "@/lib/engine/types";
import { isAbort } from "@/lib/engine/util";
import { makeBackend } from "@/lib/runner";
import { canRun, currentEngine, useStore } from "@/lib/store";

export default function GeneratePersonasPage() {
  const router = useRouter();
  const settings = useStore((s) => s.settings);
  const addPersonas = useStore((s) => s.addPersonas);
  const engine = currentEngine(settings);
  const ready = canRun(settings);

  const [segment, setSegment] = useState("Young Professionals");
  const [count, setCount] = useState(6);
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [location, setLocation] = useState("Bengaluru, India");
  const [context, setContext] = useState("People who may take a small personal loan through a mobile app.");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Persona[]>([]);
  const abort = useRef<AbortController | null>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    setDrafts([]);
    setProgress([0, count]);
    abort.current = new AbortController();
    try {
      const list = await generatePersonas(
        makeBackend(engine, settings),
        { segment: segment.trim() || "General", count, ageMin, ageMax, location: location.trim() || "India", context: context.trim() },
        abort.current.signal,
        (done, total) => setProgress([done, total]),
      );
      setDrafts(list);
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const clampInt = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));

  return (
    <>
      <PageHeader
        title="Generate personas"
        subtitle="The Persona Architect agent samples traits across the cohort, then writes a person to fit each profile."
        actions={
          <LinkButton href="/personas" variant="secondary">
            Back to personas
          </LinkButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Cohort brief</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Audience segment">
              <input className={inputClass} value={segment} onChange={(e) => setSegment(e.target.value)} />
            </Field>
            <Field label="Number of personas" hint="1 to 20">
              <input className={inputClass} type="number" min={1} max={20} value={count} onChange={(e) => setCount(clampInt(e.target.value, 1, 20))} />
            </Field>
            <Field label="Youngest age">
              <input className={inputClass} type="number" min={18} max={90} value={ageMin} onChange={(e) => setAgeMin(clampInt(e.target.value, 18, 90))} />
            </Field>
            <Field label="Oldest age">
              <input className={inputClass} type="number" min={18} max={90} value={ageMax} onChange={(e) => setAgeMax(clampInt(e.target.value, 18, 90))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Location">
                <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Research context" hint="Who these people are and why they matter to the product.">
                <textarea className={inputClass} rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
              </Field>
            </div>
          </div>
          {!ready && (
            <div className="mt-4">
              <Notice tone="warn">
                <Link href="/settings" className="font-semibold text-blue underline">
                  Add a Gemini API key in Settings
                </Link>{" "}
                to generate personas.
              </Notice>
            </div>
          )}
          {error && (
            <div className="mt-4">
              <Notice tone="bad">{error}</Notice>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={run} disabled={busy || !ready}>
              {busy ? `Writing personas… ${progress[0]} of ${progress[1]}` : drafts.length ? "Generate again" : "Generate personas"}
            </Button>
            {busy && (
              <Button variant="secondary" onClick={() => abort.current?.abort()}>
                Stop
              </Button>
            )}
          </div>
        </Card>

        <DarkCard>
          <h2 className="text-2xl font-semibold tracking-tight">Diverse by design.</h2>
          <div className="mt-6 text-[64px] font-semibold leading-none text-lime">{count}</div>
          <p className="mt-4 text-[15px] text-white/85">
            personas, with each trait spread evenly from low to high across the cohort.
          </p>
          <p className="mt-6 text-sm leading-relaxed text-white/70">
            Ages, OCEAN scores, risk tolerance, digital literacy and price sensitivity are sampled first. The model then writes a name,
            job, goals, frustrations and backstory that fit those numbers.
            {engine === "gemini" && ` About ${Math.ceil(count / 5)} model ${Math.ceil(count / 5) === 1 ? "call" : "calls"}.`}
          </p>
        </DarkCard>
      </div>

      {drafts.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Review {drafts.length} personas</h2>
            <Button
              onClick={() => {
                addPersonas(drafts);
                router.push("/personas");
              }}
            >
              Save {drafts.length} personas
            </Button>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {drafts.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start gap-4">
                  <Avatar name={p.name} />
                  <div>
                    <div className="text-lg font-semibold">{p.name}</div>
                    <div className="text-sm text-muted">
                      {p.age} · {p.gender} · {p.occupation}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>Openness {p.ocean.openness}</Badge>
                  <Badge>Conscientiousness {p.ocean.conscientiousness}</Badge>
                  <Badge>Neuroticism {p.ocean.neuroticism}</Badge>
                  <Badge>Risk tolerance {p.riskTolerance}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted">{p.backstory}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
