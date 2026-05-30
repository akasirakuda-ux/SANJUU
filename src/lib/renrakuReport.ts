import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Message } from '../components/Renrakucho/types';

export type RenrakuReportTargetType = 'public_messages' | 'renraku_public' | 'renraku_private';

export type RenrakuReportRecord = {
  id: string;
  targetType: RenrakuReportTargetType;
  targetId: string;
  reason: string;
  detail: string;
  reporterUid: string;
  pagePath: string;
  createdAt: unknown;
};

export const RENRAKU_REPORT_TARGET_LABELS: Record<RenrakuReportTargetType, string> = {
  public_messages: '掲示板投稿',
  renraku_public: '募集・掲示',
  renraku_private: 'らくだへの伝言',
};

/** 掲示板タイムライン上の投稿 DOM id / URL ハッシュ用 */
export const RENRAKU_BOARD_POST_FRAGMENT_PREFIX = 'rk-board-post-';

export function renrakuBoardPostElementId(postId: string): string {
  return `${RENRAKU_BOARD_POST_FRAGMENT_PREFIX}${String(postId ?? '').trim()}`;
}

export function parseRenrakuBoardPostIdFromHash(hash?: string): string | null {
  const raw = (hash ?? (typeof window !== 'undefined' ? window.location.hash : '')).replace(/^#/, '');
  if (!raw.startsWith(RENRAKU_BOARD_POST_FRAGMENT_PREFIX)) return null;
  const id = raw.slice(RENRAKU_BOARD_POST_FRAGMENT_PREFIX.length).trim();
  return id || null;
}

/** 通報対象が掲示板タイムライン上で開ける種類か */
export function renrakuReportCanOpenOnBoard(targetType: RenrakuReportTargetType): boolean {
  return targetType === 'public_messages' || targetType === 'renraku_public';
}

export function renrakuReportReasonLabelJa(reason: string): string {
  return RENRAKU_REPORT_REASONS.find((r) => r.id === reason)?.label ?? reason;
}

/** AdminScreen の handleDelete 引数に変換 */
export function renrakuReportDeleteTarget(
  targetType: RenrakuReportTargetType,
): 'community' | 'recruit' | 'private' {
  if (targetType === 'public_messages') return 'community';
  if (targetType === 'renraku_public') return 'recruit';
  return 'private';
}

export function resolveRenrakuReportTargetMessage(
  report: Pick<RenrakuReportRecord, 'targetType' | 'targetId'>,
  boardMessages: Message[],
  recruitMessages: Message[],
  privateMessages: Message[],
): Message | undefined {
  const id = report.targetId;
  if (report.targetType === 'public_messages') {
    return boardMessages.find((m) => m.id === id);
  }
  if (report.targetType === 'renraku_public') {
    return recruitMessages.find((m) => m.id === id);
  }
  return privateMessages.find((m) => m.id === id);
}

/** 通報対象投稿の投稿者（一覧に無い blocked 投稿も doc から取得） */
export async function fetchRenrakuReportAuthor(
  report: Pick<RenrakuReportRecord, 'targetType' | 'targetId'>,
  cached?: Message | null,
): Promise<{ authorUid?: string; authorName?: string }> {
  if (cached?.fromUserUid) {
    return { authorUid: cached.fromUserUid, authorName: cached.fromUser };
  }
  try {
    const snap = await getDoc(doc(db, report.targetType, report.targetId));
    if (!snap.exists()) return {};
    const d = snap.data() as { fromUserUid?: unknown; fromUser?: unknown };
    return {
      authorUid: typeof d.fromUserUid === 'string' ? d.fromUserUid : undefined,
      authorName: typeof d.fromUser === 'string' ? d.fromUser : undefined,
    };
  } catch {
    return {};
  }
}

export const RENRAKU_REPORT_REASONS = [
  { id: 'impersonation', label: 'なりすまし・公式のふり' },
  { id: 'harassment', label: '嫌がらせ・攻撃的' },
  { id: 'spam', label: 'スパム・宣伝' },
  { id: 'inappropriate', label: '不適切な内容' },
  { id: 'other', label: 'その他' },
] as const;

export type RenrakuReportReasonId = (typeof RENRAKU_REPORT_REASONS)[number]['id'];

export async function submitRenrakuReport(payload: {
  targetType: RenrakuReportTargetType;
  targetId: string;
  reason: RenrakuReportReasonId;
  detail: string;
  reporterUid: string;
  pagePath: string;
}): Promise<void> {
  const detail = String(payload.detail ?? '').trim().slice(0, 500);
  await addDoc(collection(db, 'renraku_reports'), {
    targetType: payload.targetType,
    targetId: String(payload.targetId ?? '').trim().slice(0, 128),
    reason: payload.reason,
    detail,
    reporterUid: payload.reporterUid,
    pagePath: String(payload.pagePath ?? '').trim().slice(0, 240),
    createdAt: serverTimestamp(),
  });
}
