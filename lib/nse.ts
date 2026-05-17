const NSE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fallback to fetch live index constituent CSV from niftyindices.com,
 * which does not block Vercel or cloud IPs.
 */
async function fetchNiftyIndicesCSVFallback(indexName: string) {
  const normalized = indexName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Try without underscore, then with underscore if 404
  const urlsToTry = [
    `https://www.niftyindices.com/IndexConstituent/ind_${normalized}list.csv`,
    `https://www.niftyindices.com/IndexConstituent/ind_${normalized}_list.csv`,
  ];

  let csvText = "";
  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        // IIS sometimes returns 200 OK with HTML for 404s. Validate it's a CSV.
        if (text.trim().toLowerCase().startsWith("company name")) {
          csvText = text;
          break;
        }
      }
    } catch (err) {
      // Ignore and try next
    }
  }

  if (!csvText) {
    throw new Error(
      `Failed to fetch CSV for index: ${indexName} from niftyindices.com`,
    );
  }

  const lines = csvText.trim().split("\n");
  if (lines.length <= 1) {
    throw new Error("CSV is empty or invalid");
  }

  const data = lines
    .slice(1)
    .map((line) => {
      // Split by comma, ignoring commas inside double quotes
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      return {
        symbol: values[2]?.replace(/^"|"$/g, "").trim(),
        meta: {
          companyName: values[0]?.replace(/^"|"$/g, "").trim(),
          industry: values[1]?.replace(/^"|"$/g, "").trim(),
          isin: values[4]?.replace(/^"|"$/g, "").trim(),
        },
        series: values[3]?.replace(/^"|"$/g, "").trim(),
      };
    })
    .filter((item) => item.symbol && item.symbol !== "Symbol");

  return {
    metadata: {
      indexName: indexName,
    },
    data,
  };
}

/**
 * Perform a robust "cookie dance" with the NSE website to fetch stock data for an index.
 * Uses a retry mechanism with backoff, prevents caching, parses set-cookie headers properly.
 * Automatically falls back to niftyindices.com if nseindia.com blocks the request (e.g., on Vercel).
 */
export async function fetchNSEIndex(
  indexName: string,
  retries = 2,
  delay = 500,
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Fetch homepage to get cookies, explicitly disabling Next.js caching
      const homeRes = await fetch("https://www.nseindia.com/", {
        headers: {
          "User-Agent": NSE_USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        cache: "no-store",
      });

      if (!homeRes.ok) {
        throw new Error(
          `Failed to access NSE homepage (HTTP ${homeRes.status})`,
        );
      }

      // 2. Extract and format cookies correctly (avoiding attributes and malformed formats)
      // @ts-ignore - getSetCookie exists in Node 18+ Headers implementation
      const rawCookies =
        typeof homeRes.headers.getSetCookie === "function"
          ? homeRes.headers.getSetCookie()
          : homeRes.headers.get("set-cookie")
            ? [homeRes.headers.get("set-cookie")!]
            : [];

      if (rawCookies.length === 0) {
        throw new Error("No set-cookie headers returned by NSE homepage");
      }

      const cookieStr = rawCookies.map((c) => c.split(";")[0]).join("; ");

      // 3. Request index constituent data using the clean cookie string
      const apiUrl = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`;
      const apiRes = await fetch(apiUrl, {
        headers: {
          "User-Agent": NSE_USER_AGENT,
          Referer: "https://www.nseindia.com/market-data/live-equity-market",
          Cookie: cookieStr,
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        cache: "no-store",
      });

      if (!apiRes.ok) {
        throw new Error(`NSE API returned status ${apiRes.status}`);
      }

      const data = await apiRes.json();
      if (!data || !data.data) {
        throw new Error("NSE API response missing data payload");
      }

      return data;
    } catch (error: any) {
      console.warn(`NSE fetch attempt ${attempt} failed: ${error.message}`);
      lastError = error;
      if (attempt < retries) {
        await sleep(delay * attempt); // Exponential backoff
      }
    }
  }

  console.warn(
    `Failed to fetch from nseindia.com. Falling back to dynamic niftyindices.com CSV for ${indexName}...`,
  );
  return fetchNiftyIndicesCSVFallback(indexName);
}
