"use client";

import Link from "next/link";
import { Badge, Card, Empty, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { getScenario } from "@/lib/engine/scenarios";
import { fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function SimulationsPage() {
  const simulations = useStore((s) => s.simulations);

  return (
    <>
      <PageHeader
        title="Simulations"
        subtitle="Every run, with its journeys and status."
        actions={<LinkButton href="/simulations/new">New simulation</LinkButton>}
      />
      {simulations.length === 0 ? (
        <Empty title="No simulations yet" text="Set up a run: choose personas, a product journey and a baseline to compare against.">
          <LinkButton href="/simulations/new">Set up a simulation</LinkButton>
        </Empty>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-[15px]">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-6 py-4 font-medium">Date &amp; time</th>
                <th className="px-3 py-4 font-medium">Simulation</th>
                <th className="px-3 py-4 font-medium">Scenario</th>
                <th className="px-3 py-4 font-medium">Journeys</th>
                <th className="px-3 py-4 font-medium">Agents</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {simulations.map((sim) => {
                const done = sim.sessions.filter((s) => s.status === "done").length;
                return (
                  <tr key={sim.id} className="hover:bg-page">
                    <td className="px-6 py-4 text-muted">{fmtDateTime(sim.createdAt)}</td>
                    <td className="px-3 py-4">
                      <Link href={`/simulations/${sim.id}`} className="font-semibold hover:underline">
                        {sim.name}
                      </Link>
                    </td>
                    <td className="px-3 py-4">{getScenario(sim.scenarioId).name}</td>
                    <td className="px-3 py-4 tabular-nums">
                      {done} of {sim.sessions.length}
                    </td>
                    <td className="px-3 py-4">
                      <Badge tone={sim.engine === "gemini" ? "good" : "neutral"}>{sim.engine === "gemini" ? (sim.model ?? "Gemini") : "Demo (scripted)"}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sim.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
