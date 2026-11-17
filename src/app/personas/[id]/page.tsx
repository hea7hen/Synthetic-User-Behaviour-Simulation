"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Badge, Button, Card, Empty, LinkButton, Modal, OutcomeBadge, PageHeader, TraitBar } from "@/components/ui";
import { getScenario } from "@/lib/engine/scenarios";
import { OCEAN_KEYS } from "@/lib/engine/types";
import { fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";

const SOURCE: Record<string, string> = {
  manual: "Created by hand",
  gemini: "Written by the Persona Architect (Gemini)",
  demo: "Written by the scripted demo architect",
  sample: "Sample persona",
};

export default function PersonaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const persona = useStore((s) => s.personas.find((p) => p.id === id));
  const simulations = useStore((s) => s.simulations);
  const removePersona = useStore((s) => s.removePersona);
  const [confirm, setConfirm] = useState(false);

  if (!persona) {
    return (
      <Empty title="Persona not found" text="It may have been deleted.">
        <LinkButton href="/personas">Back to personas</LinkButton>
      </Empty>
    );
  }

  const journeys = simulations.flatMap((sim) =>
    sim.sessions.filter((s) => s.personaId === persona.id && s.status === "done").map((s) => ({ sim, s })),
  );

  return (
    <>
      <PageHeader
        title="Persona details"
        subtitle={SOURCE[persona.source]}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(true)}>
              Delete persona
            </Button>
            <LinkButton href="/personas">Back to personas</LinkButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <div className="rounded-2xl bg-blue-soft p-6">
            <Avatar name={persona.name} size={84} />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">{persona.name}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {persona.age} · {persona.gender}
              <br />
              {persona.occupation}
              <br />
              {persona.location}
              {persona.monthlyIncome && (
                <>
                  <br />
                  {persona.monthlyIncome} a month
                </>
              )}
            </p>
            <div className="mt-4">
              <Badge tone="info">{persona.segment}</Badge>
            </div>
          </div>
          <Card>
            <h3 className="text-lg font-semibold">Personality (OCEAN)</h3>
            <div className="mt-4 space-y-3">
              {OCEAN_KEYS.map((k) => (
                <TraitBar key={k} label={k[0].toUpperCase() + k.slice(1)} value={persona.ocean[k]} />
              ))}
            </div>
            <h3 className="mt-6 text-lg font-semibold">Behaviour</h3>
            <div className="mt-4 space-y-3">
              <TraitBar label="Risk tolerance" value={persona.riskTolerance} />
              <TraitBar label="Digital literacy" value={persona.digitalLiteracy} />
              <TraitBar label="Price sensitivity" value={persona.priceSensitivity} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold">Backstory</h3>
            <p className="mt-2 text-[15px] leading-relaxed">{persona.backstory || "No backstory written."}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-muted">Goals</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
                  {persona.goals.length ? persona.goals.map((g) => <li key={g}>{g}</li>) : <li className="text-muted">None listed</li>}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted">Frustrations</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
                  {persona.frustrations.length ? (
                    persona.frustrations.map((g) => <li key={g}>{g}</li>)
                  ) : (
                    <li className="text-muted">None listed</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold">Journeys</h3>
            {journeys.length === 0 ? (
              <p className="mt-2 text-[15px] text-muted">This persona has not finished a journey yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-line">
                {journeys.map(({ sim, s }) => (
                  <Link
                    key={s.id}
                    href={`/simulations/${sim.id}/journeys/${encodeURIComponent(s.id)}`}
                    className="flex items-center justify-between gap-4 py-3 text-[15px] hover:bg-page"
                  >
                    <span>
                      <span className="font-semibold">{getScenario(sim.scenarioId).name}</span>
                      <span className="text-muted"> · {fmtDateTime(sim.createdAt)} · run {s.run} · {s.steps.length} steps</span>
                    </span>
                    <OutcomeBadge outcome={s.outcome} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={confirm} title="Delete this persona?" onClose={() => setConfirm(false)}>
        <p>{persona.name} will be removed from your personas. Finished simulations keep their own copy, so past results stay intact.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Keep persona
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              removePersona(persona.id);
              router.push("/personas");
            }}
          >
            Delete persona
          </Button>
        </div>
      </Modal>
    </>
  );
}
