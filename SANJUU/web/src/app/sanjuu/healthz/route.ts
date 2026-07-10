import { sanjuuHealthResponse } from "@/lib/sanjuu/httpHealth";

export const dynamic = "force-dynamic";

/** 同一オリジン監視用（`/healthz` はインフラ側で拾われることがあるため `/sanjuu` 配下に置く） */
export async function GET() {
  return sanjuuHealthResponse();
}
