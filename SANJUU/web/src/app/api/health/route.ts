import { sanjuuHealthResponse } from "@/lib/sanjuu/httpHealth";

export const dynamic = "force-dynamic";

/** プロセスのヘルスチェック（ロードバランサ・監視用）。同一オリジンでは `/healthz` も参照。 */
export async function GET() {
  return sanjuuHealthResponse();
}
