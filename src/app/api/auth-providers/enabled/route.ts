/**
 * Public, unauthenticated endpoint that exposes the **display-only** fields
 * of every enabled `AuthProvider`. Consumed by the login screen to render
 * one button per IdP. Secret fields are intentionally excluded.
 */

import type { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/api-response";
import { listEnabledDisplayOnly } from "@/services/auth-provider/repository";

/** Cache for 30 seconds; admin writes invalidate `auth-providers` tag. */
const CACHE_HEADER = "max-age=30";

/**
 * Returns all enabled AuthProviders for the login screen (public, unauthenticated).
 *
 * @returns `200` with an array of enabled providers, cached for 30 seconds.
 *          `500` on unexpected error.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rows = await listEnabledDisplayOnly();
    const res = ok(rows);
    res.headers.set("Cache-Control", CACHE_HEADER);
    return res;
  } catch (error: unknown) {
    console.error("[api/auth-providers/enabled]", error);
    return fail("INTERNAL_ERROR", 500);
  }
}
