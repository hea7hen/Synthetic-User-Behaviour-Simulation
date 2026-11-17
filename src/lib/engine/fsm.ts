import type { ScenarioAction } from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * The validator. Agents may only take an action that the current state allows.
 * A valid id passes through. Anything else is mapped to the nearest valid
 * action and flagged as coerced, so invalid-action handling can be measured.
 */
export function coerceAction(requested: string, allowed: ScenarioAction[]): { action: ScenarioAction; coerced: boolean } {
  const want = norm(String(requested ?? ""));
  const exact = allowed.find((a) => a.id === requested) ?? allowed.find((a) => norm(a.id) === want);
  if (exact) return { action: exact, coerced: false };

  const byLabel = allowed.find((a) => norm(a.label) === want);
  if (byLabel) return { action: byLabel, coerced: true };

  // Leaving is spelled many ways; map them all onto the state's leave action.
  if (/(leave|abandon|exit|quit|close|give_up|stop)/.test(want)) {
    const leave = allowed.find((a) => a.kind === "leave");
    if (leave) return { action: leave, coerced: true };
  }

  const wantTokens = new Set(want.split("_").filter(Boolean));
  let best: ScenarioAction | undefined;
  let bestScore = 0;
  for (const a of allowed) {
    const tokens = new Set([...norm(a.id).split("_"), ...norm(a.label).split("_")].filter(Boolean));
    let overlap = 0;
    for (const t of wantTokens) if (tokens.has(t)) overlap++;
    const score = overlap / Math.max(1, wantTokens.size);
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  if (best && bestScore > 0) return { action: best, coerced: true };

  // Nothing resembles the request: fall back to the first non-leaving action.
  return { action: allowed.find((a) => a.kind !== "leave") ?? allowed[0], coerced: true };
}
