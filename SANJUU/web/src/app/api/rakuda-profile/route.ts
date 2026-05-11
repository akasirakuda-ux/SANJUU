import { NextResponse } from 'next/server';

/**
 * ブラウザは thirty 自身のオリジンへだけ fetch し、サーバーがらくだの `/api/me/profile` を代理取得する（CORS 回避）。
 */
export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_RAKUDA_ORIGIN || 'https://rakuda.coffee').replace(/\/+$/, '');
  const auth = req.headers.get('authorization');
  const empty = { ok: true as const, profile: { emoji: '', nickname: '' } };

  try {
    const r = await fetch(`${base}/api/me/profile`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(auth ? { authorization: auth } : {}),
      },
    });
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json(empty);
    }
    const body: unknown = await r.json();
    if (typeof body !== 'object' || !body) {
      return NextResponse.json(empty);
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(empty);
  }
}
