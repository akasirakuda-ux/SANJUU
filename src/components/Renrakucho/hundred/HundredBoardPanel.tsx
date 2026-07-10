import React, { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  applyHostCancelledHundredGeneration,
  hundredPublicListingDocId,
} from '../../../lib/hundredRecruitCancel';
import { isRoboPickupLoungeRecruit } from '../../../lib/roboPickupLoungeConfig';
import { btnGhost, btnPrimary } from '../../../ui/policy';
import { formatBoardDimensions, resolveBoardCols, resolveBoardRows } from '../../../lib/boardDimensions';
import { hundredRoomCanEnterGame } from '../../../lib/hundredRoomBoard';
import { auth, db } from '../../../firebase';
import HundredProblemList from './HundredProblemList';
import HundredProblemGeneratingOverlay from './HundredProblemGeneratingOverlay';

const HundredBoardPanel: React.FC<{
  selectedHundred: HundredPublicRecruit;
  /** 配信/低負荷モード（YouTube Live 安定化用） */
  streamMode?: boolean;
  onBack: () => void;
  onStartHundred: (roomId: string, opts?: { hundredMode?: string }) => void | Promise<void>;
  onGenerationCancelled?: () => void;
}> = ({ selectedHundred, streamMode = false, onBack, onStartHundred, onGenerationCancelled }) => {
  const roomId = selectedHundred.roomId || '';
  const [problemsGenerating, setProblemsGenerating] = useState(false);
  const [roomStatus, setRoomStatus] = useState('recruiting');
  const [problemsReady, setProblemsReady] = useState(false);
  const [hasGrid, setHasGrid] = useState(false);
  const [hostUid, setHostUid] = useState('');
  const [authUid, setAuthUid] = useState<string | undefined>(() => auth.currentUser?.uid ?? undefined);

  useEffect(() => auth.onAuthStateChanged((u) => setAuthUid(u?.uid)), []);

  const isRoboLounge = isRoboPickupLoungeRecruit(selectedHundred);

  const canEnterGame = hundredRoomCanEnterGame(
    {
      status: roomStatus,
      problemsReady,
      gridRows: hasGrid ? [''] : [],
      problemsGenerating,
      roboPickupLounge: isRoboLounge,
    },
    roomId,
  );

  useEffect(() => {
    if (streamMode) return;
    if (!roomId) return;
    const unsub = onSnapshot(
      doc(db, 'hundred_rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setProblemsGenerating(false);
          setRoomStatus('recruiting');
          setProblemsReady(false);
          setHasGrid(false);
          setHostUid('');
          return;
        }
        const d = snap.data() as {
          problemsGenerating?: boolean;
          problemsReady?: boolean;
          hostUid?: string;
          status?: string;
          gridRows?: unknown;
        };
        setProblemsGenerating(d.problemsGenerating === true);
        setRoomStatus(typeof d.status === 'string' ? d.status : 'recruiting');
        setProblemsReady(d.problemsReady === true);
        setHasGrid(Array.isArray(d.gridRows) && d.gridRows.length > 0);
        setHostUid(typeof d.hostUid === 'string' ? d.hostUid : '');
      },
      (err) => {
        console.warn('[HundredBoardPanel] hundred_rooms snapshot error', err);
        setProblemsGenerating(false);
        setRoomStatus('recruiting');
        setProblemsReady(false);
        setHasGrid(false);
        setHostUid('');
      }
    );
    return () => unsub();
  }, [roomId, streamMode]);

  const handleCancelGeneration = useCallback(async () => {
    if (!roomId) return;
    await applyHostCancelledHundredGeneration({
      roomId,
      hundredPublicDocId: hundredPublicListingDocId(selectedHundred),
    });
    onGenerationCancelled?.();
  }, [roomId, selectedHundred, onGenerationCancelled]);

  const showCancelOverlay = problemsGenerating && !!authUid && !!hostUid && authUid === hostUid;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className={btnGhost}>
        もどる
      </button>

      <div className="relative bg-rk-white rounded-xl p-4 shadow-sm border border-rk-slate-200 space-y-3">
        <HundredProblemGeneratingOverlay
          visible={problemsGenerating}
          onCancel={showCancelOverlay ? () => void handleCancelGeneration() : undefined}
        />


        <div className="text-xs font-black text-rk-slate-400 uppercase tracking-widest">みんなであそぶ — 盤面・問題一覧</div>

        <div className="text-sm text-rk-slate-600">探すことば：{selectedHundred.targetWord || ''}</div>

        <div className="text-sm text-rk-slate-600">
          盤面サイズ：{formatBoardDimensions(selectedHundred)}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-black text-rk-slate-400 uppercase tracking-widest">問題一覧</div>
          {roomId ? <HundredProblemList roomId={roomId} /> : <p className="text-sm text-rk-slate-500">部屋IDがありません。</p>}
        </div>

        <button
          type="button"
          className={btnPrimary}
          disabled={!canEnterGame || problemsGenerating}
          onClick={() => {
            if (!canEnterGame) {
              window.alert(
                'まだ問題（盤面）ができていません。\n\n待機室でホストが「今すぐスタート！」を押すか、募集時間の終了を待ってください。',
              );
              return;
            }
            void onStartHundred(selectedHundred.roomId || '');
          }}
        >
          {problemsGenerating
            ? '問題を作成中…'
            : canEnterGame
              ? 'ゲームへ（みんなでプレイ）'
              : '開始待ち（盤面未作成）'}
        </button>
        {!canEnterGame && !problemsGenerating ? (
          <p className="text-[11px] font-medium text-rk-slate-500 leading-relaxed">
            募集だけが載っている状態です。盤面は<strong>待機室で開始</strong>したあとに作られます。
          </p>
        ) : null}

        {(() => {
          const cols = resolveBoardCols(selectedHundred);
          const rows = resolveBoardRows(selectedHundred);
          const cells = Array.from({ length: cols * rows });
          return (
            <div
              className="grid gap-0.5 max-h-[min(50vh,320px)] overflow-auto"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
              }}
            >
              {cells.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    background: 'var(--rk-slate-50)',
                    border: '1px solid var(--rk-slate-200)',
                  }}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default HundredBoardPanel;
