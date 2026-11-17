"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ResultsView } from "@/components/ResultsView";
import { RunView } from "@/components/RunView";
import { Button, Empty, LinkButton } from "@/components/ui";
import { getScenario } from "@/lib/engine/scenarios";
import { useStore } from "@/lib/store";

export default function SimulationPage() {
  const { id } = useParams<{ id: string }>();
  const sim = useStore((s) => s.simulations.find((x) => x.id === id));
  const [showPartial, setShowPartial] = useState(false);

  if (!sim) {
    return (
      <Empty title="Simulation not found" text="It may have been deleted, or this link is from another browser.">
        <LinkButton href="/simulations">Back to simulations</LinkButton>
      </Empty>
    );
  }
  const scenario = getScenario(sim.scenarioId);
  if (sim.status === "completed") return <ResultsView sim={sim} scenario={scenario} />;
  if (showPartial && (sim.status === "failed" || sim.status === "cancelled")) {
    return (
      <ResultsView
        sim={sim}
        scenario={scenario}
        headerActions={
          <Button variant="secondary" onClick={() => setShowPartial(false)}>
            Back to run status
          </Button>
        }
      />
    );
  }
  return <RunView sim={sim} scenario={scenario} onViewResults={() => setShowPartial(true)} />;
}
