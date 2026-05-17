/**
 * Public, unauthenticated endpoint that exposes the **display-only** fields
 * of every enabled `AuthProvider`. Consumed by the login screen to render
 * one button per IdP. Secret fields are intentionally excluded.
 */

import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/api-response";
import { listEnabled } from "@/services/auth-provider/repository";

/** Cache for 30 seconds; admin writes invalidate `auth-providers` tag. */
const CACHE_HEADER = "max-age=30";

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await listEnabled();
    const data = rows.map((r) => ({
      providerId: r.providerId,
      type: r.type,
      displayName: r.displayName,
    }));
    const res = ok(data);
    res.headers.set("Cache-Control", CACHE_HEADER);
    return res;
  } catch (error: unknown) {
    console.error("[api/auth-providers/enabled]", error);
    return fail("INTERNAL_ERROR", 500);
  }
}
