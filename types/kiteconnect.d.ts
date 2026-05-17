declare module "kiteconnect" {
  export class KiteConnect {
    constructor(params: { api_key: string; access_token?: string });
    getLoginURL(): string;
    generateSession(
      requestToken: string,
      apiSecret: string,
    ): Promise<{ access_token: string; [key: string]: any }>;
    setAccessToken(accessToken: string): void;
    getHistoricalData(
      instrumentToken: string,
      interval: string,
      from: string | Date,
      to: string | Date,
      continuous?: boolean,
      oi?: boolean,
    ): Promise<any[]>;
    getInstruments(segment?: string): Promise<any[]>;
  }
}
