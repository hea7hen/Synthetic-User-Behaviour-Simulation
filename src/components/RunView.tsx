"use client";

import clsx from "clsx";
import { Bot, BrainCircuit, ShieldCheck, Sparkles, UserRound, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, Button, Card, DarkCard, LinkButton, Modal, Notice, OutcomeBadge, PageHeader } from "@/components/ui";
import { stateLabel } from "@/lib/engine/scenarios";
import type { Scenario, Session, Simulation } from "@/lib/engine/types";
import { cancelSimulation, rerunSimulation } from "@/lib/runner";
import { canRun, useStore } from "@/lib/store";

function AgentRow({ icon, name, status, active }: { icon: ReactNode; name: string; status: string; active: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-lime text-ink" : "bg-white/10 text-white/70")}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{name}</div>
        <div className="truncate text-xs text-white/65">{status}</div>
      </div>
      {active && <span className="pulse-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-lime" />}
    </div>
  );
}

function SessionCard({ session, scenario }: { session: Session; scenario: Scenario }) {
  const last = session.steps[session.steps.length - 1];
  const where = session.status === "queued" ? "Waiting to start" : stateLabel(scenario, session.currentStateId ?? scenario.entry);
  return (
    <div className={clsx("rounded-xl border p-4", session.status === "running" ? "border-blue bg-blue-soft/50" : "border-line bg-white")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{session.label}</div>
          <div className="text-xs text-muted">
            {session.condition === "persona" ? `Persona agent · run ${session.run}` : "Baseline agent · no persona"}
          </div>
        </div>
        <OutcomeBadge outcome={session.status === "done" || session.status === "error" ? session.outcome : session.status} />
      </div>
      <div className="mt-3 text-xs text-muted">
        {where} · {session.steps.length} {session.steps.length === 1 ? "step" : "steps"}
      </div>
      {session.error ? (
        <p className="mt-2 line-clamp-2 text-xs text-bad">{session.error}</p>
      ) : (
        last && <p className="mt-2 line-clamp-2 text-xs italic text-ink/80">&ldquo;{last.thought}&rdquo;</p>
      )}
    </div>
  );
}

/** Live view of a run in progress, and the view for a run that failed or was cancelled. */
export function RunView({ sim, scenario, onViewResults }: { sim: Simulation; scenario: Scenario; onViewResults: () => void }) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const settings = useStore((s) => s.settings);

  const live = sim.status === "running" || sim.status === "analyzing" || sim.status === "queued";
  const total = sim.sessions.length;
  const done = sim.sessions.filter((s) => s.status === "done" || s.status === "error").length;
  const runningNow = sim.sessions.filter((s) => s.status === "running");
  const personaRunning = runningNow.filter((s) => s.condition === "persona").length;
  const baselineRunning = runningNow.filter((s) => s.condition === "baseline").length;
  const personaTotal = sim.sessions.filter((s) => s.condition === "persona").length;
  const baselineTotal = total - personaTotal;
  const personaDone = sim.sessions.filter((s) => s.condition === "persona" && s.status === "done").length;
  const baselineDone = sim.sessions.filter((s) => s.condition === "baseline" && s.status === "done").length;
  const steps = sim.sessions.reduce((n, s) => n + s.steps.length, 0);
  const coerced = sim.sessions.reduce((n, s) => n + s.steps.filter((st) => st.coerced).length, 0);
  const progress = total ? Math.round((done / total) * (sim.status === "analyzing" ? 100 : 96)) : 0;
  const finishedOk = sim.sessions.filter((s) => s.status === "done").length;

  const title = live ? (sim.status === "analyzing" ? "Analysing journeys" : "Simulation running") : sim.status === "failed" ? "Simulation failed" : "Simulation cancelled";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${sim.name} · ${scenario.name}`}
        actions={
          live ? (
            <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
              Cancel simulation
            </Button>
          ) : (
            <>
              <LinkButton href="/simulations/new" variant="secondary">
                Edit setup
              </LinkButton>
              <Button disabled={!canRun(settings)} onClick={() => router.push(`/simulations/${rerunSimulation(sim).id}`)}>
                Run again
              </Button>
            </>
          )
        }
      />

      {sim.status === "failed" && (
        <div className="mb-6">
          <Notice tone="bad">
            <strong>What went wrong:</strong> {sim.error ?? "The run stopped unexpectedly."}{" "}
            {sim.engine === "gemini" && "Check the API key, model and rate limits in Settings, then run again."}
          </Notice>
        </div>
      )}
      {sim.status === "cancelled" && (
        <div className="mb-6">
          <Notice tone="warn">
            This run was cancelled. {finishedOk} of {total} journeys had finished and were kept.
          </Notice>
        </div>
      )}
      {!live && finishedOk > 0 && (
        <div className="mb-6">
          <Button variant="secondary" onClick={onViewResults}>
            View partial results from {finishedOk} journeys
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm text-muted">Journeys finished</div>
                <div className="mt-1 text-[40px] font-semibold leading-none tracking-tight tabular-nums">
                  {done} <span className="text-xl text-muted">of {total}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sim.engine === "gemini" && <Badge tone="good">{sim.model}</Badge>}
                <Badge>{steps} steps logged</Badge>
                <Badge>{sim.requests} agent decisions</Badge>
              </div>
            </div>
            <div className="mt-5 h-3 rounded-full bg-page" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={clsx("h-3 rounded-full transition-all", sim.status === "failed" ? "bg-bad" : sim.status === "cancelled" ? "bg-muted" : "bg-blue")}
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-tight">Agents at work</h2>
            <p className="mt-1 text-sm text-muted">Each card is one agent walking the journey. The quote is its latest reasoning.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sim.sessions.map((s) => (
                <SessionCard key={s.id} session={s} scenario={scenario} />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <DarkCard>
            <h2 className="text-xl font-semibold tracking-tight">Agent team</h2>
            <div className="mt-3 divide-y divide-white/10">
              <AgentRow
                icon={<Workflow size={18} />}
                name="Orchestrator"
                status={live ? `Scheduling ${total} journeys, ${runningNow.length} active` : "Stopped"}
                active={sim.status === "running"}
              />
              <AgentRow
                icon={<UserRound size={18} />}
                name={`Persona agents · ${personaTotal}`}
                status={`${personaRunning} deciding, ${personaDone} finished`}
                active={personaRunning > 0}
              />
              <AgentRow
                icon={<Bot size={18} />}
                name={`Baseline agents · ${baselineTotal}`}
                status={baselineTotal ? `${baselineRunning} deciding, ${baselineDone} finished` : "Not used in this run"}
                active={baselineRunning > 0}
              />
              <AgentRow
                icon={<ShieldCheck size={18} />}
                name="Validator"
                status={`${steps} actions checked, ${coerced} corrected`}
                active={runningNow.length > 0}
              />
              <AgentRow
                icon={<BrainCircuit size={18} />}
                name="Insight Analyst"
                status={sim.status === "analyzing" ? "Reading the finished journeys" : sim.insights ? "Report written" : "Waits for journeys to finish"}
                active={sim.status === "analyzing"}
              />
            </div>
          </DarkCard>

          <Card>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Sparkles size={18} /> Activity
            </h2>
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1 text-xs" aria-live="polite">
              {[...sim.log]
                .reverse()
                .slice(0, 80)
                .map((l, i) => (
                  <div key={`${l.t}-${i}`} className="leading-relaxed">
                    {l.agent !== "persona" && l.agent !== "baseline" && <span className="font-semibold capitalize text-blue">{l.agent} </span>}
                    <span className="text-ink/85">{l.text}</span>
                  </div>
                ))}
              {sim.log.length === 0 && <p className="text-muted">Starting…</p>}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={confirmCancel} title="Cancel this simulation?" onClose={() => setConfirmCancel(false)}>
        <p>
          Agents stop after their current step. The {done} journeys that have finished are kept, and the rest are discarded.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
            Keep running
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              cancelSimulation(sim.id);
              setConfirmCancel(false);
            }}
          >
            Cancel simulation
          </Button>
        </div>
      </Modal>
    </>
  );
}
