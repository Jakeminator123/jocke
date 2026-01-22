import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { getExistingDateDir, pathExists } from "@/lib/data-paths";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string; mapp: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date, mapp } = await params;
    if (!/^\d{8}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    if (!isSafeSegment(mapp)) {
      return NextResponse.json({ error: "Invalid mapp" }, { status: 400 });
    }

    const dateDir = await getExistingDateDir(date);
    if (!dateDir) {
      return NextResponse.json({ error: "Data not found for this date" }, { status: 404 });
    }

    const companyDir = join(dateDir, mapp);
    if (!(await pathExists(companyDir))) {
      return NextResponse.json({ files: [] });
    }

    const entries = await readdir(companyDir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(companyDir, entry.name);
        const isDir = entry.isDirectory();
        const size = isDir ? 0 : (await stat(fullPath)).size;
        return {
          name: entry.name,
          isDir,
          size,
        };
      })
    );

    files.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ date, mapp, files });
  } catch (error) {
    console.error("Error listing files:", error);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}

function isSafeSegment(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}
