import { stateLabel } from "./engine/scenarios";
import type { Scenario, Simulation } from "./engine/types";

export function downloadFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per journey. */
export function journeysCsv(sim: Simulation, scenario: Scenario): string {
  const rows = [["journey", "condition", "run", "outcome", "steps", "ended_at", "duration_ms", "engine", "model"]];
  for (const s of sim.sessions) {
    rows.push([
      s.label,
      s.condition === "persona" ? "persona-conditioned" : "no-persona-baseline",
      String(s.run),
      s.outcome ?? s.status,
      String(s.steps.length),
      s.terminalStateId ? stateLabel(scenario, s.terminalStateId) : "",
      s.startedAt && s.endedAt ? String(s.endedAt - s.startedAt) : "",
      sim.engine,
      sim.model ?? "",
    ]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}

/** One row per step: the full action trace. */
export function stepsCsv(sim: Simulation, scenario: Scenario): string {
  const rows = [
    ["journey", "condition", "run", "step", "screen", "requested_action", "action", "coerced", "emotion", "factor", "confidence", "latency_ms", "thought"],
  ];
  for (const s of sim.sessions)
    for (const st of s.steps)
      rows.push([
        s.label,
        s.condition,
        String(s.run),
        String(st.index + 1),
        stateLabel(scenario, st.stateId),
        st.requestedAction,
        st.actionId,
        String(st.coerced),
        st.emotion,
        st.factor,
        st.confidence.toFixed(2),
        String(st.latencyMs),
        st.thought,
      ]);
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
