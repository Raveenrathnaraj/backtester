import { KiteConnect } from 'kiteconnect';
import { cookies } from 'next/headers';

// Initialize KiteConnect instance. Note that we may not have the access token initially.
export const getKiteInstance = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('kite_access_token')?.value;

  const kc = new KiteConnect({
    api_key: (process.env.KITE_API_KEY || '').trim(),
    access_token: accessToken,
  });

  return kc;
};

/**
 * Create a KiteConnect instance from an access token string directly.
 * Use this in API routes where cookies() may not be available.
 */
export const getKiteInstanceFromToken = (accessToken: string) => {
  return new KiteConnect({
    api_key: (process.env.KITE_API_KEY || '').trim(),
    access_token: accessToken,
  });
};

export const getLoginUrl = () => {
  const kc = new KiteConnect({ api_key: (process.env.KITE_API_KEY || '').trim() });
  return kc.getLoginURL();
};

export const generateSession = async (requestToken: string) => {
  const kc = new KiteConnect({ api_key: (process.env.KITE_API_KEY || '').trim() });
  try {
    const response = await kc.generateSession(requestToken, (process.env.KITE_API_SECRET || '').trim());
    return response.access_token;
  } catch (error) {
    console.error("Failed to generate session", error);
    throw error;
  }
};
