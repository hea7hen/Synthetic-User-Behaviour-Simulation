"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ActionChart, FactorDonut, FunnelChart, factorColor } from "@/components/charts";
import { Badge, Button, Card, Notice, OutcomeBadge, PageHeader, Stat } from "@/components/ui";
import { computeAnalytics } from "@/lib/engine/analytics";
import { stateLabel } from "@/lib/engine/scenarios";
import type { Scenario, Simulation } from "@/lib/engine/types";
import { downloadFile, journeysCsv, stepsCsv } from "@/lib/export";
import { fmtDateTime, fmtMs, pct, signedPoints } from "@/lib/format";

const SEVERITY = { high: "bad", medium: "warn", low: "neutral" } as const;

function fmtP(p: number): string {
  return p < 0.001 ? "< 0.001" : p.toFixed(3);
}

export function ResultsView({ sim, scenario, headerActions }: { sim: Simulation; scenario: Scenario; headerActions?: ReactNode }) {
  const a = useMemo(() => computeAnalytics(sim, scenario), [sim, scenario]);
  const [filter, setFilter] = useState<"all" | "persona" | "baseline">("all");
  const hasBaseline = a.baseline.total > 0;
  const partial = sim.status !== "completed";
  const journeys = sim.sessions.filter((s) => s.status === "done" && (filter === "all" || s.condition === filter));
  const slug = sim.id;
  const topCorr = a.correlations.slice(0, 8);
  const smallSample = a.persona.total < 20;

  return (
    <>
      <PageHeader
        title="Results & analytics"
        subtitle={
          hasBaseline
            ? "Conditioned personas compared with the no-persona baseline."
            : "Persona-conditioned journeys. No baseline was run."
        }
        actions={
          <>
            {headerActions}
            <Button variant="secondary" onClick={() => downloadFile(`subs-${slug}-journeys.csv`, journeysCsv(sim, scenario), "text/csv")}>
              Journeys CSV
            </Button>
            <Button variant="secondary" onClick={() => downloadFile(`subs-${slug}-steps.csv`, stepsCsv(sim, scenario), "text/csv")}>
              Action log CSV
            </Button>
            <Button variant="secondary" onClick={() => downloadFile(`subs-${slug}.json`, JSON.stringify(sim, null, 2), "application/json")}>
              Full trace JSON
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="font-semibold text-ink">{sim.name}</span>
        <span>· {scenario.name}</span>
        <span>· {fmtDateTime(sim.createdAt)}</span>
        {sim.engine === "gemini" && <Badge tone="good">Gemini · {sim.model}</Badge>}
        {sim.startedAt && sim.endedAt && <span>· ran for {fmtMs(sim.endedAt - sim.startedAt)}</span>}
      </div>

      <div className="mb-6 space-y-3">
        {partial && <Notice tone="warn">Partial results. This run did not finish, so only {a.persona.total + a.baseline.total} journeys are included.</Notice>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          dark
          label="Conversion"
          value={pct(a.persona.conversionRate)}
          note={hasBaseline ? `${signedPoints(a.persona.conversionRate - a.baseline.conversionRate)} vs. baseline (${pct(a.baseline.conversionRate)})` : `${a.persona.completed} of ${a.persona.total} journeys`}
        />
        <Stat
          label="Abandonment"
          value={pct(a.persona.abandonmentRate)}
          note={hasBaseline ? `${signedPoints(a.persona.abandonmentRate - a.baseline.abandonmentRate)} vs. baseline (${pct(a.baseline.abandonmentRate)})` : `${a.persona.abandoned} of ${a.persona.total} journeys`}
        />
        <Stat
          label="Average journey"
          value={a.persona.completed ? a.persona.avgStepsCompleted.toFixed(1) : a.persona.avgSteps.toFixed(1)}
          note={a.persona.completed ? "actions per completed journey" : "actions per journey"}
        />
        <Stat
          label="Total journeys"
          value={String(a.persona.total + a.baseline.total)}
          note={hasBaseline ? `${a.persona.total} with persona, ${a.baseline.total} baseline` : `${a.persona.total} with persona`}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[2.4fr_1fr]">
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Journey flow comparison</h2>
          <p className="mt-1 text-sm text-muted">Share of journeys that reached each screen on the main path.</p>
          <div className="mt-3">
            <FunnelChart data={a.funnel} showBaseline={hasBaseline} />
          </div>
        </Card>
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Decision factors</h2>
          <p className="mt-1 text-sm text-muted">What persona agents said mattered most, across all steps.</p>
          {a.factors.length ? (
            <>
              <FactorDonut data={a.factors} />
              <ul className="mt-2 space-y-1.5 text-sm">
                {a.factors.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: factorColor(i) }} />
                    <span>{f.label}</span>
                    <span className="ml-auto tabular-nums text-muted">{Math.round(f.share)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">No steps recorded.</p>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Friction findings</h2>
          <Badge tone="info">Insight Analyst{sim.insights?.generatedBy === "gemini" ? " · Gemini" : sim.insights ? "" : " · not available"}</Badge>
        </div>
        {sim.insights ? (
          <>
            <p className="mt-3 max-w-4xl text-[15px] leading-relaxed">{sim.insights.summary}</p>
            {sim.insights.frictionPoints.length > 0 && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {sim.insights.frictionPoints.map((f, i) => (
                  <div key={i} className="rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">{f.title}</div>
                      <Badge tone={SEVERITY[f.severity]}>{f.severity}</Badge>
                    </div>
                    {f.stateId && <div className="mt-0.5 text-xs text-muted">Screen: {stateLabel(scenario, f.stateId)}</div>}
                    <p className="mt-2 text-sm text-ink/85">{f.evidence}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">Try: </span>
                      {f.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-muted">Persona patterns</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {sim.insights.personaPatterns.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted">Limits of this evidence</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {sim.insights.caveats.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {sim.insightsError ? `The Insight Analyst could not write a report: ${sim.insightsError}` : "No analyst report for this run."}
          </p>
        )}
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Action frequency</h2>
          <p className="mt-1 text-sm text-muted">Share of all actions taken in each condition.</p>
          <div className="mt-3">
            <ActionChart data={a.actions} showBaseline={hasBaseline} />
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Do traits change behaviour?</h2>
          <p className="mt-1 text-sm text-muted">Pearson r between persona traits and outcomes, one point per persona journey.</p>
          {topCorr.length ? (
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-2 font-medium">Trait</th>
                  <th className="py-2 font-medium">Outcome</th>
                  <th className="py-2 text-right font-medium">r</th>
                  <th className="py-2 text-right font-medium">p</th>
                  <th className="py-2 text-right font-medium">n</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {topCorr.map((c) => (
                  <tr key={`${c.trait}-${c.outcome}`} className={clsx(c.result.p >= 0.05 && "text-muted")}>
                    <td className="py-2">{c.traitLabel}</td>
                    <td className="py-2">{c.outcomeLabel}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{c.result.r.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtP(c.result.p)}</td>
                    <td className="py-2 text-right tabular-nums">{c.result.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-muted">Needs at least four finished persona journeys with varied outcomes.</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Greyed rows have p ≥ 0.05 and should not be read as effects. Many pairs are tested at once, so a few low p-values can appear by
            chance.{smallSample && ` With n = ${a.persona.total}, treat every row as a lead to test, not a finding.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <div className="text-xs text-muted">Journey length vs baseline (KS test)</div>
              <div className="mt-0.5 font-semibold tabular-nums">
                {a.ksSteps ? `D = ${a.ksSteps.d.toFixed(2)}, p = ${fmtP(a.ksSteps.p)}` : "No baseline to compare"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Actions the validator corrected</div>
              <div className="mt-0.5 font-semibold tabular-nums">
                {a.coercedSteps} of {a.totalSteps}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {a.dropoffs.length > 0 && (
        <Card className="mt-5">
          <h2 className="text-2xl font-semibold tracking-tight">Where journeys ended early</h2>
          <div className="mt-4 space-y-3">
            {a.dropoffs.map((d) => {
              const h = a.hesitation.find((x) => x.stateId === d.stateId);
              return (
                <div key={d.stateId} className="grid items-center gap-3 text-sm sm:grid-cols-[220px_1fr_auto]">
                  <div className="font-semibold">{d.label}</div>
                  <div className="h-2.5 rounded-full bg-page">
                    <div className="h-2.5 rounded-full bg-warn" style={{ width: `${Math.max(3, d.share)}%` }} />
                  </div>
                  <div className="tabular-nums text-muted">
                    {d.count} of {a.persona.total} left here{h ? ` · ${Math.round(h.share)}% of visits uneasy` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Explore individual journeys</h2>
          <div className="flex gap-2">
            {(["all", "persona", "baseline"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold",
                  filter === f ? "bg-ink text-white" : "border border-line bg-white hover:bg-page",
                )}
              >
                {f === "all" ? "All" : f === "persona" ? "With persona" : "Baseline"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 font-medium">Agent</th>
                <th className="py-2 font-medium">Condition</th>
                <th className="py-2 font-medium">Run</th>
                <th className="py-2 font-medium">Steps</th>
                <th className="py-2 font-medium">Ended at</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {journeys.map((s) => (
                <tr key={s.id} className="hover:bg-page">
                  <td className="py-3">
                    <Link href={`/simulations/${sim.id}/journeys/${encodeURIComponent(s.id)}`} className="font-semibold hover:underline">
                      {s.label}
                    </Link>
                  </td>
                  <td className="py-3 text-muted">{s.condition === "persona" ? "With persona" : "No persona"}</td>
                  <td className="py-3 tabular-nums">{s.run}</td>
                  <td className="py-3 tabular-nums">{s.steps.length}</td>
                  <td className="py-3 text-muted">
                    {s.outcome === "completed"
                      ? stateLabel(scenario, s.terminalStateId ?? "")
                      : stateLabel(scenario, s.steps[s.steps.length - 1]?.stateId ?? "")}
                  </td>
                  <td className="py-3">
                    <OutcomeBadge outcome={s.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {journeys.length === 0 && <p className="py-6 text-center text-sm text-muted">No journeys in this view.</p>}
        </div>
      </Card>

      <p className="mt-5 text-xs text-muted">
        Synthetic signals support early screening. They do not show how real people behave, so check candidate issues with real users.
      </p>
    </>
  );
}
