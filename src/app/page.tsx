"use client";

import Link from "next/link";
import { useMemo } from "react";
import { OutcomeChart } from "@/components/charts";
import { Card, LinkButton, Notice, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { computeAnalytics } from "@/lib/engine/analytics";
import { getScenario } from "@/lib/engine/scenarios";
import { fmtDateTime, greeting, pct, signedPoints } from "@/lib/format";
import { canRun, useStore } from "@/lib/store";

export default function DashboardPage() {
  const settings = useStore((s) => s.settings);
  const personas = useStore((s) => s.personas);
  const simulations = useStore((s) => s.simulations);

  const completed = useMemo(() => simulations.filter((s) => s.status === "completed"), [simulations]);
  const latest = completed[0];
  const latestStats = useMemo(() => (latest ? computeAnalytics(latest, getScenario(latest.scenarioId)) : undefined), [latest]);
  const chart = useMemo(
    () =>
      completed
        .slice(0, 7)
        .reverse()
        .map((sim) => {
          const done = sim.sessions.filter((s) => s.condition === "persona" && s.status === "done");
          return {
            label: fmtDateTime(sim.createdAt),
            completed: done.filter((s) => s.outcome === "completed").length,
            abandoned: done.filter((s) => s.outcome === "abandoned").length,
            timeout: done.filter((s) => s.outcome === "timeout").length,
          };
        }),
    [completed],
  );
  const segments = new Set(personas.map((p) => p.segment)).size;
  const name = settings.displayName.trim().split(/\s+/)[0];
  const hasBaseline = Boolean(latestStats && latestStats.baseline.total > 0);

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        subtitle="Understand how different people experience your product."
        actions={
          <LinkButton href="/simulations/new" className="min-w-[200px]">
            New simulation
          </LinkButton>
        }
      />

      {!canRun(settings) && (
        <div className="mb-6">
          <Notice>
            <Link href="/settings" className="font-semibold text-blue underline">
              Add a Gemini API key in Settings
            </Link>{" "}
            to run simulations.
          </Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="grid gap-5">
          <Stat
            dark
            label={latest ? "Conversion rate, latest run" : "Conversion rate"}
            value={latestStats ? pct(latestStats.persona.conversionRate) : "–"}
            note={
              latestStats
                ? hasBaseline
                  ? `${signedPoints(latestStats.persona.conversionRate - latestStats.baseline.conversionRate)} vs. no-persona baseline`
                  : "No baseline in this run"
                : "Run a simulation to see this"
            }
          />
          <Stat
            label="Total personas"
            value={String(personas.length)}
            note={personas.length ? `Across ${segments} audience ${segments === 1 ? "segment" : "segments"}` : "None yet"}
            noteTone={personas.length ? "good" : "muted"}
          />
          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="text-sm text-muted">Runs</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{simulations.length}</div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="text-sm text-muted">Abandoned</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{latestStats ? pct(latestStats.persona.abandonmentRate) : "–"}</div>
            </div>
          </div>
        </div>

        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">User journey outcomes</h2>
          <p className="mt-1 text-sm text-muted">Persona-conditioned journeys in your most recent completed runs.</p>
          {chart.length ? (
            <div className="mt-3">
              <OutcomeChart data={chart} />
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-[15px] text-muted">Outcomes appear here after your first run.</div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Recent simulations</h2>
            <LinkButton href="/simulations" variant="secondary" className="min-w-[150px]">
              View all
            </LinkButton>
          </div>
          {simulations.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[15px]">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="py-2 font-medium">Date &amp; time</th>
                    <th className="py-2 font-medium">Simulation</th>
                    <th className="py-2 font-medium">Journeys</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {simulations.slice(0, 4).map((sim) => (
                    <tr key={sim.id}>
                      <td className="py-3.5 text-muted">{fmtDateTime(sim.createdAt)}</td>
                      <td className="py-3.5">
                        <Link href={`/simulations/${sim.id}`} className="font-semibold hover:underline">
                          {sim.name}
                        </Link>
                      </td>
                      <td className="py-3.5 tabular-nums">{sim.sessions.length}</td>
                      <td className="py-3.5">
                        <StatusBadge status={sim.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-[15px] text-muted">No simulations yet. Your runs will be listed here.</p>
          )}
        </Card>

        <div className="rounded-2xl bg-lime-soft p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Find friction earlier.</h2>
          <p className="mt-3 text-[15px] text-ink/75">Screen for hesitation, trust and abandonment before recruiting real users.</p>
          <div className="mt-5">
            {latest ? (
              <LinkButton href="/results" className="min-w-[200px]">
                Explore results
              </LinkButton>
            ) : personas.length ? (
              <LinkButton href="/simulations/new" className="min-w-[200px]">
                Set up a simulation
              </LinkButton>
            ) : (
              <LinkButton href="/personas" className="min-w-[200px]">
                Add personas
              </LinkButton>
            )}
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-muted">Synthetic signals support early screening, not human-fidelity claims.</p>
    </>
  );
}
