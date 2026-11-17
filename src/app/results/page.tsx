"use client";

import { useMemo, useState } from "react";
import { ResultsView } from "@/components/ResultsView";
import { Empty, LinkButton, inputClass } from "@/components/ui";
import { getScenario } from "@/lib/engine/scenarios";
import { fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function ResultsPage() {
  const simulations = useStore((s) => s.simulations);
  const completed = useMemo(() => simulations.filter((s) => s.status === "completed"), [simulations]);
  const [picked, setPicked] = useState<string | null>(null);
  const sim = completed.find((s) => s.id === picked) ?? completed[0];

  if (!sim) {
    return (
      <Empty title="No results yet" text="Results appear here when a simulation finishes.">
        <LinkButton href="/simulations/new">Set up a simulation</LinkButton>
      </Empty>
    );
  }

  return (
    <ResultsView
      sim={sim}
      scenario={getScenario(sim.scenarioId)}
      headerActions={
        completed.length > 1 ? (
          <select
            aria-label="Choose a simulation"
            className={`${inputClass} w-auto max-w-[280px] py-2.5 text-sm`}
            value={sim.id}
            onChange={(e) => setPicked(e.target.value)}
          >
            {completed.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({fmtDateTime(s.createdAt)})
              </option>
            ))}
          </select>
        ) : undefined
      }
    />
  );
}
