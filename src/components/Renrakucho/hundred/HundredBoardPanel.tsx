import React, { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { applyHostCancelledHundredGeneration } from '../../../lib/hundredRecruitCancel';
import { btnGhost, btnPrimary } from '../../../ui/policy';
import type { HundredPublicRecruit } from '../types';
import { auth, db } from '../../../firebase';
import HundredProblemList from './HundredProblemList';
import HundredProblemGeneratingOverlay from './HundredProblemGeneratingOverlay';

const HundredBoardPanel: React.FC<{
  selectedHundred: HundredPublicRecruit;
  /** 配信/低負荷モード（YouTube Live 安定化用） */
  streamMode?: boolean;
  onBack: () => void;
  onStartHundred: (roomId: string) => void;
  onGenerationCancelled?: () => void;
}> = ({ selectedHundred, streamMode = false, onBack, onStartHundred, onGenerationCancelled }) => {
  const roomId = selectedHundred.roomId || '';
  const [problemsGenerating, setProblemsGenerating] = useState(false);
  const [hostUid, setHostUid] = useState('');
  const [authUid, setAuthUid] = useState<string | undefined>(() => auth.currentUser?.uid ?? undefined);

  useEffect(() => auth.onAuthStateChanged((u) => setAuthUid(u?.uid)), []);

  useEffect(() => {
    if (streamMode) return;
    if (!roomId) return;
    const unsub = onSnapshot(
      doc(db, 'hundred_rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setProblemsGenerating(false);
          setHostUid('');
          return;
        }
        const d = snap.data() as { problemsGenerating?: boolean; hostUid?: string };
        setProblemsGenerating(d.problemsGenerating === true);
        setHostUid(typeof d.hostUid === 'string' ? d.hostUid : '');
      },
      (err) => {
        console.warn('[HundredBoardPanel] hundred_rooms snapshot error', err);
        setProblemsGenerating(false);
        setHostUid('');
      }
    );
    return () => unsub();
  }, [roomId, streamMode]);

  const handleCancelGeneration = useCallback(async () => {
    if (!roomId) return;
    await applyHostCancelledHundredGeneration({ roomId, hundredPublicDocId: selectedHundred.id });
    onGenerationCancelled?.();
  }, [roomId, selectedHundred.id, onGenerationCancelled]);

  const showCancelOverlay = problemsGenerating && !!authUid && !!hostUid && authUid === hostUid;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className={btnGhost}>
        もどる
      </button>

      <div className="relative bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
        <HundredProblemGeneratingOverlay
          visible={problemsGenerating}
          onCancel={showCancelOverlay ? () => void handleCancelGeneration() : undefined}
        />


        <div className="text-xs font-black text-slate-400 uppercase tracking-widest">みんなであそぶ — 盤面・問題一覧</div>

        <div className="text-sm text-slate-600">探すことば：{selectedHundred.targetWord || ''}</div>

        <div className="text-sm text-slate-600">
          盤面サイズ：{selectedHundred.boardSize || ''}×{selectedHundred.boardSize || ''}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">問題一覧</div>
          {roomId ? <HundredProblemList roomId={roomId} /> : <p className="text-sm text-slate-500">部屋IDがありません。</p>}
        </div>

        <button type="button" className={btnPrimary} onClick={() => onStartHundred(selectedHundred.roomId || '')}>
          ゲームへ（UIのみ）
        </button>

        {(() => {
          const size = selectedHundred.boardSize || 0;
          const cells = Array.from({ length: size * size });
          return (
            <div
              className="grid gap-0.5 max-h-[min(50vh,320px)] overflow-auto"
              style={{
                gridTemplateColumns: `repeat(${size}, 1fr)`,
              }}
            >
              {cells.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
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
