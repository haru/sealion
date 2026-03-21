import { NextResponse } from "next/server";

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

/**
 * Returns a successful JSON response with the given data.
 * @param data - The response payload.
 * @param status - HTTP status code (default 200).
 */
export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null }, { status });
}

/**
 * Returns an error JSON response.
 * @param error - The error message.
 * @param status - HTTP status code.
 */
export function fail(error: string, status: number): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error }, { status });
}
