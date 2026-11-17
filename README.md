# SUBS: Synthetic User Behavior Simulation

Persona-conditioned AI agents walk a product journey and log every step, so you can screen for hesitation, trust problems and abandonment before recruiting real users.

Team 24, CS4710 Interdisciplinary Project-1, RV University.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires Node 20 or newer.

Keep this folder outside iCloud Drive (so not in Documents or Desktop when those are synced). iCloud offloads files in `node_modules` and Node then cannot read them.

## Add a Gemini API key

1. Open **Settings** in the app.
2. Paste a Gemini API key (from Google AI Studio) and choose **Save and test**.
3. Pick a model from the list.

The key is stored in this browser's local storage and sent only to Google's Gemini API, directly from the page. There is no SUBS server. Anyone with access to the browser profile can read the key, so use one you can revoke.

Without a key the app runs in **demo mode**: scripted agents with trait effects built in. Demo results show how the system works. They are not evidence about real users or about a language model, and every demo result is labelled.

## The agent team

| Agent | What it does |
| --- | --- |
| Persona Architect | Samples ages and trait scores evenly across a cohort, then writes a name, job, goals, frustrations and backstory to fit each profile. |
| Persona agents | One per persona journey. At each screen the agent sees the screen, its own history and the allowed actions, then replies with a thought, an action, an emotion and the deciding factor. |
| Baseline agents | Same journey, model and prompt, with no persona. The control for every comparison. |
| Validator | Only lets an agent take an action the current screen allows. Anything else is mapped to the nearest valid action and counted. |
| Insight Analyst | Reads the finished traces and statistics and reports friction points, with evidence and a change to test. |
| Orchestrator | Runs the agents in parallel under a concurrency and requests-per-minute limit, with retries, cancellation and partial results. |

## Scenarios

Two journeys ship with the app, each a finite-state model in `src/lib/engine/scenarios.ts`:

- **Personal Loan Application** (a fictional Indian digital lender)
- **TechFlow Pro Smartwatch Checkout** (the pilot scenario from the earlier report)

To add a journey, add a `Scenario` object to that file. `validateScenario` and the test suite check that every transition is valid.

## What the results show

- Conversion, abandonment and step-limit rates, with and without a persona
- Share of journeys reaching each screen
- Where journeys ended early, and where agents were uneasy
- Action frequency in each condition
- Pearson r between persona traits and outcomes, with p-values
- Two-sample KS test on journey length against the baseline
- How many actions the validator had to correct
- Every journey step by step, with CSV and JSON export

## Project layout

```
src/lib/engine/   Simulation engine. No UI or storage dependencies.
  scenarios.ts      Finite-state journeys
  backend.ts        Agent prompts and the Gemini-backed agents
  demo.ts           Scripted agents for demo mode
  llm.ts            Gemini client: rate limit, retries, model list
  fsm.ts            The validator
  orchestrator.ts   Runs a simulation
  analytics.ts      Metrics; stats.ts has Pearson and KS
  personas.ts       Cohort sampling and sample personas
src/lib/store.ts  Browser storage (personas, runs, settings)
src/lib/runner.ts Starts and cancels runs from the UI
src/app/          Screens: dashboard, personas, simulations, results, settings
```

## Checks

```bash
npm test          # engine tests
npm run typecheck
npm run build
```

## Limits

- Runs live in the browser tab. Closing or reloading the tab stops a run; finished journeys are kept.
- Data is stored per browser. Use the exports to move or share it.
- Synthetic users support early screening. Findings are candidate issues to confirm with real users.
