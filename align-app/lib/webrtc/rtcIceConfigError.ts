/** Eșec `GET /api/call/ice-config` — include `errorCode` din corpul JSON când există. */
export class RtcIceConfigError extends Error {
  readonly status: number;
  readonly errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = "RtcIceConfigError";
    this.status = status;
    this.errorCode = errorCode;
  }
}
