import { join } from "path";
import { access, readdir } from "fs/promises";

// Data directory: Use DATA_DIR env var, or default to /var/data (Render) / data_input (local)
export const PERSISTENT_DISK_DIR = process.env.DATA_DIR || "/var/data";
export const LOCAL_DATA_DIR = join(process.cwd(), "..", "data_input");

export async function getExistingDateDir(date: string): Promise<string | null> {
  const persistentAvailable = await pathExists(PERSISTENT_DISK_DIR);
  if (persistentAvailable) {
    const persistent = join(PERSISTENT_DISK_DIR, date);
    if (await pathExists(persistent)) return persistent;
    return null;
  }

  const local = join(LOCAL_DATA_DIR, date);
  if (await pathExists(local)) return local;

  return null;
}

export async function getAllDateDirs(): Promise<string[]> {
  const dates = new Set<string>();
  const persistentAvailable = await pathExists(PERSISTENT_DISK_DIR);

  if (persistentAvailable) {
    const entries = await readdir(PERSISTENT_DISK_DIR, { withFileTypes: true }).catch(() => []);
    entries
      .filter((e) => e.isDirectory() && /^\d{8}$/.test(e.name))
      .forEach((e) => dates.add(e.name));
  } else if (await pathExists(LOCAL_DATA_DIR)) {
    const entries = await readdir(LOCAL_DATA_DIR, { withFileTypes: true }).catch(() => []);
    entries
      .filter((e) => e.isDirectory() && /^\d{8}$/.test(e.name))
      .forEach((e) => dates.add(e.name));
  }

  return Array.from(dates).sort((a, b) => b.localeCompare(a));
}

export async function getAllDateDirPaths(): Promise<string[]> {
  const dates = await getAllDateDirs();
  const persistentAvailable = await pathExists(PERSISTENT_DISK_DIR);
  const baseDir = persistentAvailable ? PERSISTENT_DISK_DIR : LOCAL_DATA_DIR;
  return dates.map((date) => join(baseDir, date));
}

export async function getZipPath(date: string): Promise<string | null> {
  const dateDir = await getExistingDateDir(date);
  if (dateDir) {
    const zipInDir = join(dateDir, `${date}.zip`);
    if (await pathExists(zipInDir)) return zipInDir;
  }

  return null;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
