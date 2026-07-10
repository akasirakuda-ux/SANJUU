/** 管理者が付与するイエロー／レッドカード（`user_moderation/{uid}`） */

export const USER_MODERATION_COLLECTION = 'user_moderation' as const;

export type UserModerationCardType = 'yellow' | 'red';

export interface UserModerationRecord {
  id: string;
  userName: string;
  yellowCount: number;
  redCount: number;
  /** レッドカードが有効な間はらくだ珈琲全体の利用不可 */
  redActive: boolean;
  updatedAt: unknown;
  lastCardType?: UserModerationCardType;
  note?: string;
}

export function parseUserModerationDoc(id: string, data: Record<string, unknown>): UserModerationRecord {
  return {
    id,
    userName: typeof data.userName === 'string' ? data.userName : '（名前不明）',
    yellowCount: typeof data.yellowCount === 'number' && data.yellowCount > 0 ? data.yellowCount : 0,
    redCount: typeof data.redCount === 'number' && data.redCount > 0 ? data.redCount : 0,
    redActive: data.redActive === true,
    updatedAt: data.updatedAt,
    lastCardType: data.lastCardType === 'yellow' || data.lastCardType === 'red' ? data.lastCardType : undefined,
    note: typeof data.note === 'string' ? data.note : undefined,
  };
}

export function userHasModerationCards(record: UserModerationRecord): boolean {
  return record.yellowCount > 0 || record.redActive || record.redCount > 0;
}

export function emptyUserModerationState(): Pick<
  UserModerationRecord,
  'yellowCount' | 'redCount' | 'redActive'
> {
  return { yellowCount: 0, redCount: 0, redActive: false };
}

type BlockedUserLegacy = { id: string; userName: string; blockedAt?: unknown };

/** 管理画面 — レッドカード一覧に旧 blockedUsers を合流（解除は onClearRedCard で両方） */
export function mergeAdminModerationList(
  moderated: UserModerationRecord[],
  blockedLegacy: BlockedUserLegacy[],
): UserModerationRecord[] {
  const byId = new Map<string, UserModerationRecord>();
  for (const u of moderated) byId.set(u.id, u);
  for (const b of blockedLegacy) {
    const existing = byId.get(b.id);
    if (existing) {
      if (!existing.redActive) {
        byId.set(b.id, { ...existing, redActive: true });
      }
      continue;
    }
    byId.set(b.id, {
      id: b.id,
      userName: b.userName,
      yellowCount: 0,
      redCount: 0,
      redActive: true,
      updatedAt: b.blockedAt,
    });
  }
  return [...byId.values()].filter((u) => userHasModerationCards(u) || u.redActive);
}
