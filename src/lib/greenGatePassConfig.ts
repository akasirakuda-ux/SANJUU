/** 感謝の1年無料パス（配布コード）— 表示・API 用定数 */

import { RAKUDA_SUPPORT_GATE_LABEL } from '../constants/rakudaSupportGateLabels';

export const GREEN_PASS_DEFAULT_LABEL = '感謝の1年無料パス';

/** コード手入力用（トップ・ゲート画面には出さない。配布文の URL のみ） */
export const GREEN_PASS_ENTRY_PATH = '/pass';

export function isGreenPassEntryPath(pathname?: string): boolean {
  const p =
    pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  return p === GREEN_PASS_ENTRY_PATH || p === `${GREEN_PASS_ENTRY_PATH}/`;
}

export function greenPassManualEntryUrl(origin?: string): string {
  const base = (
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://rakuda.coffee')
  ).replace(/\/$/, '');
  return `${base}${GREEN_PASS_ENTRY_PATH}`;
}

export function buildGreenPassRedeemUrl(code: string, origin?: string): string {
  const base = (
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://rakuda.coffee')
  ).replace(/\/$/, '');
  return `${base}/?green_pass=${encodeURIComponent(code)}`;
}

export type GreenPassReferrerInput = {
  name: string;
  facility?: string;
  introducedBy?: string;
  note?: string;
  advocate?: boolean;
};

export type GreenPassReferrerRow = {
  id: string;
  name: string;
  facility: string;
  introducedBy: string;
  note: string;
  advocate: boolean;
  issuedCount: number;
  redeemedCount: number;
  availableCount: number;
};

export function normalizeGreenPassCodeInput(raw: string): string {
  const compact = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
  if (!/^RK[A-Z0-9]{8}$/.test(compact)) return '';
  return `${compact.slice(0, 2)}-${compact.slice(2, 6)}-${compact.slice(6, 10)}`;
}

export type GreenPassRedeemResult =
  | { ok: true; greenUntilMs: number; label?: string }
  | { ok: false; error: string };

export async function redeemGreenPass(idToken: string, code: string): Promise<GreenPassRedeemResult> {
  const normalized = normalizeGreenPassCodeInput(code);
  if (!normalized) return { ok: false, error: 'invalid_code' };

  const r = await fetch('/api/green-pass/redeem', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ code: normalized }),
  });

  let data: { ok?: boolean; greenUntilMs?: number; label?: string; error?: string } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false, error: 'invalid_response' };
  }

  if (!r.ok || !data.ok || data.greenUntilMs == null) {
    return { ok: false, error: String(data.error ?? 'redeem_failed') };
  }

  return { ok: true, greenUntilMs: data.greenUntilMs, label: data.label };
}

export type GreenPassIssueRow = {
  code: string;
  redeemUrl: string;
};

export type GreenPassCreateOptions = {
  count: number;
  label?: string;
  referrerId?: string;
  referrer?: GreenPassReferrerInput;
};

export async function createGreenPassesAdmin(
  idToken: string,
  opts: GreenPassCreateOptions,
): Promise<
  | {
      ok: true;
      passes: GreenPassIssueRow[];
      label: string;
      referrerId: string | null;
      referrerName: string | null;
    }
  | { ok: false; error: string }
> {
  const r = await fetch('/api/green-pass/admin/create', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(opts),
  });

  let data: {
    ok?: boolean;
    passes?: GreenPassIssueRow[];
    label?: string;
    referrerId?: string | null;
    referrerName?: string | null;
    error?: string;
  } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false, error: 'invalid_response' };
  }

  if (!r.ok || !data.ok || !Array.isArray(data.passes)) {
    return { ok: false, error: String(data.error ?? 'create_failed') };
  }

  return {
    ok: true,
    passes: data.passes,
    label: String(data.label ?? GREEN_PASS_DEFAULT_LABEL),
    referrerId: data.referrerId ?? null,
    referrerName: data.referrerName ?? null,
  };
}

export type GreenPassAdminRow = {
  code: string;
  label: string;
  batchId: string;
  referrerId: string;
  referrerName: string;
  referrerFacility: string;
  introducedBy: string;
  referrerAdvocate: boolean;
  status: 'available' | 'redeemed' | 'revoked';
  redeemUrl: string;
  redeemedByUid: string | null;
};

export async function listGreenPassesAdmin(
  idToken: string,
): Promise<{ ok: true; passes: GreenPassAdminRow[] } | { ok: false; error: string }> {
  const r = await fetch('/api/green-pass/admin/list', {
    headers: { authorization: `Bearer ${idToken}` },
  });

  let data: { ok?: boolean; passes?: GreenPassAdminRow[]; error?: string } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false, error: 'invalid_response' };
  }

  if (!r.ok || !data.ok || !Array.isArray(data.passes)) {
    return { ok: false, error: String(data.error ?? 'list_failed') };
  }

  return { ok: true, passes: data.passes };
}

