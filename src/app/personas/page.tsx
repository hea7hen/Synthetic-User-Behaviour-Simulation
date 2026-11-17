"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { samplePersonas } from "@/lib/engine/personas";
import { useStore } from "@/lib/store";

export default function PersonasPage() {
  const personas = useStore((s) => s.personas);
  const addPersonas = useStore((s) => s.addPersonas);
  const [segment, setSegment] = useState("All");

  const segments = useMemo(() => ["All", ...Array.from(new Set(personas.map((p) => p.segment)))], [personas]);
  const shown = segment === "All" ? personas : personas.filter((p) => p.segment === segment);

  return (
    <>
      <PageHeader
        title="Personas"
        subtitle="Structured profiles that condition how each agent reads a screen and decides."
        actions={
          <>
            <LinkButton href="/personas/generate" variant="secondary">
              Generate personas
            </LinkButton>
            <LinkButton href="/personas/new">Create a persona</LinkButton>
          </>
        }
      />

      {personas.length === 0 ? (
        <Empty
          title="No personas yet"
          text="Start with six sample personas, have the Persona Architect agent generate a cohort, or build one by hand."
        >
          <Button onClick={() => addPersonas(samplePersonas())}>Load sample personas</Button>
          <LinkButton href="/personas/generate" variant="secondary">
            Generate personas
          </LinkButton>
          <LinkButton href="/personas/new" variant="secondary">
            Create a persona
          </LinkButton>
        </Empty>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {segments.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSegment(s)}
                className={
                  s === segment
                    ? "rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-page"
                }
              >
                {s} · {s === "All" ? personas.length : personas.filter((p) => p.segment === s).length}
              </button>
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => (
              <Link key={p.id} href={`/personas/${p.id}`} className="block rounded-2xl transition hover:shadow-md">
                <Card className="h-full">
                  <div className="flex items-start gap-4">
                    <Avatar name={p.name} size={52} />
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold">{p.name}</div>
                      <div className="text-sm text-muted">
                        {p.age} · {p.gender} · {p.occupation}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="info">{p.segment}</Badge>
                    <Badge>Neuroticism {Math.round(p.ocean.neuroticism)}</Badge>
                    <Badge>Risk tolerance {Math.round(p.riskTolerance)}</Badge>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm text-muted">{p.backstory}</p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
