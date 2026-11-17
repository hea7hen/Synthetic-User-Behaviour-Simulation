"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button, Card, Field, Modal, Notice, PageHeader, inputClass } from "@/components/ui";
import { listModels, pickDefaultModel } from "@/lib/engine/llm";
import { downloadFile } from "@/lib/export";
import { useStore } from "@/lib/store";

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const personas = useStore((s) => s.personas);
  const simulations = useStore((s) => s.simulations);
  const clearData = useStore((s) => s.clearData);

  const [draftKey, setDraftKey] = useState(settings.apiKey);
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const saveAndTest = async () => {
    const key = draftKey.trim();
    if (!key) return;
    setChecking(true);
    setMessage(null);
    try {
      const models = await listModels(key);
      if (!models.length) throw new Error("The key works, but it has no Gemini text models available.");
      const model = models.some((m) => m.id === settings.model) ? settings.model : (pickDefaultModel(models) ?? "");
      updateSettings({ apiKey: key, models, model });
      setMessage({ ok: true, text: `Connected. ${models.length} models are available to this key.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setChecking(false);
    }
  };

  const removeKey = () => {
    updateSettings({ apiKey: "", model: "", models: [] });
    setDraftKey("");
    setMessage({ ok: true, text: "Key removed from this browser. The app is back in demo mode." });
  };

  const num = (v: string, lo: number, hi: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Connect a model, tune how runs are paced, and manage the data in this browser." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Gemini API key</h2>
            <p className="mt-1 text-[15px] text-muted">
              With a key, every agent is a Gemini model call. Without one, the app runs scripted demo agents.
            </p>
            <div className="mt-5 space-y-4">
              <Field label="API key">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    type={show ? "text" : "password"}
                    value={draftKey}
                    onChange={(e) => setDraftKey(e.target.value)}
                    placeholder="Paste your Gemini API key"
                    autoComplete="off"
                    spellCheck={false}
                    name="gemini-api-key"
                  />
                  <Button variant="secondary" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide key" : "Show key"}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button onClick={saveAndTest} disabled={!draftKey.trim() || checking}>
                  {checking ? "Checking…" : "Save and test"}
                </Button>
                {settings.apiKey && (
                  <Button variant="secondary" onClick={removeKey}>
                    Remove key
                  </Button>
                )}
                <a
                  className="inline-flex items-center px-2 text-sm font-semibold text-blue hover:underline"
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get a key from Google AI Studio
                </a>
              </div>
              {message && <Notice tone={message.ok ? "info" : "bad"}>{message.text}</Notice>}
              {settings.apiKey && (
                <Field label="Model" hint="Used by the Persona Architect, the user agents, the baseline agents and the Insight Analyst.">
                  <select className={inputClass} value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}>
                    {!settings.models.some((m) => m.id === settings.model) && settings.model && (
                      <option value={settings.model}>{settings.model}</option>
                    )}
                    {settings.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} ({m.id})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <p className="text-xs leading-relaxed text-muted">
                The key is stored only in this browser&apos;s local storage and is sent only to Google&apos;s Gemini API, straight from this
                page. There is no SUBS server. Anyone who can use this browser profile can read the key, so use one you can revoke, and
                remove it on shared computers.
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Run pacing</h2>
            <p className="mt-1 text-[15px] text-muted">Keep these inside your key&apos;s rate limits. Free-tier keys allow few requests per minute.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Requests per minute" hint="1 to 600">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={600}
                  value={settings.requestsPerMinute}
                  onChange={(e) => updateSettings({ requestsPerMinute: num(e.target.value, 1, 600, 15) })}
                />
              </Field>
              <Field label="Agents in parallel" hint="1 to 10">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={10}
                  value={settings.concurrency}
                  onChange={(e) => updateSettings({ concurrency: Math.round(num(e.target.value, 1, 10, 5)) })}
                />
              </Field>
              <Field label="Temperature" hint="0 to 2. Higher varies more.">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature}
                  onChange={(e) => updateSettings({ temperature: num(e.target.value, 0, 2, 0.9) })}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
            <div className="mt-5">
              <Field label="Display name" hint="Shown in the dashboard greeting.">
                <input
                  className={inputClass}
                  value={settings.displayName}
                  onChange={(e) => updateSettings({ displayName: e.target.value })}
                  placeholder="Your name"
                />
              </Field>
            </div>
          </Card>
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Data</h2>
            <p className="mt-1 text-[15px] text-muted">
              {personas.length} personas and {simulations.length} simulations are saved in this browser.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  downloadFile("subs-export.json", JSON.stringify({ exportedAt: new Date().toISOString(), personas, simulations }, null, 2), "application/json")
                }
              >
                Export everything (JSON)
              </Button>
              <Button variant="secondary" onClick={() => setConfirmClear(true)} disabled={!personas.length && !simulations.length}>
                Clear personas and runs
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">The export contains personas and runs. It never includes the API key.</p>
          </Card>
        </div>
      </div>

      <Modal open={confirmClear} title="Clear personas and runs?" onClose={() => setConfirmClear(false)}>
        <p>
          This deletes {personas.length} personas and {simulations.length} simulations from this browser. It cannot be undone. Your API key and
          settings stay.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>
            Keep data
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              clearData();
              setConfirmClear(false);
            }}
          >
            Delete data
          </Button>
        </div>
      </Modal>
    </>
  );
}
