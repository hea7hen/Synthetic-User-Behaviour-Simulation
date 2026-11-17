"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Card, DarkCard, Empty, Field, LinkButton, Notice, PageHeader, Toggle, inputClass } from "@/components/ui";
import { samplePersonas } from "@/lib/engine/personas";
import { SCENARIOS, getScenario } from "@/lib/engine/scenarios";
import { fmtDateTime } from "@/lib/format";
import { createSimulation, estimateCalls, startSimulation } from "@/lib/runner";
import { canRun, currentEngine, useStore } from "@/lib/store";

export default function NewSimulationPage() {
  const router = useRouter();
  const personas = useStore((s) => s.personas);
  const addPersonas = useStore((s) => s.addPersonas);
  const settings = useStore((s) => s.settings);
  const engine = currentEngine(settings);
  const ready = canRun(settings);

  const [group, setGroup] = useState("All");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [runs, setRuns] = useState(1);
  const [withBaseline, setWithBaseline] = useState(true);
  const [maxSteps, setMaxSteps] = useState(12);
  const [name, setName] = useState("");

  const segments = useMemo(() => ["All", ...Array.from(new Set(personas.map((p) => p.segment)))], [personas]);
  const inGroup = group === "All" ? personas : personas.filter((p) => p.segment === group);
  const selected = inGroup.filter((p) => !excluded.has(p.id));
  const scenario = getScenario(scenarioId);

  const baselineRuns = withBaseline ? selected.length * runs : 0;
  const { journeys, calls } = estimateCalls(selected.length, runs, baselineRuns, scenario.funnel.length);
  const minutes = Math.max(1, Math.ceil(calls / Math.max(1, settings.requestsPerMinute)));

  const clampInt = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));

  const start = () => {
    const sim = createSimulation(
      {
        name: name.trim() || `${group === "All" ? "All personas" : group} · ${fmtDateTime(Date.now())}`,
        scenarioId,
        personas: selected,
        runsPerPersona: runs,
        baselineRuns,
        maxSteps,
        engine,
      },
      settings,
    );
    startSimulation(sim);
    router.push(`/simulations/${sim.id}`);
  };

  if (personas.length === 0) {
    return (
      <>
        <PageHeader title="Set up a simulation" subtitle="Choose the people, the journey and the controls." />
        <Empty title="Add personas first" text="A simulation needs at least one persona to condition its agents.">
          <Button onClick={() => addPersonas(samplePersonas())}>Load sample personas</Button>
          <LinkButton href="/personas/generate" variant="secondary">
            Generate personas
          </LinkButton>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Set up a simulation" subtitle="Choose the people, the journey and the controls." />
      <div className="grid gap-6 lg:grid-cols-[1.9fr_1fr]">
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">
            <span className="mr-3">01</span>Select personas
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-ink px-5 py-3 text-center text-sm font-semibold text-white">Existing personas</div>
            <LinkButton href="/personas/generate" variant="secondary">
              Generate new
            </LinkButton>
          </div>
          <div className="mt-4">
            <Field label="Persona group">
              <select
                className={inputClass}
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setExcluded(new Set());
                }}
              >
                {segments.map((s) => (
                  <option key={s} value={s}>
                    {s} · {s === "All" ? personas.length : personas.filter((p) => p.segment === s).length} personas
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Personas in this run">
            {inGroup.map((p) => {
              const on = !excluded.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setExcluded((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    })
                  }
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition",
                    on ? "bg-blue-soft text-blue" : "bg-page text-muted line-through",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          <h2 className="mt-8 text-2xl font-semibold tracking-tight">
            <span className="mr-3">02</span>Simulation settings
          </h2>
          <div className="mt-4 space-y-4">
            <Field label="Product / scenario" hint={scenario.goal}>
              <select className={inputClass} value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Runs per persona" hint="1 to 10. More runs show how stable each persona's behaviour is.">
                <input className={inputClass} type="number" min={1} max={10} value={runs} onChange={(e) => setRuns(clampInt(e.target.value, 1, 10))} />
              </Field>
              <Field label="Step limit" hint="4 to 25. A journey that reaches it counts as a timeout.">
                <input className={inputClass} type="number" min={4} max={25} value={maxSteps} onChange={(e) => setMaxSteps(clampInt(e.target.value, 4, 25))} />
              </Field>
            </div>
            <Field label="Simulation name" hint="Optional.">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Loan flow, first pass" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl bg-blue-soft px-4 py-3 text-[15px] font-medium">
                <span className="relative h-5 w-9 shrink-0 rounded-full bg-blue">
                  <span className="absolute left-[18px] top-0.5 h-4 w-4 rounded-full bg-white" />
                </span>
                Persona conditioning
              </div>
              <Toggle checked={withBaseline} onChange={setWithBaseline} label="Compare with baseline" tone="lime" />
            </div>
            {!ready ? (
              <Notice tone="warn">
                <Link href="/settings" className="font-semibold text-blue underline">
                  Add a Gemini API key in Settings
                </Link>{" "}
                to start a simulation.
              </Notice>
            ) : engine === "gemini" ? (
              <Notice>
                About {calls} model calls. At {settings.requestsPerMinute} requests a minute this takes roughly {minutes}{" "}
                {minutes === 1 ? "minute" : "minutes"}. Keep this tab open while it runs.
              </Notice>
            ) : (
              <Notice>Keep this tab open while it runs.</Notice>
            )}
            <Button className="w-full" disabled={selected.length === 0 || !ready} onClick={start}>
              Start simulation
            </Button>
            {selected.length === 0 && <p className="text-center text-sm text-muted">Select at least one persona.</p>}
          </div>
        </Card>

        <DarkCard className="self-start">
          <h2 className="text-[28px] font-semibold tracking-tight">Controlled by design.</h2>
          <div className="mt-8 text-[72px] font-semibold leading-none text-lime">{selected.length * runs}</div>
          <p className="mt-5 text-[17px] leading-snug">
            conditioned journeys
            <br />
            {withBaseline ? `plus ${baselineRuns} matched baseline runs` : "with no baseline"}
          </p>
          <p className="mt-6 text-[17px] leading-snug">
            Valid transitions
            <br />
            Persistent session context
            <br />
            Structured action traces
          </p>
          <p className="mt-6 text-sm leading-relaxed text-white/75">
            {journeys} agents in total, {settings.concurrency} at a time. Compare conditioning effects separately from claims about human
            behaviour.
          </p>
        </DarkCard>
      </div>
    </>
  );
}
