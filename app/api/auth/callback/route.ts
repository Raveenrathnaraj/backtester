import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/callback
 *
 * Handles the OAuth redirect from Supabase Auth (Google, Email confirm, etc.).
 * Exchanges the `code` query param for a session, then redirects to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/get-started';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the user to sync af_user_id cookie
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Sync af_user_id cookie to auth UID
        cookieStore.set('af_user_id', user.id, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
        });
      }

      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // If code exchange failed, redirect to error page or login
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin));
}
