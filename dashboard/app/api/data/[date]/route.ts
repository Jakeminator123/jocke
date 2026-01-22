import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getExistingDateDir } from "@/lib/data-paths";
import {
  calculateStats,
} from "@/lib/normalize";
import { readDateData } from "@/lib/data-reader";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date } = await params;

    if (!/^\d{8}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const dateDir = await getExistingDateDir(date);
    if (!dateDir) {
      return NextResponse.json(
        { error: "Data not found for this date" },
        { status: 404 }
      );
    }

    const { data, source } = await readDateData(dateDir);
    const stats = calculateStats(data);

    return NextResponse.json({
      date,
      stats,
      companies: data.companies,
      people: data.people,
      mails: data.mails,
      audits: data.audits,
      evaluations: data.evaluations,
      summary: data.summary,
      source,
    });
  } catch (error) {
    console.error("Error reading data:", error);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}
