import { NextRequest, NextResponse } from "next/server";
import { rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { PERSISTENT_DISK_DIR, LOCAL_DATA_DIR } from "@/lib/data-paths";
import { getIndexDbPath } from "@/lib/index-db";

/**
 * DELETE /api/admin/clear-data
 * Clears all data from the persistent disk
 * Requires authentication + UPLOAD_SECRET header for extra security
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require UPLOAD_SECRET for destructive operations
    const authHeader = request.headers.get("Authorization");
    const uploadSecret = process.env.UPLOAD_SECRET;
    
    if (uploadSecret) {
      const providedSecret = authHeader?.replace("Bearer ", "");
      if (providedSecret !== uploadSecret) {
        return NextResponse.json(
          { error: "Invalid admin secret" },
          { status: 403 }
        );
      }
    }

    const dataDirs = existsSync(PERSISTENT_DISK_DIR)
      ? [PERSISTENT_DISK_DIR]
      : existsSync(LOCAL_DATA_DIR)
      ? [LOCAL_DATA_DIR]
      : [];

    if (dataDirs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No data directory found - nothing to delete",
        deletedFolders: 0,
      });
    }

    const dateFolders: string[] = [];
    for (const dataDir of dataDirs) {
      const entries = await readdir(dataDir, { withFileTypes: true });
      entries
        .filter((e) => e.isDirectory() && /^\d{8}$/.test(e.name))
        .forEach((e) => dateFolders.push(e.name));
    }

    // Delete each date folder
    let deletedCount = 0;
    const errors: string[] = [];

    for (const folder of dateFolders) {
      for (const dataDir of dataDirs) {
        const folderPath = join(dataDir, folder);
        try {
          await rm(folderPath, { recursive: true, force: true });
          deletedCount++;
          console.log(`Deleted: ${folderPath}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${folder}: ${msg}`);
          console.error(`Failed to delete ${folderPath}:`, err);
        }
      }
    }

    // Remove SQLite index (if present)
    try {
      const indexPath = getIndexDbPath();
      if (existsSync(indexPath)) {
        await rm(indexPath, { force: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`index: ${msg}`);
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: `Deleted ${deletedCount} of ${dateFolders.length} date folders`,
      deletedFolders: deletedCount,
      folders: dateFolders,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error clearing data:", error);
    return NextResponse.json(
      { error: "Failed to clear data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/clear-data
 * Returns info about what would be deleted (dry run)
 */
export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dataDir = existsSync(PERSISTENT_DISK_DIR) ? PERSISTENT_DISK_DIR : LOCAL_DATA_DIR;
    if (!existsSync(dataDir)) {
      return NextResponse.json({
        dataDir,
        exists: false,
        folders: [],
        totalSize: 0,
      });
    }

    const entries = await readdir(dataDir, { withFileTypes: true });
    const dateFolders = entries
      .filter((e) => e.isDirectory() && /^\d{8}$/.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();

    return NextResponse.json({
      dataDir,
      exists: true,
      folders: dateFolders,
      count: dateFolders.length,
    });
  } catch (error) {
    console.error("Error checking data:", error);
    return NextResponse.json(
      { error: "Failed to check data" },
      { status: 500 }
    );
  }
}
