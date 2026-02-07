import { join } from "path";
import { readFile, writeFile, access } from "fs/promises";
import { PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, pathExists } from "./data-paths";

// ---------------------------------------------------------------------------
// Default pipeline configuration
// Same structure as gui/default_config.json in the main pang repo.
// ---------------------------------------------------------------------------

export interface PipelineConfig {
  poit: Record<string, unknown>;
  segment: {
    PIPELINE: Record<string, unknown>;
    RESEARCH: Record<string, unknown>;
    DOMAIN: Record<string, unknown>;
    MAIL: Record<string, unknown>;
  };
  sajt: Record<string, unknown>;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  poit: {
    MAX_KUN_DAG: 150,
  },
  segment: {
    PIPELINE: {
      source_dir: "1_poit/info_server",
      max_companies: 150,
      delete_csv: "y",
    },
    RESEARCH: {
      enabled: "y",
      model: "gpt-4o",
      max_searches: 3,
      search_persons: "y",
      max_persons: 2,
    },
    DOMAIN: {
      timeout_seconds: 5,
      max_crawl: 5,
      parallel_checks: 5,
    },
    MAIL: {
      enabled: "y",
      model: "gpt-4o",
      min_confidence: 40,
      max_mails: 110,
      formality: 4,
      salesiness: 3,
      flattery: 2,
      length: 5,
    },
  },
  sajt: {
    evaluate: "y",
    threshold: 0.8,
    max_total_judgement_approvals: 4,
    re_input_website_link: "y",
    max_sites: 4,
    audit_enabled: "y",
    audit_threshold: 0.85,
    re_input_audit: "y",
    max_audits: 10,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIG_FILENAME = "_config.json";

async function getConfigPath(): Promise<string> {
  if (await pathExists(PERSISTENT_DISK_DIR)) {
    return join(PERSISTENT_DISK_DIR, CONFIG_FILENAME);
  }
  return join(LOCAL_DATA_DIR, CONFIG_FILENAME);
}

export async function loadConfig(): Promise<PipelineConfig> {
  try {
    const configPath = await getConfigPath();
    if (await pathExists(configPath)) {
      const raw = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      // Merge with defaults so new keys are always present
      return mergeDeep(structuredClone(DEFAULT_CONFIG), parsed) as PipelineConfig;
    }
  } catch (err) {
    console.error("[CONFIG] Failed to load config, using defaults:", err);
  }
  return structuredClone(DEFAULT_CONFIG);
}

export async function saveConfig(config: PipelineConfig): Promise<void> {
  const configPath = await getConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function validateConfig(data: unknown): data is PipelineConfig {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.poit === "object" &&
    obj.poit !== null &&
    typeof obj.segment === "object" &&
    obj.segment !== null &&
    typeof obj.sajt === "object" &&
    obj.sajt !== null
  );
}

// Deep merge: override values from source into target
function mergeDeep(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      target[key] = mergeDeep(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}
