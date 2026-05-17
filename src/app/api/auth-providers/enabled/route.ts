/**
 * Public, unauthenticated endpoint that exposes the **display-only** fields
 * of every enabled `AuthProvider`. Consumed by the login screen to render
 * one button per IdP. Secret fields are intentionally excluded.
 */

import { NextResponse } from "next/server";

import { listEnabled } from "@/services/auth-provider/repository";

/** Cache for 30 seconds; admin writes invalidate `auth-providers` tag. */
const CACHE_HEADER = "max-age=30";

/**
 * Returns the enabled providers' minimal display payload.
 *
 * @returns A JSON response with `{ providerId, type, displayName }[]` and HTTP 200.
 *   Returns HTTP 500 with `INTERNAL_ERROR` on a DB failure.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rows = await listEnabled();
    const data = rows.map((r) => ({
      providerId: r.providerId,
      type: r.type,
      displayName: r.displayName,
    }));
    return NextResponse.json(
      { success: true, data },
      { status: 200, headers: { "Cache-Control": CACHE_HEADER } },
    );
  } catch (error: unknown) {
    console.error("[api/auth-providers/enabled]", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
