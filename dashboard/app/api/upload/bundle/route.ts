import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, pathExists } from "@/lib/data-paths";
import { readDateData } from "@/lib/data-reader";
import { indexDateData } from "@/lib/index-db";

// Use UPLOAD_SECRET env var for API key authentication
// This should be set in Render dashboard environment variables
const UPLOAD_SECRET = process.env.UPLOAD_SECRET || process.env.JOCKE_API;

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * POST /api/upload/bundle
 * 
 * Receives a ZIP file and extracts it to persistent storage.
 * 
 * Headers:
 *   - Authorization: Bearer <UPLOAD_SECRET>
 *   - X-Date: YYYYMMDD (the date folder name)
 * 
 * Body: ZIP file as binary data
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (!UPLOAD_SECRET || token !== UPLOAD_SECRET) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Get date from header
    const dateStr = request.headers.get("x-date");
    if (!dateStr || !/^\d{8}$/.test(dateStr)) {
      return NextResponse.json(
        { error: "Invalid or missing X-Date header (expected YYYYMMDD)" },
        { status: 400 }
      );
    }

    // Check content length
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Get the body as a buffer
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Empty file received" },
        { status: 400 }
      );
    }

    console.log(`[UPLOAD] Received ${buffer.length} bytes for date ${dateStr}`);

    // Determine target directory
    // On Render: use persistent disk
    // Locally: use data_input folder
    let targetDir: string;
    if (await pathExists(PERSISTENT_DISK_DIR)) {
      targetDir = join(PERSISTENT_DISK_DIR, dateStr);
      console.log(`[UPLOAD] Using persistent disk: ${targetDir}`);
    } else {
      targetDir = join(LOCAL_DATA_DIR, dateStr);
      console.log(`[UPLOAD] Using local storage: ${targetDir}`);
    }

    // Create target directory
    await mkdir(targetDir, { recursive: true });

    // Save the ZIP file
    const zipPath = join(targetDir, `${dateStr}.zip`);
    await writeFile(zipPath, buffer);
    console.log(`[UPLOAD] Saved ZIP file: ${zipPath}`);

    // Extract the ZIP file
    const extractResult = await extractZipFile(zipPath, targetDir);

    if (!extractResult.success) {
      return NextResponse.json(
        { error: `Failed to extract ZIP: ${extractResult.error}` },
        { status: 500 }
      );
    }

    // Build/update SQLite index for fast search/totals
    try {
      const { data } = await readDateData(targetDir);
      indexDateData(dateStr, data);
      console.log(`[UPLOAD] Indexed data for ${dateStr}`);
    } catch (err) {
      console.error("[UPLOAD] Failed to index data:", err);
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      path: targetDir,
      filesExtracted: extractResult.filesExtracted,
      message: `Successfully uploaded and extracted data for ${dateStr}`,
    });

  } catch (error: any) {
    console.error("[UPLOAD] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process upload" },
      { status: 500 }
    );
  }
}

/**
 * Extract ZIP file contents to target directory
 */
async function extractZipFile(
  zipPath: string,
  targetDir: string
): Promise<{ success: boolean; filesExtracted?: number; error?: string }> {
  try {
    // Use dynamic import for yauzl-promise (lightweight ZIP library)
    // If not available, try using unzipper or fall back to shell command
    
    // Try using AdmZip (commonly available)
    try {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(targetDir, true);
      const entries = zip.getEntries();
      console.log(`[UPLOAD] Extracted ${entries.length} files using AdmZip`);
      return { success: true, filesExtracted: entries.length };
    } catch {
      console.log("[UPLOAD] AdmZip not available, trying alternative...");
    }

    // Fallback: Use Node.js child_process with system unzip (if on Linux/Render)
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      // Try unzip command (Linux/Mac)
      await execAsync(`unzip -o "${zipPath}" -d "${targetDir}"`);
      console.log(`[UPLOAD] Extracted using system unzip`);
      return { success: true, filesExtracted: -1 }; // Unknown count
    } catch {
      // Try PowerShell on Windows
      try {
        await execAsync(
          `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`
        );
        console.log(`[UPLOAD] Extracted using PowerShell`);
        return { success: true, filesExtracted: -1 };
      } catch (psError) {
        console.error("[UPLOAD] PowerShell extraction failed:", psError);
      }
    }

    return { success: false, error: "No ZIP extraction method available" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * GET /api/upload/bundle
 * 
 * Returns upload status and available dates
 */
export async function GET(request: NextRequest) {
  // Verify API key for status check
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);
  if (!UPLOAD_SECRET || token !== UPLOAD_SECRET) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    );
  }

  // Check storage locations
  const persistentExists = await pathExists(PERSISTENT_DISK_DIR);
  const localExists = await pathExists(LOCAL_DATA_DIR);

  return NextResponse.json({
    status: "ready",
    storage: {
      persistent: {
        path: PERSISTENT_DISK_DIR,
        available: persistentExists,
      },
      local: {
        path: LOCAL_DATA_DIR,
        available: localExists,
      },
    },
    maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
  });
}

