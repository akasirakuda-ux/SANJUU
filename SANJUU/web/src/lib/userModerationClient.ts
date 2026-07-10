import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getSanjuuFirestore } from './sanjuuFirebase';
import { isProtectedRenrakuAdminUid } from './rakudaRenrakuAdminClient';

export const USER_MODERATION_COLLECTION = 'user_moderation' as const;

type ModerationCardType = 'yellow' | 'red';

type ModerationState = {
  userName: string;
  yellowCount: number;
  redCount: number;
  redActive: boolean;
};

function parseModerationState(data: Record<string, unknown> | undefined, fallbackName: string): ModerationState {
  return {
    userName: typeof data?.userName === 'string' ? data.userName : fallbackName,
    yellowCount: typeof data?.yellowCount === 'number' && data.yellowCount > 0 ? data.yellowCount : 0,
    redCount: typeof data?.redCount === 'number' && data.redCount > 0 ? data.redCount : 0,
    redActive: data?.redActive === true,
  };
}

async function upsertModerationCard(userId: string, userName: string, cardType: ModerationCardType): Promise<void> {
  const ref = doc(getSanjuuFirestore(), USER_MODERATION_COLLECTION, userId);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? parseModerationState(snap.data() as Record<string, unknown>, userName) : null;
  const base = prev ?? { userName, yellowCount: 0, redCount: 0, redActive: false };
  await setDoc(
    ref,
    {
      userName: String(userName || base.userName || '（名前不明）').trim() || '（名前不明）',
      yellowCount: cardType === 'yellow' ? base.yellowCount + 1 : base.yellowCount,
      redCount: cardType === 'red' ? base.redCount + 1 : base.redCount,
      redActive: cardType === 'red' ? true : base.redActive,
      lastCardType: cardType,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function issueYellowCardFromSanjuu(userId: string, userName: string): Promise<void> {
  if (!userId || isProtectedRenrakuAdminUid(userId)) return;
  if (!window.confirm(`「${userName || 'この利用者'}」にイエローカードを付けますか？\n\n警告のみで、投稿はできます。`)) {
    return;
  }
  await upsertModerationCard(userId, userName, 'yellow');
}

export async function issueRedCardFromSanjuu(userId: string, userName: string): Promise<void> {
  if (!userId || isProtectedRenrakuAdminUid(userId)) return;
  if (
    !window.confirm(
      `「${userName || 'この利用者'}」にレッドカードを付けますか？\n\nらくだ珈琲🐫☕の利用をすべて止めます。連絡帳のかんりから解除できます。`
    )
  ) {
    return;
  }
  await upsertModerationCard(userId, userName, 'red');
}
