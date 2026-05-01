import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { hundredDisplayDeadlineMs } from '../../../lib/firestoreTime';
import { btnGhost, btnPrimary } from '../../../ui/policy';
import { db } from '../../../firebase';
import type { HundredPublicRecruit, HundredRoomListMeta } from '../types';

const pad2 = (n: number) => String(n).padStart(2, '0');

const HundredDetailPanel: React.FC<{
  selectedHundred: HundredPublicRecruit;
  currentUid: string | undefined;
  roomMeta?: HundredRoomListMeta;
  nowMs: number;
  onBack: () => void;
  onGoWait: () => void;
  /** 問題一覧・盤面プレビュー（hundred-board）へ */
  onGoBoard?: () => void;
  /** ホストのみ。hundred_public の当該ドキュメントを削除して一覧へ戻る */
  onCloseHundredRecruitment: () => void | Promise<void>;
  /** ゲストのみ。募集ドキュメント消失時に closed 画面へ */
  onGuestRecruitmentClosed: () => void;
}> = ({
  selectedHundred,
  currentUid,
  roomMeta,
  nowMs,
  onBack,
  onGoWait,
  onGoBoard,
  onCloseHundredRecruitment,
  onGuestRecruitmentClosed,
}) => {
  const [closing, setClosing] = useState(false);

  const isHost = !!currentUid && !!selectedHundred.hostUid && currentUid === selectedHundred.hostUid;

  useEffect(() => {
    const id = selectedHundred.id;
    if (!id) return;
    const ref = doc(db, 'hundred_public', id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // ゲスト（ホスト以外）：募集がとじられた → 専用案内へ
          const hostUid = selectedHundred.hostUid;
          if (hostUid != null && currentUid !== hostUid) {
            onGuestRecruitmentClosed();
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, [selectedHundred.id, selectedHundred.hostUid, currentUid, onGuestRecruitmentClosed]);

  const playerLabel = useMemo(() => {
    const n = roomMeta?.playerCount;
    return typeof n === 'number' ? `${n}/100` : '—/100';
  }, [roomMeta?.playerCount]);

  const countdownLabel = useMemo(() => {
    const deadlineMs = hundredDisplayDeadlineMs({
      roomRecruitDeadlineAt: roomMeta?.recruitDeadlineAt,
      itemRecruitDeadlineAt: selectedHundred.recruitDeadlineAt,
      itemCreatedAt: selectedHundred.createdAt,
    });
    if (deadlineMs == null) return '—';
    const left = Math.max(0, deadlineMs - nowMs);
    if (left <= 0) return '0:00';
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return `${m}:${pad2(s)}`;
  }, [roomMeta?.recruitDeadlineAt, selectedHundred.recruitDeadlineAt, selectedHundred.createdAt, nowMs]);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className={btnGhost}>
        もどる
      </button>

      <div className="bg-white rounded-xl p-4 shadow-md border border-slate-200 space-y-4">
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest">みんなであそぶ</div>
        <div className="text-lg font-bold">探すことば：{selectedHundred.targetWord || ''}</div>
        <div className="text-sm text-slate-600">
          盤面：{selectedHundred.boardSize || ''}×{selectedHundred.boardSize || ''}
        </div>
        <div className="text-sm text-slate-600">参加人数：{playerLabel}</div>
        <div className="text-sm text-slate-400">募集の残り：{countdownLabel}</div>

        <button type="button" className={btnPrimary} onClick={onGoWait}>
          募集に参加する
        </button>

        {onGoBoard ? (
          <button type="button" className={btnGhost} onClick={onGoBoard}>
            問題一覧・盤面を見る
          </button>
        ) : null}

        {isHost ? (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
              ホストだけが使えます。とじると一覧から消え、参加中・参加予定のみなさんにも影響する可能性があります。
            </p>
            <button
              type="button"
              disabled={closing}
              className="w-full py-3 rounded-xl border border-slate-300 bg-slate-100 text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-200 disabled:opacity-50 transition-colors"
              onClick={() => {
                if (
                  !window.confirm(
                    '募集をとじますか？\n\n他の参加者に影響する可能性があります。一覧からこの募集は消えます。'
                  )
                ) {
                  return;
                }
                setClosing(true);
                void Promise.resolve(onCloseHundredRecruitment())
                  .catch(() => {})
                  .finally(() => setClosing(false));
              }}
            >
              {closing ? 'とじています…' : '募集をとじる'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default HundredDetailPanel;
