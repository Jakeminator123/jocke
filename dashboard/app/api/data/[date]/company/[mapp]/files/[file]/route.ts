import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { extname, join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { getExistingDateDir, pathExists } from "@/lib/data-paths";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string; mapp: string; file: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date, mapp, file } = await params;
    const fileName = decodeURIComponent(file || "");

    if (!/^\d{8}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (!isSafeSegment(mapp)) {
      return NextResponse.json({ error: "Invalid mapp" }, { status: 400 });
    }
    if (!isSafeFileName(fileName)) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    const dateDir = await getExistingDateDir(date);
    if (!dateDir) {
      return NextResponse.json({ error: "Data not found for this date" }, { status: 404 });
    }

    const filePath = join(dateDir, mapp, fileName);
    if (!(await pathExists(filePath))) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await readFile(filePath);
    const contentType = getContentType(fileName);
    const safeName = fileName.replace(/\"/g, "");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}

function isSafeSegment(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function isSafeFileName(value: string): boolean {
  if (!value) return false;
  if (value.includes("..")) return false;
  if (value.includes("/") || value.includes("\\")) return false;
  return true;
}

function getContentType(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain";
    case ".html":
    case ".htm":
      return "text/html";
    case ".json":
      return "application/json";
    case ".csv":
      return "text/csv";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}
