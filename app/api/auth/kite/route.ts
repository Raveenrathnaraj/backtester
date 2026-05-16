import { generateSession } from '@/lib/kite';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestToken = searchParams.get('request_token');

  if (!requestToken) {
    return NextResponse.json({ error: 'Missing request_token' }, { status: 400 });
  }

  try {
    const accessToken = await generateSession(requestToken);
    
    const cookieStore = await cookies();
    cookieStore.set('kite_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day, expires daily anyway
    });

    // Redirect to hub page after successful login
    return NextResponse.redirect(new URL('/get-started', request.url));
  } catch (error: any) {
    console.error('Kite auth error:', error);
    return NextResponse.json({ error: 'Failed to authenticate with Kite', details: error?.message || String(error) }, { status: 500 });
  }
}
