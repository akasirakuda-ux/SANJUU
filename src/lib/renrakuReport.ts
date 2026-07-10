import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Message } from '../components/Renrakucho/types';

export type RenrakuReportTargetType =
  | 'public_messages'
  | 'renraku_public'
  | 'renraku_private'
  | 'ouen_note_topic'
  | 'ouen_note_comment';

export type RenrakuReportRecord = {
  id: string;
  targetType: RenrakuReportTargetType;
  targetId: string;
  reason: string;
  detail: string;
  reporterUid: string;
  pagePath: string;
  createdAt: unknown;
  /** 通報時点の投稿者 UID（削除後もモデレーション用） */
  targetAuthorUid?: string;
  targetAuthorName?: string;
};

export const RENRAKU_REPORT_TARGET_LABELS: Record<RenrakuReportTargetType, string> = {
  public_messages: '掲示板投稿',
  renraku_public: '募集・掲示',
  renraku_private: 'らくだへの伝言',
  ouen_note_topic: '聞いてほしいノート（トピック）',
  ouen_note_comment: '聞いてほしいノート（返信）',
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

/** AdminScreen の handleDelete 引数に変換（ouen は別ハンドラ） */
export function renrakuReportDeleteTarget(
  targetType: RenrakuReportTargetType,
): 'community' | 'recruit' | 'private' | 'ouen' {
  if (targetType === 'public_messages') return 'community';
  if (targetType === 'renraku_public') return 'recruit';
  if (targetType === 'ouen_note_topic' || targetType === 'ouen_note_comment') return 'ouen';
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

/** 通報対象投稿の投稿者（一覧に無い・削除後も report に保存された UID を優先） */
export async function fetchRenrakuReportAuthor(
  report: Pick<RenrakuReportRecord, 'targetType' | 'targetId' | 'targetAuthorUid' | 'targetAuthorName'>,
  cached?: Message | null,
): Promise<{ authorUid?: string; authorName?: string }> {
  const storedUid = typeof report.targetAuthorUid === 'string' ? report.targetAuthorUid.trim() : '';
  const storedName = typeof report.targetAuthorName === 'string' ? report.targetAuthorName.trim() : '';
  if (storedUid) {
    return { authorUid: storedUid, authorName: storedName || undefined };
  }
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

/** 管理者: 通報レコードのみ削除（対象投稿はそのまま） */
export async function deleteRenrakuReport(reportId: string): Promise<void> {
  const id = String(reportId ?? '').trim();
  if (!id) return;
  await deleteDoc(doc(db, 'renraku_reports', id));
}

export async function submitRenrakuReport(payload: {
  targetType: RenrakuReportTargetType;
  targetId: string;
  reason: RenrakuReportReasonId;
  detail: string;
  reporterUid: string;
  pagePath: string;
  targetAuthorUid?: string | null;
  targetAuthorName?: string | null;
}): Promise<void> {
  const detail = String(payload.detail ?? '').trim().slice(0, 500);
  await addDoc(collection(db, 'renraku_reports'), {
    targetType: payload.targetType,
    targetId: String(payload.targetId ?? '').trim().slice(0, 128),
    reason: payload.reason,
    detail,
    reporterUid: payload.reporterUid,
    pagePath: String(payload.pagePath ?? '').trim().slice(0, 240),
    targetAuthorUid: String(payload.targetAuthorUid ?? '').trim().slice(0, 128),
    targetAuthorName: String(payload.targetAuthorName ?? '').trim().slice(0, 64),
    createdAt: serverTimestamp(),
  });
}
