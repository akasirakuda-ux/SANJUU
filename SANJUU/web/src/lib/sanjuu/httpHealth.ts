import { NextResponse } from "next/server";

/** LB・同一オリジン監視用（`/api/health` と `/healthz` で共有） */
export function sanjuuHealthResponse() {
  return NextResponse.json({
    ok: true,
    service: "30sanjuu-next",
    t: Date.now(),
  });
}
