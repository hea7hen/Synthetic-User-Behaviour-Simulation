"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Card, DarkCard, Empty, LinkButton, OutcomeBadge, PageHeader, Tabs } from "@/components/ui";
import { computeAnalytics } from "@/lib/engine/analytics";
import { factorLabel, getScenario, stateLabel } from "@/lib/engine/scenarios";
import { fmtMs, pct } from "@/lib/format";
import { useStore } from "@/lib/store";

type Tab = "steps" | "log" | "insights";

const UNEASY = new Set(["hesitant", "anxious", "frustrated"]);

export default function JourneyPage() {
  const params = useParams<{ id: string; sessionId: string }>();
  const sessionId = decodeURIComponent(params.sessionId);
  const sim = useStore((s) => s.simulations.find((x) => x.id === params.id));
  const [tab, setTab] = useState<Tab>("steps");

  const scenario = sim ? getScenario(sim.scenarioId) : undefined;
  const analytics = useMemo(() => (sim && scenario ? computeAnalytics(sim, scenario) : undefined), [sim, scenario]);
  const session = sim?.sessions.find((s) => s.id === sessionId);

  if (!sim || !scenario || !session || !analytics) {
    return (
      <Empty title="Journey not found" text="It may belong to a simulation that was deleted.">
        <LinkButton href="/results">Back to results</LinkButton>
      </Empty>
    );
  }

  const persona = session.personaId ? sim.personas.find((p) => p.id === session.personaId) : undefined;
  const uneasy = session.steps.filter((s) => UNEASY.has(s.emotion));
  const corrected = session.steps.filter((s) => s.coerced).length;
  const topDrop = analytics.dropoffs[0];
  const topHesitation = analytics.hesitation.find((h) => h.visits >= 2);
  const endLabel =
    session.outcome === "timeout" ? "Reached the step limit without finishing." : `Reached a terminal ${session.outcome} state.`;

  return (
    <>
      <PageHeader
        title="Detailed journey"
        subtitle={`${session.label} · ${scenario.name}`}
        actions={<LinkButton href={`/simulations/${sim.id}`}>Back to results</LinkButton>}
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">{session.label}</div>
            <div className="mt-1 text-sm text-muted">
              {persona
                ? `Age ${persona.age} · ${persona.occupation} · neuroticism ${Math.round(persona.ocean.neuroticism)} · conscientiousness ${Math.round(persona.ocean.conscientiousness)} · risk tolerance ${Math.round(persona.riskTolerance)}`
                : "No-persona baseline agent: same journey and model, no profile."}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={sim.engine === "gemini" ? "good" : "neutral"}>{sim.engine === "gemini" ? sim.model : "Demo agent (scripted)"}</Badge>
            <OutcomeBadge outcome={session.outcome} />
          </div>
        </div>
      </Card>

      <div className="mb-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { id: "steps", label: "Journey steps" },
            { id: "log", label: "Action log" },
            { id: "insights", label: "Insights" },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2.5fr_1fr]">
        <Card>
          {tab === "steps" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">A valid path, step by step.</h2>
              <ol className="mt-5 space-y-5">
                {session.steps.map((st) => (
                  <li key={st.index} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-xs font-bold text-blue">
                      {String(st.index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-lg font-semibold">{stateLabel(scenario, st.stateId)}</div>
                        <div className="text-xs tabular-nums text-muted">agent time {fmtMs(st.elapsedMs)}</div>
                      </div>
                      <p className="mt-1 text-[15px] italic text-ink/85">&ldquo;{st.thought}&rdquo;</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">→ {st.actionLabel}</span>
                        <Badge tone={UNEASY.has(st.emotion) ? "warn" : st.emotion === "confident" ? "good" : "neutral"}>{st.emotion}</Badge>
                        <Badge>{factorLabel(scenario, st.factor)}</Badge>
                        {st.coerced && <Badge tone="bad">corrected by validator</Badge>}
                      </div>
                    </div>
                  </li>
                ))}
                <li className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-lime">
                    {String(session.steps.length + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-lg font-semibold">
                      {session.terminalStateId ? stateLabel(scenario, session.terminalStateId) : "Step limit reached"}
                    </div>
                    <p className="mt-1 text-sm text-muted">{endLabel}</p>
                  </div>
                </li>
              </ol>
            </>
          )}

          {tab === "log" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Action log</h2>
              <p className="mt-1 text-sm text-muted">Every decision as recorded: what the agent asked for and what the validator allowed.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Screen</th>
                      <th className="py-2 pr-3 font-medium">Requested</th>
                      <th className="py-2 pr-3 font-medium">Allowed</th>
                      <th className="py-2 pr-3 font-medium">Emotion</th>
                      <th className="py-2 pr-3 font-medium">Factor</th>
                      <th className="py-2 pr-3 text-right font-medium">Confidence</th>
                      <th className="py-2 text-right font-medium">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {session.steps.map((st) => (
                      <tr key={st.index}>
                        <td className="py-2 pr-3 tabular-nums">{st.index + 1}</td>
                        <td className="py-2 pr-3">{stateLabel(scenario, st.stateId)}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{st.requestedAction || "(empty)"}</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {st.actionId}
                          {st.coerced && <span className="ml-1 text-bad">(corrected)</span>}
                        </td>
                        <td className="py-2 pr-3">{st.emotion}</td>
                        <td className="py-2 pr-3">{factorLabel(scenario, st.factor)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{st.confidence.toFixed(2)}</td>
                        <td className="py-2 text-right tabular-nums">{fmtMs(st.latencyMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "insights" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">What this journey shows</h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted">Steps taken</dt>
                  <dd className="text-3xl font-semibold tabular-nums">{session.steps.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Uneasy moments</dt>
                  <dd className="text-3xl font-semibold tabular-nums">{uneasy.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Actions corrected</dt>
                  <dd className="text-3xl font-semibold tabular-nums">{corrected}</dd>
                </div>
              </dl>
              <h3 className="mt-6 text-sm font-semibold text-muted">Where this agent hesitated</h3>
              {uneasy.length ? (
                <ul className="mt-2 space-y-3">
                  {uneasy.map((st) => (
                    <li key={st.index} className="rounded-xl bg-warn-soft px-4 py-3 text-sm">
                      <span className="font-semibold">{stateLabel(scenario, st.stateId)}</span> ({st.emotion}): &ldquo;{st.thought}&rdquo;
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No hesitant, anxious or frustrated steps were recorded.</p>
              )}
              <h3 className="mt-6 text-sm font-semibold text-muted">How it ended</h3>
              <p className="mt-2 text-[15px]">{endLabel}</p>
              {persona && (
                <>
                  <h3 className="mt-6 text-sm font-semibold text-muted">Persona backstory</h3>
                  <p className="mt-2 text-[15px] leading-relaxed">{persona.backstory}</p>
                </>
              )}
            </>
          )}
        </Card>

        <DarkCard className="self-start">
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Where people pause matters.</h2>
          <div className="mt-7 text-[56px] font-semibold leading-none text-lime">{pct(analytics.persona.abandonmentRate)}</div>
          <p className="mt-3 text-[15px]">of persona journeys in this run were abandoned</p>
          {topDrop && (
            <>
              <div className="mt-7 text-[40px] font-semibold leading-none">{Math.round(topDrop.share)}%</div>
              <p className="mt-3 text-[15px]">dropped off at {topDrop.label}</p>
            </>
          )}
          {topHesitation && topHesitation.share > 0 && (
            <>
              <div className="mt-7 text-[40px] font-semibold leading-none">{Math.round(topHesitation.share)}%</div>
              <p className="mt-3 text-[15px]">of visits to {topHesitation.label} were uneasy</p>
            </>
          )}
          <p className="mt-6 text-xs leading-relaxed text-white/70">
            Cohort observations from {analytics.persona.total} synthetic journeys{sim.engine === "demo" ? " run by scripted demo agents" : ""}. They
            need validation with real users.
          </p>
        </DarkCard>
      </div>
    </>
  );
}
