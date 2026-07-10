import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { btnGhost, btnPrimary } from '../../../ui/policy';
import { db } from '../../../firebase';
import { formatBoardDimensions } from '../../../lib/boardDimensions';
import {
  resolveHundredRecruitBoardFields,
  resolveHundredRecruitTargetWord,
} from '../../../lib/hundredRecruitDisplay';
import { isRoboPickupLoungeRecruit } from '../../../lib/roboPickupLoungeConfig';
import { isHundredBetweenRounds } from '../../../lib/firestoreTime';
import { HUNDRED_MAX_PLAYERS } from '../../../lib/hundredRoomCapacity';
import type { HundredPublicRecruit, HundredRoomListMeta } from '../types';

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
    if (!id || id.startsWith('local-')) return;
    const ref = doc(db, 'hundred_public', id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // お題間は hundred_public を消すだけ（待機継続）。終了・取消のときだけ閉じる。
          if (isHundredBetweenRounds(roomMeta)) return;
          const hostUid = selectedHundred.hostUid;
          if (hostUid != null && currentUid !== hostUid) {
            onGuestRecruitmentClosed();
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, [selectedHundred.id, selectedHundred.hostUid, currentUid, roomMeta, onGuestRecruitmentClosed]);

  const playerLabel = useMemo(() => {
    const n = roomMeta?.playerCount;
    return typeof n === 'number' ? `${n}/${HUNDRED_MAX_PLAYERS}` : `—/${HUNDRED_MAX_PLAYERS}`;
  }, [roomMeta?.playerCount]);

  const displayTargetWord = useMemo(
    () => resolveHundredRecruitTargetWord(selectedHundred, roomMeta),
    [selectedHundred, roomMeta],
  );
  const displayBoard = useMemo(
    () => resolveHundredRecruitBoardFields(selectedHundred, roomMeta),
    [selectedHundred, roomMeta],
  );
  const isRoboLounge = isRoboPickupLoungeRecruit(selectedHundred);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className={btnGhost}>
        もどる
      </button>

      <div className="bg-rk-white rounded-xl p-4 shadow-md border border-rk-slate-200 space-y-4">
        <div className="text-xs font-black text-rk-slate-400 uppercase tracking-widest">みんなであそぶ</div>
        <div className="text-lg font-bold">探すことば：{displayTargetWord}</div>
        <div className="text-sm text-rk-slate-600">
          盤面：{formatBoardDimensions(displayBoard)}
        </div>
        {isRoboLounge ? (
          <div className="text-xs text-rk-slate-500">いまのお題（みんなで全部見つけると次へ）</div>
        ) : (
          <div className="text-sm text-rk-slate-600">いつでも参加できます（ゲーム中もOK）</div>
        )}
        {selectedHundred.hundredMode !== 'tile_match' ? (
          <div className="text-sm text-rk-slate-600">
            ヒント：{selectedHundred.hintsEnabled === false ? 'なし' : 'あり'}
          </div>
        ) : null}
        <div className="text-sm text-rk-slate-600">参加人数：{playerLabel}</div>

        <button type="button" className={btnPrimary} onClick={onGoWait}>
          募集に参加する
        </button>

        {onGoBoard ? (
          <button type="button" className={btnGhost} onClick={onGoBoard}>
            問題一覧・盤面を見る
          </button>
        ) : null}

        {isHost ? (
          <div className="pt-2 border-t border-rk-slate-100">
            <p className="text-[11px] text-rk-slate-400 mb-2 leading-relaxed">
              ホストだけが使えます。とじると一覧から消え、参加中・参加予定のみなさんにも影響する可能性があります。
            </p>
            <button
              type="button"
              disabled={closing}
              className="w-full py-3 rounded-xl border border-rk-slate-300 bg-rk-slate-100 text-rk-slate-700 text-sm font-medium shadow-sm hover:bg-rk-slate-200 disabled:opacity-50 transition-colors"
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
