'use server'

import { getKiteInstance } from "@/lib/kite";

export async function fetchHistoricalData(instrumentToken: string, interval: string, from: string, to: string) {
  try {
    const kc = await getKiteInstance();
    const data = await kc.getHistoricalData(instrumentToken, interval, from, to);
    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching historical data:", error);
    return { success: false, error: error.message || "Failed to fetch data" };
  }
}
