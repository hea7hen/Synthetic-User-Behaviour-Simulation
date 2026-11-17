// Core data model for SUBS: personas, scenarios (finite-state product journeys),
// sessions (one agent walking one journey) and simulations (a controlled run).

export interface Ocean {
  openness: number; // all traits are 0-100
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export const OCEAN_KEYS = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as const;
export type OceanKey = (typeof OCEAN_KEYS)[number];

export interface Persona {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  location: string;
  segment: string;
  monthlyIncome: string;
  ocean: Ocean;
  riskTolerance: number;
  digitalLiteracy: number;
  priceSensitivity: number;
  goals: string[];
  frustrations: string[];
  backstory: string;
  source: "manual" | "gemini" | "demo" | "sample";
  createdAt: number;
}

export type ActionKind = "progress" | "explore" | "reassure" | "adjust" | "leave";

export interface ScenarioAction {
  id: string;
  label: string;
  to: string; // next state id, or a terminal id
  kind: ActionKind;
  factor?: string;
}

export interface ScenarioState {
  id: string;
  label: string;
  short: string; // short axis label for charts
  screen: string; // what the user sees: the descriptor given to the agent
  friction: number; // 0-1, used only by the scripted demo agents
  frictionFactor: string;
  concern: string; // plain-language friction on this screen
  actions: ScenarioAction[];
}

export interface ScenarioTerminal {
  id: string;
  label: string;
  short: string;
  outcome: "completed" | "abandoned";
}

export interface Scenario {
  id: string;
  name: string;
  product: string;
  goal: string;
  entry: string;
  funnel: string[]; // main path, in order, ending with the completed terminal
  states: Record<string, ScenarioState>;
  terminals: Record<string, ScenarioTerminal>;
  factors: { id: string; label: string }[];
}

export const EMOTIONS = ["confident", "curious", "neutral", "hesitant", "anxious", "frustrated"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export type Condition = "persona" | "baseline";
export type Outcome = "completed" | "abandoned" | "timeout" | "error";

export interface Step {
  index: number;
  stateId: string;
  thought: string;
  requestedAction: string; // what the agent asked for
  actionId: string; // what the validator allowed
  actionLabel: string;
  coerced: boolean;
  emotion: Emotion;
  factor: string;
  confidence: number;
  nextStateId: string;
  latencyMs: number;
  elapsedMs: number;
}

export interface Session {
  id: string;
  condition: Condition;
  personaId?: string;
  label: string; // persona name, or "Baseline agent 3"
  run: number;
  status: "queued" | "running" | "done" | "error";
  outcome?: Outcome;
  terminalStateId?: string;
  currentStateId?: string;
  steps: Step[];
  startedAt?: number;
  endedAt?: number;
  error?: string;
}

export interface FrictionPoint {
  stateId: string;
  title: string;
  severity: "high" | "medium" | "low";
  evidence: string;
  recommendation: string;
}

export interface Insights {
  summary: string;
  frictionPoints: FrictionPoint[];
  personaPatterns: string[];
  caveats: string[];
  generatedBy: "gemini" | "demo";
}

export type AgentRole = "orchestrator" | "architect" | "persona" | "baseline" | "validator" | "analyst";

export interface LogEntry {
  t: number;
  agent: AgentRole;
  text: string;
}

export type EngineKind = "gemini" | "demo";
export type SimulationStatus = "queued" | "running" | "analyzing" | "completed" | "failed" | "cancelled";

export interface Simulation {
  id: string;
  name: string;
  scenarioId: string;
  personas: Persona[]; // snapshot taken when the run starts
  runsPerPersona: number;
  baselineRuns: number;
  maxSteps: number;
  engine: EngineKind;
  model?: string;
  status: SimulationStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  sessions: Session[];
  insights?: Insights;
  insightsError?: string;
  error?: string;
  log: LogEntry[];
  requests: number; // model calls made
}

export interface CohortBrief {
  segment: string;
  count: number;
  ageMin: number;
  ageMax: number;
  location: string;
  context: string;
}

export interface PersonaSkeleton {
  key: string;
  age: number;
  gender: string;
  ocean: Ocean;
  riskTolerance: number;
  digitalLiteracy: number;
  priceSensitivity: number;
}

export interface PersonaDraft {
  key: string;
  name: string;
  occupation: string;
  monthlyIncome: string;
  goals: string[];
  frustrations: string[];
  backstory: string;
}
