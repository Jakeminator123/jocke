import { NextRequest, NextResponse } from "next/server";
import {
  loadConfig,
  saveConfig,
  validateConfig,
} from "@/lib/pipeline-config";

const JOCKE_API_KEY = process.env.JOCKE_API || "12345";

function isAuthorized(request: NextRequest): boolean {
  // 1. API key (for pipeline / GUI / external calls)
  const headerKey =
    request.headers.get("X-API-Key") ||
    request.headers.get("Authorization")?.replace("Bearer ", "");
  const queryKey = request.nextUrl.searchParams.get("api_key");
  const providedKey = headerKey || queryKey;
  if (providedKey === JOCKE_API_KEY) return true;

  // 2. Session cookie (for the web config page)
  const authCookie = request.cookies.get("pang_auth");
  if (authCookie?.value === "authenticated") return true;

  return false;
}

// GET /api/config  -- return current pipeline configuration
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or missing API key." },
        { status: 401 }
      );
    }

    const config = await loadConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("[API /config GET]", err);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 }
    );
  }
}

// PUT /api/config  -- update pipeline configuration
export async function PUT(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or missing API key." },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!validateConfig(body)) {
      return NextResponse.json(
        {
          error:
            "Invalid config format. Must contain poit, segment, and sajt objects.",
        },
        { status: 400 }
      );
    }

    await saveConfig(body);
    const saved = await loadConfig();

    return NextResponse.json({
      success: true,
      message: "Configuration saved",
      config: saved,
    });
  } catch (err) {
    console.error("[API /config PUT]", err);
    return NextResponse.json(
      { error: "Failed to save config" },
      { status: 500 }
    );
  }
}
