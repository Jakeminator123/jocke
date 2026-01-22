import { NextRequest, NextResponse } from "next/server";
import { rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { PERSISTENT_DISK_DIR } from "@/lib/data-paths";

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

    // Check if data directory exists
    if (!existsSync(PERSISTENT_DISK_DIR)) {
      return NextResponse.json({
        success: true,
        message: "No data directory found - nothing to delete",
        deletedFolders: 0,
      });
    }

    // Get list of date folders before deletion
    const entries = await readdir(PERSISTENT_DISK_DIR, { withFileTypes: true });
    const dateFolders = entries
      .filter((e) => e.isDirectory() && /^\d{8}$/.test(e.name))
      .map((e) => e.name);

    // Delete each date folder
    let deletedCount = 0;
    const errors: string[] = [];

    for (const folder of dateFolders) {
      const folderPath = join(PERSISTENT_DISK_DIR, folder);
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

    if (!existsSync(PERSISTENT_DISK_DIR)) {
      return NextResponse.json({
        dataDir: PERSISTENT_DISK_DIR,
        exists: false,
        folders: [],
        totalSize: 0,
      });
    }

    const entries = await readdir(PERSISTENT_DISK_DIR, { withFileTypes: true });
    const dateFolders = entries
      .filter((e) => e.isDirectory() && /^\d{8}$/.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();

    return NextResponse.json({
      dataDir: PERSISTENT_DISK_DIR,
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
