import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session and manages the anonymous user cookie.
 *
 * 1. Refresh Supabase auth tokens (if any)
 * 2. If authenticated → sync af_user_id cookie to auth.uid
 * 3. If no af_user_id cookie → generate a new anonymous UUID
 * 4. No route blocking — everything is accessible.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not add code between createServerClient and getClaims.
  const { data } = await supabase.auth.getClaims();
  const authUser = data?.claims;

  // --- Anonymous user ID management ---
  const existingUserId = request.cookies.get("af_user_id")?.value;

  if (authUser) {
    // User is authenticated — sync cookie to their auth UID
    const authUid = authUser.sub;
    if (authUid && existingUserId !== authUid) {
      supabaseResponse.cookies.set("af_user_id", authUid, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      });
    }
  } else if (!existingUserId) {
    // No auth, no cookie → generate anonymous ID
    const anonId = crypto.randomUUID();
    supabaseResponse.cookies.set("af_user_id", anonId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
    });
  }

  return supabaseResponse;
}
