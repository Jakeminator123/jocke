"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  RotateCcw,
  ArrowLeft,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface PipelineConfig {
  poit: Record<string, unknown>;
  segment: {
    PIPELINE: Record<string, unknown>;
    RESEARCH: Record<string, unknown>;
    DOMAIN: Record<string, unknown>;
    MAIL: Record<string, unknown>;
  };
  sajt: Record<string, unknown>;
}

// Section definitions matching the GUI (config_gui.py SETTINGS_DEFINITIONS)
const SECTIONS = [
  {
    key: "scraping",
    title: "Skrapning",
    description: "Styr hur data hämtas från Bolagsverket",
    configPath: ["poit"],
    fields: [
      {
        key: "MAX_KUN_DAG",
        label: "Max kungörelser per dag",
        type: "number",
        description: "Hur många företag som skrapas per körning. 0 = obegränsat.",
      },
    ],
  },
  {
    key: "pipeline",
    title: "Pipeline",
    description: "Grundläggande inställningar för databearbetning",
    configPath: ["segment", "PIPELINE"],
    fields: [
      {
        key: "max_companies",
        label: "Max företag att bearbeta",
        type: "number",
        description: "Begränsar hur många företag som går igenom AI-analysen.",
      },
      {
        key: "delete_csv",
        label: "Radera CSV efter konvertering",
        type: "switch",
        description: "Ta bort CSV-filer efter de konverterats till Excel.",
      },
    ],
  },
  {
    key: "research",
    title: "AI-Research",
    description: "Inställningar för AI-driven företagsundersökning",
    configPath: ["segment", "RESEARCH"],
    fields: [
      {
        key: "enabled",
        label: "Aktivera AI-research",
        type: "switch",
        description: "Använd OpenAI för att söka information om företag online.",
      },
      {
        key: "model",
        label: "AI-modell",
        type: "select",
        options: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
        description: "Vilken OpenAI-modell som används.",
      },
      {
        key: "max_searches",
        label: "Sökningar per företag",
        type: "number",
        description: "Antal webbsökningar per företag (3-5 rekommenderas).",
      },
      {
        key: "search_persons",
        label: "Sök efter personer",
        type: "switch",
        description: "Sök kontaktuppgifter för styrelsemedlemmar.",
      },
      {
        key: "max_persons",
        label: "Max personer att söka",
        type: "number",
        description: "Hur många styrelsemedlemmar som undersöks.",
      },
    ],
  },
  {
    key: "domain",
    title: "Domänverifiering",
    description: "Hur företagshemsidor hittas och verifieras",
    configPath: ["segment", "DOMAIN"],
    fields: [
      {
        key: "timeout_seconds",
        label: "HTTP-timeout (sekunder)",
        type: "number",
        description: "Max väntetid när en domän kontrolleras.",
      },
      {
        key: "max_crawl",
        label: "Max domäner att verifiera",
        type: "number",
        description: "Antal domänkandidater som testas per företag.",
      },
      {
        key: "parallel_checks",
        label: "Parallella domänkontroller",
        type: "number",
        description: "Antal domäner som kontrolleras samtidigt.",
      },
    ],
  },
  {
    key: "mail",
    title: "Mail-generering",
    description: "Inställningar för automatisk e-postgenerering",
    configPath: ["segment", "MAIL"],
    fields: [
      {
        key: "enabled",
        label: "Aktivera mail-generering",
        type: "switch",
        description: "Skapa personliga säljmail automatiskt.",
      },
      {
        key: "model",
        label: "AI-modell för mail",
        type: "select",
        options: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
        description: "Vilken modell som skriver mailen.",
      },
      {
        key: "min_confidence",
        label: "Min domän-confidence (%)",
        type: "number",
        description: "Lägsta säkerhet på domänmatchning för att generera mail.",
      },
      {
        key: "max_mails",
        label: "Max mail att generera",
        type: "number",
        description: "Begränsar antal mail per körning.",
      },
    ],
  },
  {
    key: "mail_tone",
    title: "Mail: Ton & Stil",
    description: "Justera hur mailen låter",
    configPath: ["segment", "MAIL"],
    fields: [
      {
        key: "formality",
        label: "Formalitet",
        type: "slider",
        min: 1,
        max: 10,
        description: "1 = Avslappnat  /  10 = Formellt",
      },
      {
        key: "salesiness",
        label: "Säljighet",
        type: "slider",
        min: 1,
        max: 10,
        description: "1 = Bara info  /  10 = Aggressiv försäljning",
      },
      {
        key: "flattery",
        label: "Smicker",
        type: "slider",
        min: 1,
        max: 10,
        description: "1 = Rakt på sak  /  10 = Inställsamt",
      },
      {
        key: "length",
        label: "Längd",
        type: "slider",
        min: 1,
        max: 10,
        description: "1 = Ultra-kort (~80 ord)  /  10 = Längre (~200 ord)",
      },
    ],
  },
  {
    key: "evaluation",
    title: "Utvärdering",
    description: "Vilka företag som ska få demo-hemsida",
    configPath: ["sajt"],
    fields: [
      {
        key: "evaluate",
        label: "Aktivera utvärdering",
        type: "switch",
        description: "Filtrera företag innan sajt-generering.",
      },
      {
        key: "threshold",
        label: "Min confidence för sajt",
        type: "decimal",
        description: "Lägsta AI-säkerhet (0.0 - 1.0) för att generera demo-sajt.",
      },
      {
        key: "max_total_judgement_approvals",
        label: "Max godkända företag",
        type: "number",
        description: "0 = obegränsat. Styr kostnad för v0.dev API.",
      },
    ],
  },
  {
    key: "sites",
    title: "Demo-sajter",
    description: "Automatisk hemsidegenerering via v0.dev",
    configPath: ["sajt"],
    fields: [
      {
        key: "max_sites",
        label: "Max sajter per körning",
        type: "number",
        description: "Hur många demo-hemsidor som genereras.",
      },
      {
        key: "re_input_website_link",
        label: "Lägg till sajt-länk i mail",
        type: "switch",
        description: "Infoga preview-URL i genererade mail automatiskt.",
      },
    ],
  },
  {
    key: "audit",
    title: "Webbplats-audit",
    description: "Analysera företagens befintliga hemsidor",
    configPath: ["sajt"],
    fields: [
      {
        key: "audit_enabled",
        label: "Aktivera audit",
        type: "switch",
        description: "Kör automatisk analys av företagens hemsidor.",
      },
      {
        key: "audit_threshold",
        label: "Min domän-confidence för audit",
        type: "decimal",
        description: "Endast audit företag där vi är säkra på domänen (0.0 - 1.0).",
      },
      {
        key: "max_audits",
        label: "Max audits per körning",
        type: "number",
        description: "Begränsar antal webbplats-analyser.",
      },
      {
        key: "re_input_audit",
        label: "Lägg till audit-länk i mail",
        type: "switch",
        description: "Infoga länk till audit-rapporten i mailet.",
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string[],
  field: string,
  value: unknown
) {
  let current: Record<string, unknown> = obj;
  for (const key of path) {
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[field] = value;
}

function isSwitchOn(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  const s = String(val).toLowerCase();
  return ["y", "yes", "true", "1", "on"].includes(s);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConfigPage() {
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      // Session cookie is sent automatically by the browser
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Kunde inte ladda config");
      setConfig(await res.json());
    } catch {
      setStatus({ type: "error", message: "Kunde inte ladda konfiguration" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sparning misslyckades");
      }
      const data = await res.json();
      setConfig(data.config);
      setStatus({ type: "success", message: "Konfiguration sparad!" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Okänt fel",
      });
    } finally {
      setSaving(false);
    }
  }

  function updateField(path: string[], field: string, value: unknown) {
    if (!config) return;
    const copy = structuredClone(config) as Record<string, unknown>;
    setNestedValue(copy, path, field, value);
    setConfig(copy as unknown as PipelineConfig);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="py-12 text-center text-red-400">
        Kunde inte ladda konfiguration.
      </div>
    );
  }

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Settings className="w-7 h-7 text-blue-400" />
              Pipeline-konfiguration
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Inställningar som styr hela datapipelinen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Återställ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Spara
          </button>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            status.type === "success"
              ? "bg-green-900/40 text-green-300 border border-green-800"
              : "bg-red-900/40 text-red-300 border border-red-800"
          }`}
        >
          {status.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {status.message}
        </div>
      )}

      {/* Config sections */}
      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const sectionValues = getNestedValue(
            config as unknown as Record<string, unknown>,
            section.configPath as unknown as string[]
          ) as Record<string, unknown> | undefined;

          return (
            <div
              key={section.key}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
            >
              {/* Section header */}
              <div className="px-6 py-4 border-b border-zinc-800/60">
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="text-zinc-400 text-sm">{section.description}</p>
              </div>

              {/* Fields */}
              <div className="divide-y divide-zinc-800/40">
                {section.fields.map((field) => {
                  const value = sectionValues?.[field.key];

                  return (
                    <div
                      key={field.key}
                      className="px-6 py-4 flex items-center justify-between gap-8"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {field.label}
                        </div>
                        <div className="text-zinc-500 text-xs mt-0.5">
                          {field.description}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {field.type === "number" && (
                          <input
                            type="number"
                            value={Number(value ?? 0)}
                            onChange={(e) =>
                              updateField(
                                section.configPath as unknown as string[],
                                field.key,
                                Number(e.target.value)
                              )
                            }
                            className="w-24 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-right focus:outline-none focus:border-blue-500"
                          />
                        )}

                        {field.type === "decimal" && (
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={Number(value ?? 0)}
                            onChange={(e) =>
                              updateField(
                                section.configPath as unknown as string[],
                                field.key,
                                parseFloat(e.target.value)
                              )
                            }
                            className="w-24 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-right focus:outline-none focus:border-blue-500"
                          />
                        )}

                        {field.type === "switch" && (
                          <button
                            onClick={() =>
                              updateField(
                                section.configPath as unknown as string[],
                                field.key,
                                isSwitchOn(value) ? "n" : "y"
                              )
                            }
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              isSwitchOn(value) ? "bg-blue-600" : "bg-zinc-700"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                isSwitchOn(value)
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        )}

                        {field.type === "select" && (
                          <select
                            value={String(value ?? "")}
                            onChange={(e) =>
                              updateField(
                                section.configPath as unknown as string[],
                                field.key,
                                e.target.value
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-blue-500"
                          >
                            {"options" in field &&
                              (field as { options: string[] }).options.map(
                                (opt: string) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                )
                              )}
                          </select>
                        )}

                        {field.type === "slider" && (
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={"min" in field ? (field as { min: number }).min : 1}
                              max={"max" in field ? (field as { max: number }).max : 10}
                              value={Number(value ?? 5)}
                              onChange={(e) =>
                                updateField(
                                  section.configPath as unknown as string[],
                                  field.key,
                                  Number(e.target.value)
                                )
                              }
                              className="w-32 accent-blue-500"
                            />
                            <span className="w-8 text-right text-sm font-mono text-blue-400">
                              {Number(value ?? 5)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom save button */}
      <div className="flex justify-end pt-4 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Spara alla inställningar
        </button>
      </div>
    </div>
  );
}