export async function listGreenPassReferrersAdmin(
  idToken: string,
): Promise<{ ok: true; referrers: GreenPassReferrerRow[] } | { ok: false; error: string }> {
  const r = await fetch('/api/green-pass/admin/referrers', {
    headers: { authorization: `Bearer ${idToken}` },
  });

  let data: { ok?: boolean; referrers?: GreenPassReferrerRow[]; error?: string } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false, error: 'invalid_response' };
  }

  if (!r.ok || !data.ok || !Array.isArray(data.referrers)) {
    return { ok: false, error: String(data.error ?? 'referrers_failed') };
  }

  return { ok: true, referrers: data.referrers };
}

export function greenPassRedeemErrorJa(error: string): string {
  switch (error) {
    case 'invalid_code':
      return 'コードの形式が正しくありません（例: RK-XXXX-XXXX）';
    case 'not_found':
      return 'コードが見つかりません';
    case 'already_redeemed':
      return 'このコードはすでに使われています';
    case 'revoked':
      return 'このコードは無効です';
    case 'auth_required':
      return 'Google ログインが必要です';
    default:
      return 'コードの確認に失敗しました。しばらくしてからお試しください';
  }
}

/** 受け取った方へ渡す短文（リンク＋手入力の2通り） */
export function buildGreenPassUserInstruction(
  redeemUrl: string,
  label = GREEN_PASS_DEFAULT_LABEL,
  code?: string,
): string {
  const manualUrl = redeemUrl.includes('green_pass=')
    ? greenPassManualEntryUrl(new URL(redeemUrl).origin)
    : greenPassManualEntryUrl();
  const codeLabel = code?.trim() || 'RK-XXXX-XXXX（お渡しのコード）';
  return [
    `【らくだ珈琲】${label}`,
    '',
    `${RAKUDA_SUPPORT_GATE_LABEL}（1年間・広告なし）の招待です。遊び方はいつもと同じまま、名前の色が緑になります。`,
    '',
    '■ ① リンクで開く（いちばんかんたん）',
    'Safari か Chrome で、次のリンクを1回だけ開いてください。',
    '表示されたら Google でログイン。',
    `「${RAKUDA_SUPPORT_GATE_LABEL}が有効」と出れば完了です。`,
    '',
    redeemUrl,
    '',
    '■ ② リンクが開けないとき（コード入力）',
    '次のページを開き、お渡しのコードを入力してください。',
    manualUrl,
    `入力するコード: ${codeLabel}`,
    '',
    '※ Instagram などアプリ内ブラウザでは開かないでください。',
    '※ このコードはあなた専用です。他の方に転送しないでください。',
  ].join('\n');
}

/** 配布担当者へ渡す説明＋コード一覧（LINE 等にコピペ） */
export function buildGreenPassDistributorHandout(
  passes: readonly GreenPassIssueRow[],
  opts?: { label?: string; referrerName?: string; referrerFacility?: string },
): string {
  const label = opts?.label?.trim() || GREEN_PASS_DEFAULT_LABEL;
  const name = opts?.referrerName?.trim();
  const facility = opts?.referrerFacility?.trim();
  const who = name && facility ? `${name}（${facility}）` : name || facility || '';
  const manualUrl =
    passes[0]?.redeemUrl != null
      ? greenPassManualEntryUrl(new URL(passes[0].redeemUrl).origin)
      : greenPassManualEntryUrl();

  const lines = [
    `【らくだ珈琲 — 配布コード（${RAKUDA_SUPPORT_GATE_LABEL}・1年）配布のお願い】`,
    '',
    `らくだ珈琲から「${label}」を、担当の方から1人ずつお渡しください。`,
    who ? `（記録: ${who} さん経由）` : '',
    '',
    '■ 配布担当の方へ（必ずお読みください）',
    '・1人1コード。転送・共有はしないでください。',
    '・グループLINE・掲示板・SNSには載せないでください。',
    `・らくだ珈琲のトップや${RAKUDA_SUPPORT_GATE_LABEL}の画面には、このコードの案内は出していません。`,
    '　「みんなにもあるの？」と聞かれないよう、口コミ配布はしないでください。',
    '・受け取った方には、下の「受け取った方へ渡す文」をそのまま送ってください。',
    '',
    '■ 受け取った方の使い方（2通り）',
    '① リンク（推奨）… 発行ごとの URL を1回開く → Google ログイン',
    `② 手入力 … ${manualUrl} を開き、お渡しの RK コードを入力`,
    '',
    `■ 手入力ページ（全員共通・ブックマーク用）`,
    manualUrl,
    '',
    '■ 受け取った方へ渡す文（1人につき1通、そのまま送る）',
    '',
    ...(passes.length === 1
      ? [buildGreenPassUserInstruction(passes[0].redeemUrl, label, passes[0].code), '']
      : passes.flatMap((p, i) => [
          `--- ${i + 1}人目（コード: ${p.code}）---`,
          buildGreenPassUserInstruction(p.redeemUrl, label, p.code),
          '',
        ])),
    '■ 配布担当メモ（コード一覧）',
    ...passes.map(
      (p, i) =>
        `${i + 1}. ${p.code}\n   リンク: ${p.redeemUrl}\n   手入力: ${manualUrl} に ${p.code}`,
    ),
    '',
    '不明点はらくだ珈琲（akasirakuda@gmail.com）まで。',
  ];
  return lines.join('\n');
}
