import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';
import type { HundredRecruitDurationSec } from './Renrakucho/types';
import { doc, setDoc } from 'firebase/firestore';

const createRoomId = () => {
  const c: any = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export type HundredCreatedPayload = {
  id: string;
  roomId: string;
  targetWord: string;
  boardSize: number;
  /** ルームの hostUid（待機画面のホスト判定の即時反映用） */
  hostUid: string;
  /** 募集が掲載される時間（秒）。300=5分, 600=10分, 900=15分。`recruitDeadlineAt` と一致 */
  recruitDurationSec: HundredRecruitDurationSec;
  /** 募集締切（クライアント計算。一覧・待機画面のカウントダウン用） */
  recruitDeadlineAt: Timestamp;
};

type HundredCreateProps = {
  hostNickname: string;
  hostEmoji: string;
  isAdmin?: boolean;
  onCreated?: (payload: HundredCreatedPayload) => void;
};

/** タテ＝ヨコの一辺のマス数（Firestore は従来どおり number） */
const BOARD_SIZE_OPTIONS = [5, 10, 15, 20, 30] as const;
type BoardSizeChoice = (typeof BOARD_SIZE_OPTIONS)[number];

const HundredCreate: React.FC<HundredCreateProps> = ({ hostNickname, hostEmoji, isAdmin = false, onCreated }) => {
  const [targetWord, setTargetWord] = useState('');
  const [boardSize, setBoardSize] = useState<BoardSizeChoice>(20);
  /** 募集時間の長さ（5・10・15 分） */
  const [recruitDurationSec, setRecruitDurationSec] = useState<HundredRecruitDurationSec>(300);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    const word = targetWord.trim();
    const size = boardSize;
    if (!word) {
      window.alert('「探すことば」を入力してください。');
      return;
    }
    if (Array.from(word).length > size) {
      window.alert(`「探すことば」が盤面サイズ（${size}×${size}）より長いです。短いことばにしてください。`);
      return;
    }

    const roomId = createRoomId();
    setIsSaving(true);
    try {
      const ensureUid = async () => {
        if (!auth.currentUser) {
          console.info('[HundredCreate] signInAnonymously start');
          await signInAnonymously(auth);
        }
        const uid = auth.currentUser?.uid;
        if (!uid) {
          const msg = '[HundredCreate] auth.currentUser.uid is null after sign-in';
          console.error(msg, { currentUser: auth.currentUser });
          throw Object.assign(new Error(msg), { code: 'auth/uid-missing' });
        }
        return uid;
      };

      const uid = await ensureUid().catch((e: any) => {
        console.error('[HundredCreate] ensureUid failed', {
          code: e?.code,
          message: e?.message,
          name: e?.name,
        });
        window.alert(`ログインを完了できませんでした。（${e?.code ?? 'unknown'}）`);
        throw e;
      });

      console.info('[HundredCreate] write start', {
        uid,
        roomId,
        targetWord: word,
        boardSize: size,
      });

      const recruitDeadlineAt = Timestamp.fromMillis(Date.now() + recruitDurationSec * 1000);
      const displayName = (hostNickname || '').trim() || 'ホスト';
      const displayEmoji = (hostEmoji || '').trim() || '🐫';

      /** プレイに時間制限を設けない（終了はクリア／ルーム終了のみ） */
      const gameTimeLimitSec = 0;

      const docRef = await addDoc(collection(db, 'hundred_public'), {
        targetWord: word,
        boardSize: size,
        createdAt: serverTimestamp(),
        type: 'hundred',
        roomId,
        hostUid: uid,
        hostNickname: displayName,
        hostEmoji: displayEmoji,
        recruitDeadlineAt,
        gameTimeLimitSec,
      });
      console.info('[HundredCreate] hundred_public created', { id: docRef.id, roomId, uid });

      // ことば拾い用ルーム（開始状態の共有用）を作成
      try {
        await setDoc(
          doc(db, 'hundred_rooms', roomId),
          {
            status: 'recruiting',
            createdAt: serverTimestamp(),
            startedAt: null,
            hostUid: uid,
            hostNickname: displayName,
            hostEmoji: displayEmoji,
            publicRecruitId: docRef.id,
            targetWord: word,
            boardSize: size,
            recruitDeadlineAt,
            playerCount: 0,
            gameTimeLimitSec,
            // Safety: if roomId ever collides / is reused, don't keep old ribbons.
            foundWords: [],
          },
          { merge: true }
        );
        console.info('[HundredCreate] hundred_rooms created/merged', { roomId, hostUid: uid });
      } catch (e: any) {
        console.error('[HundredCreate] hundred_rooms write failed', {
          code: e?.code,
          message: e?.message,
          roomId,
          hostUid: uid,
        });
        // 募集だけ残るのを避ける（可能なら巻き戻す）
        await deleteDoc(docRef).catch(() => {});
        window.alert(`募集の保存に失敗しました。（hundred_rooms: ${e?.code ?? 'unknown'}）`);
        return;
      }
      onCreated?.({
        id: docRef.id,
        roomId,
        targetWord: word,
        boardSize: size,
        hostUid: uid,
        recruitDurationSec,
        recruitDeadlineAt,
      });
    } catch (e) {
      console.error('[HundredCreate] create failed:', {
        code: (e as any)?.code,
        message: (e as any)?.message,
        error: e,
      });
      window.alert(`募集の保存に失敗しました。（${(e as any)?.code ?? 'unknown'}）`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative max-w-lg mx-auto space-y-4 p-4">
      {/* Opaque backing to prevent background show-through */}
      <div className="absolute inset-0 -z-10 rounded-2xl bg-[#faf6f0]" aria-hidden />

      <h1 className="text-sm font-black text-[#5a3d28]">🔍「探し物」の募集をする</h1>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-black text-[#5a3d28] uppercase tracking-widest ml-1">探すことば</label>
          <input
            type="text"
            value={targetWord}
            onChange={(e) => setTargetWord(e.target.value)}
            className="w-full h-12 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#5a3d28]/30 transition-colors text-sm placeholder:text-[#9a7b4f] text-slate-800"
            placeholder="例：さくら"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-[#5a3d28] uppercase tracking-widest ml-1">盤面サイズ（タテ・ヨコ）</label>
          <p className="text-[11px] font-bold text-slate-600 ml-1">
            <span className="font-black text-slate-800">20×20以下</span> 推奨（30×30は重くなりやすい）
          </p>
          <div className="flex flex-wrap gap-2">
            {BOARD_SIZE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBoardSize(n)}
                className={`min-w-[3.25rem] px-3 py-2 rounded-xl text-sm border transition-colors tabular-nums ${
                  boardSize === n
                    ? 'bg-[#5a3d28] border-[#3b2a18] text-white'
                    : 'bg-slate-50 border-slate-200 text-[#9a7b4f]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-[#5a3d28] uppercase tracking-widest ml-1">募集時間の長さ</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { sec: 300 as const, label: '5分' },
                { sec: 600 as const, label: '10分' },
                { sec: 900 as const, label: '15分' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.sec}
                type="button"
                onClick={() => setRecruitDurationSec(opt.sec)}
                className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                  recruitDurationSec === opt.sec
                    ? 'bg-[#5a3d28] border-[#3b2a18] text-white'
                    : 'bg-slate-50 border-slate-200 text-[#9a7b4f]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="w-full py-3 rounded-xl bg-[#5a3d28] border-2 border-[#3b2a18] text-white font-black text-[130%] shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
          disabled={isSaving}
          onClick={() => void handleCreate()}
        >
          {isSaving ? '保存中…' : '掲示板に募集をのせる'}
        </button>
      </div>
    </div>
  );
};

export default HundredCreate;
