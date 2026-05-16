import { db } from './index';
import { instruments } from './schema';
import { eq } from 'drizzle-orm';

export interface DBInstrument {
  symbol: string;
  companyName: string;
  industry: string;
  series: string;
  isinCode: string;
  kiteToken: number | null;
  kiteTokenUpdatedAt: string | null;
}

/**
 * Fetch all NSE equity instruments from the database.
 */
export function getAllInstruments(): DBInstrument[] {
  return db.select().from(instruments).all();
}

/**
 * Update the kite token for a specific symbol.
 */
export function updateKiteToken(symbol: string, token: number): void {
  db.update(instruments)
    .set({
      kiteToken: token,
      kiteTokenUpdatedAt: new Date().toISOString(),
    })
    .where(eq(instruments.symbol, symbol))
    .run();
}

/**
 * Check if the stored kite tokens are considered "stale".
 * For example, older than 24 hours. We check a single token as proxy for all.
 */
export function areTokensStale(): boolean {
  // Get just the first row to check its timestamp
  const row = db
    .select({ kiteTokenUpdatedAt: instruments.kiteTokenUpdatedAt })
    .from(instruments)
    .limit(1)
    .get();

  if (!row || !row.kiteTokenUpdatedAt) return true;

  const updatedTime = new Date(row.kiteTokenUpdatedAt).getTime();
  const now = Date.now();
  const hoursSinceUpdate = (now - updatedTime) / (1000 * 60 * 60);

  return hoursSinceUpdate > 24;
}
