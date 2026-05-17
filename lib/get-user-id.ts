import { cookies } from "next/headers";

/**
 * Get the effective user_id for the current request.
 * Reads the af_user_id cookie set by the proxy.
 *
 * In API routes, you can also pass the NextRequest to read from request cookies.
 * For server components, it reads from next/headers cookies.
 *
 * Returns the user_id string (either anonymous UUID or Supabase auth UID).
 * Throws if no user_id is found (should never happen if proxy is configured correctly).
 */
export async function getUserId(): Promise<string> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("af_user_id")?.value;

  if (!userId) {
    throw new Error(
      "No af_user_id cookie found. Ensure proxy.ts is configured correctly.",
    );
  }

  return userId;
}

/**
 * Get the user_id from a NextRequest object (for use in API route handlers).
 */
export function getUserIdFromRequest(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/af_user_id=([^;]+)/);

  if (!match) {
    throw new Error(
      "No af_user_id cookie found. Ensure proxy.ts is configured correctly.",
    );
  }

  return match[1];
}
