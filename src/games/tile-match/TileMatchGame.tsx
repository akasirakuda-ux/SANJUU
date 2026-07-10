import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  enterTileMatchFullViewport,
  leaveTileMatchFullViewport,
} from '../../lib/tabletPhoneCanvas';
import { Lightbulb, Undo2, XCircle } from 'lucide-react';
import {
  TILE_MATCH_DIFFICULTY_LABELS_JA,
  TILE_MATCH_EMOJI,
  TILE_MATCH_HINT_LIMIT,
  TILE_MATCH_LABEL_JA,
  TILE_MATCH_UNDO_LIMIT,
  type TileMatchDifficultyId,
} from '../../lib/tileMatch/config';
import { formatTileMatchElapsed } from '../../lib/tileMatch/formatElapsed';
import { TILE_MATCH_DIFFICULTY_TILE_COUNTS } from '../../lib/tileMatch/config';
import {
  createTileMatchBoard,
  findHintPair,
  hasRemovablePair,
  isBoardCleared,
  isSlotFree,
  reshuffleRemainingSymbols,
  tapSlot,
  undoLastMove,
  type TileMatchBoard,
} from '../../lib/tileMatch/engine';
import {
  computeTileMatchDisplayLayout,
  playingCardPixelSize,
  slotDisplayPx,
} from '../../lib/tileMatch/layouts';
import TileMatchTile, { type TileMatchTileVisualState } from './TileMatchTile';
import { RK19QuietRoomBackButton } from '../../ui/baselineParts';
import {
  btnGhostTouch,
  btnPrimaryTouch,
  immersiveHeader,
  immersiveKicker,
  immersiveScreenShell,
  immersiveSubtitle,
  immersiveTitle,
} from '../../ui/policy';
import { isStaleTileLayoutError, reloadOnceForStaleChunk } from '../../lib/lazyWithReload';
import { getSlidePuzzlePreferredArt } from '../../lib/slidePuzzleLogic';
import { vibrate } from '../../lib/utils';
import { audioService } from '../../services/audioService';
import { useTileMatchHundred } from '../../hooks/useTileMatchHundred';
import { closeHundredRecruitmentAsHostIfActive } from '../../lib/hundredRecruitCancel';
import { auth } from '../../firebase';

const BTN = btnPrimaryTouch;
const BTN_GHOST = btnGhostTouch;

const DIFFICULTY_BTN: Record<TileMatchDifficultyId, string> = {
  easy: 'bg-gradient-to-r from-rk-sky-400 to-rk-sky-600 text-rk-white border-2 border-rk-sky-300 shadow-md',
  normal: 'bg-gradient-to-r from-rk-violet-400 to-rk-violet-600 text-rk-white border-2 border-rk-violet-300 shadow-md',
  hard: 'bg-gradient-to-r from-rk-rose-500 to-rk-amber-600 text-rk-white border-2 border-rk-rose-300 shadow-md',
};

export interface TileMatchParticipant {
  uid?: string;
  name: string;
  emoji: string;
}

interface TileMatchGameProps {
  onBack: () => void;
  onRecordShussekiGamePlay: () => number;
  userEmoji?: string;
  nickname?: string;
  /** 共同プレイ時。未指定なら自分1人分を表示 */
  participants?: TileMatchParticipant[];
  /** みんなであそぶ（hundred_rooms）共同プレイ */
  hundredRoomId?: string | null;
  hundredRoomHostUid?: string | null;
  onHundredRoomFinished?: (reason: 'timeout' | 'cleared') => void | Promise<void>;
}

const TileMatchGame: React.FC<TileMatchGameProps> = ({
  onBack,
  onRecordShussekiGamePlay,
  userEmoji = '🐫',
  nickname = '',
  participants,
  hundredRoomId = null,
  hundredRoomHostUid = null,
  onHundredRoomFinished,
}) => {
  const isCoop = !!hundredRoomId;
  const isHundredHost =
    isCoop &&
    !!hundredRoomHostUid &&
    !!auth.currentUser?.uid &&
    auth.currentUser.uid === hundredRoomHostUid;
  const [phase, setPhase] = useState<'pick' | 'play'>(isCoop ? 'play' : 'pick');
  const [difficulty, setDifficulty] = useState<TileMatchDifficultyId>('normal');
  const [board, setBoard] = useState<TileMatchBoard | null>(null);
  const [hintHighlight, setHintHighlight] = useState<{ a: number; b: number } | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [showStuck, setShowStuck] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const didRecordRef = React.useRef(false);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [boardContainer, setBoardContainer] = useState({ w: 360, h: 480 });
  const [boardViewport, setBoardViewport] = useState({ w: 360, h: 420 });
  const [playStartedAt, setPlayStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [frozenElapsedMs, setFrozenElapsedMs] = useState<number | null>(null);
  const coop = useTileMatchHundred(hundredRoomId, {
    nickname: nickname || '',
    userEmoji: userEmoji || '🌸',
    hostUid: hundredRoomHostUid,
    onCleared: () => {
      const uid = auth.currentUser?.uid;
      if (uid && uid === hundredRoomHostUid) {
        void onHundredRoomFinished?.('cleared');
      }
    },
  });

  const boardParticipants = useMemo((): TileMatchParticipant[] => {
    if (isCoop && coop.roster.length > 0) return coop.roster;
    if (participants && participants.length > 0) {
      return participants.map((p) => ({
        uid: p.uid,
        name: p.name || 'ななし',
        emoji: (p.emoji || '🌸').trim() || '🌸',
      }));
    }
    return [
      {
        name: nickname || 'あなた',
        emoji: (userEmoji || '🐫').trim() || '🐫',
      },
    ];
  }, [isCoop, coop.roster, participants, nickname, userEmoji]);

  useEffect(() => {
    if (!isCoop || !coop.board) return;
    setBoard(coop.board);
    if (playStartedAt == null) {
      const now = Date.now();
      setPlayStartedAt(now);
      setElapsedMs(0);
    }
    if (isBoardCleared(coop.board)) {
      setShowStuck(false);
      setFrozenElapsedMs((prev) => prev ?? Date.now() - (playStartedAt ?? Date.now()));
      if (!didRecordRef.current) {
        didRecordRef.current = true;
        onRecordShussekiGamePlay();
      }
      setShowComplete(true);
    } else if (coop.checkStuck()) {
      setShowStuck(true);
    }
  }, [isCoop, coop.board, playStartedAt, coop, onRecordShussekiGamePlay]);

  const effectiveHintHighlight = isCoop ? coop.hintHighlight : hintHighlight;

  const displayedElapsedMs = frozenElapsedMs ?? elapsedMs;

  useLayoutEffect(() => {
    enterTileMatchFullViewport();
    const ro = () => enterTileMatchFullViewport();
    window.addEventListener('orientationchange', ro);
    window.addEventListener('resize', ro);
    return () => {
      window.removeEventListener('orientationchange', ro);
      window.removeEventListener('resize', ro);
      leaveTileMatchFullViewport();
    };
  }, []);

  useLayoutEffect(() => {
    if (phase !== 'play') return;
    enterTileMatchFullViewport();
    const container = boardContainerRef.current;
    const boardEl = boardAreaRef.current;
    if (!container) return;
    const apply = () => {
      enterTileMatchFullViewport();
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const cw = Math.max(container.clientWidth, vw);
      const ch = Math.max(container.clientHeight, Math.floor(vh * 0.62));
      setBoardContainer({ w: cw, h: ch });
      setBoardViewport({ w: cw, h: ch });
    };
    apply();
    requestAnimationFrame(apply);
    const ro = new ResizeObserver(apply);
    ro.observe(container);
    if (boardEl) ro.observe(boardEl);
    return () => ro.disconnect();
  }, [phase, board?.difficulty, board?.layoutId]);

  useEffect(() => {
    if (phase !== 'play' || !board || playStartedAt == null) return;
    const tick = () => setElapsedMs(Date.now() - playStartedAt);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, board, playStartedAt]);

  const remaining = useMemo(() => {
    if (!board) return 0;
    return board.tiles.filter((t) => !t.removed).length;
  }, [board]);

  const boardPx = useMemo(() => {
    if (!board) return null;
    const availW = boardViewport.w * 0.995;
    const availH = boardViewport.h * 0.995;
    return computeTileMatchDisplayLayout(
      board.slots,
      availW,
      availH,
      (slotId) => {
        const t = board.tiles[slotId];
        return !t || t.removed;
      }
    );
  }, [board, boardViewport, remaining]);

  /** スライドパズルで最後に選んだ絵（難易度選択・プレイ共通） */
  const slideBackgroundArt = useMemo(
    () => getSlidePuzzlePreferredArt(),
    [phase, board?.layoutId]
  );

  const slideBackgroundStyle = useMemo(
    () => ({
      backgroundImage: `url(${slideBackgroundArt.url})`,
      backgroundSize: 'cover' as const,
      backgroundPosition: 'center' as const,
      backgroundRepeat: 'no-repeat' as const,
    }),
    [slideBackgroundArt.url]
  );

  const startGame = useCallback((diff: TileMatchDifficultyId) => {
    try {
      setDifficulty(diff);
      setBoard(createTileMatchBoard(diff));
      setPhase('play');
      setHintHighlight(null);
      setShowComplete(false);
      setShowStuck(false);
      setMessage(null);
      setFrozenElapsedMs(null);
      const now = Date.now();
      setPlayStartedAt(now);
      setElapsedMs(0);
      didRecordRef.current = false;
      audioService.noteUserGesture();
    } catch (err) {
      if (isStaleTileLayoutError(err) && reloadOnceForStaleChunk()) {
        return;
      }
      throw err;
    }
  }, []);

  const leaveAndBack = useCallback(async () => {
    if (isHundredHost && hundredRoomId) {
      await closeHundredRecruitmentAsHostIfActive(hundredRoomId);
    }
    onBack();
  }, [isHundredHost, hundredRoomId, onBack]);

  const handleCancel = useCallback(() => {
    if (!window.confirm('ペア探しをやめますか？')) return;
    vibrate(10);
    void leaveAndBack();
  }, [leaveAndBack]);

  const checkStuck = useCallback((b: TileMatchBoard) => {
    if (isBoardCleared(b) || hasRemovablePair(b)) {
      setShowStuck(false);
      return;
    }
    setShowStuck(true);
    setMessage(null);
    vibrate(12);
  }, []);

  const handleContinueShuffle = useCallback(async () => {
    if (isCoop) {
      const ok = await coop.requestShuffle();
      if (ok) {
        setShowStuck(false);
        setMessage(null);
        vibrate(10);
        return;
      }
      setMessage('配置を変えられませんでした（ホストのみ）');
      vibrate(14);
      return;
    }
    if (!board) return;
    const mixed = reshuffleRemainingSymbols(board, Date.now());
    if (mixed) {
      setBoard(mixed);
      setShowStuck(false);
      setMessage(null);
      vibrate(10);
      return;
    }
    setMessage('配置を変えられませんでした。もう一度選んでください');
    vibrate(14);
  }, [board, isCoop, coop]);

  const handleStuckGiveUp = useCallback(() => {
    setShowStuck(false);
    vibrate(8);
    void leaveAndBack();
  }, [leaveAndBack]);

  const handleHint = useCallback(async () => {
    if (!board || showStuck) return;
    if (board.hintsUsed >= TILE_MATCH_HINT_LIMIT) {
      setMessage(`ヒントは${TILE_MATCH_HINT_LIMIT}回までです`);
      return;
    }
    if (isCoop) {
      const pair = await coop.requestHint();
      if (!pair) {
        if (coop.checkStuck()) checkStuck(board);
        else setMessage('ヒントを出せませんでした');
        return;
      }
      setMessage(null);
      vibrate(8);
      return;
    }
    const pair = findHintPair(board);
    if (!pair) {
      checkStuck(board);
      return;
    }
    setBoard({ ...board, hintsUsed: board.hintsUsed + 1 });
    setHintHighlight({ a: pair.slotA, b: pair.slotB });
    setMessage(null);
    window.setTimeout(() => setHintHighlight(null), 2200);
    vibrate(8);
  }, [board, showStuck, checkStuck, isCoop, coop]);

  const handleUndo = useCallback(() => {
    if (!board || showStuck) return;
    if (board.undosUsed >= TILE_MATCH_UNDO_LIMIT) {
      setMessage(`一手戻すは${TILE_MATCH_UNDO_LIMIT}回までです`);
      return;
    }
    const next = undoLastMove(board);
    if (!next) {
      setMessage('戻せる手がありません');
      return;
    }
    setBoard(next);
    setShowStuck(false);
    setMessage(null);
    vibrate(6);
  }, [board, showStuck]);

  const handleTap = useCallback(
    async (slotId: number) => {
      if (!board || showStuck) return;
      if (isCoop) {
        const res = coop.applyLocalTap(slotId);
        if (res.error === 'no_board') return;
        if (res.removed) {
          const submit = await coop.submitRemovePair(res.removed);
          if (!submit.ok) {
            setMessage(
              submit.reason === 'not_free' || submit.reason === 'mismatch'
                ? 'ほかの人が先に取りました'
                : '取れませんでした'
            );
            vibrate(12);
            return;
          }
          setMessage(null);
          vibrate(14);
          audioService.noteUserGesture();
          if (submit.cleared) {
            setFrozenElapsedMs((prev) => prev ?? Date.now() - (playStartedAt ?? Date.now()));
            if (!didRecordRef.current) {
              didRecordRef.current = true;
              onRecordShussekiGamePlay();
            }
            setShowComplete(true);
            audioService.playSlidePuzzleCompleteSound();
          }
          return;
        }
        if (res.error === 'mismatch') {
          setMessage('ちがう記号です');
          vibrate(12);
        } else if (res.error === 'not_free') {
          setMessage('まだ取れません');
          vibrate(8);
        }
        return;
      }
      const res = tapSlot(board, slotId);
      if (res.removed) {
        const nextBoard = res.board;
        setBoard(nextBoard);
        setMessage(null);
        vibrate(14);
        audioService.noteUserGesture();
        if (isBoardCleared(nextBoard)) {
          setShowStuck(false);
          setFrozenElapsedMs((prev) => prev ?? Date.now() - (playStartedAt ?? Date.now()));
          if (!didRecordRef.current) {
            didRecordRef.current = true;
            onRecordShussekiGamePlay();
          }
          setShowComplete(true);
          audioService.playSlidePuzzleCompleteSound();
        } else {
          checkStuck(nextBoard);
        }
        return;
      }
      setBoard(res.board);
      if (res.error === 'mismatch') {
        setMessage('ちがう記号です');
        vibrate(12);
        return;
      }
      if (res.error === 'not_free') {
        setMessage('まだ取れません');
        vibrate(8);
        return;
      }
    },
    [
      board,
      showStuck,
      playStartedAt,
      onRecordShussekiGamePlay,
      checkStuck,
      isCoop,
      coop,
    ]
  );

  if (isCoop && coop.loading && !board) {
    return (
      <div className={`${immersiveScreenShell} rk-tile-match-play items-center justify-center`}>
        <p className="text-lg font-black text-rk-slate-700">みんなの山を読み込み中…</p>
      </div>
    );
  }

  if (phase === 'pick' && !isCoop) {
    return (
      <div className="rk-tile-match-pick fixed inset-0 z-[45] flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={slideBackgroundStyle}
          aria-hidden
        />
        <div className="relative z-10 flex flex-1 flex-col min-h-0 w-full max-w-lg mx-auto px-3 py-3 sm:py-4">
          <div className="shrink-0">
            <RK19QuietRoomBackButton onClick={onBack} />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-4 min-h-0 py-2">
            <header className="rounded-2xl border-2 border-rk-white bg-rk-white/95 px-4 py-4 shadow-md text-center">
              <p className={`${immersiveKicker} text-rk-sky-700`}>らくだ珈琲</p>
              <h1 className={`${immersiveTitle} text-rk-violet-900 mt-0.5`}>
                {TILE_MATCH_EMOJI} {TILE_MATCH_LABEL_JA}
              </h1>
              <p className="mt-2 text-sm font-bold text-rk-slate-700 leading-snug">
                同じ記号のペアを探して、白いトランプの山をなくそう
              </p>
              <p className="mt-1 text-xs font-bold text-rk-slate-600 leading-snug">
                山の形は10種類からランダム・背景はスライドパズルの絵
              </p>
            </header>
            <div className="flex flex-col gap-2.5">
              {(Object.keys(TILE_MATCH_DIFFICULTY_TILE_COUNTS) as TileMatchDifficultyId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`${DIFFICULTY_BTN[id]} rounded-xl px-4 py-3.5 font-black text-sm shadow-md active:scale-[0.98]`}
                  onClick={() => {
                    vibrate(10);
                    startGame(id);
                  }}
                >
                  {TILE_MATCH_DIFFICULTY_LABELS_JA[id]}（{TILE_MATCH_DIFFICULTY_TILE_COUNTS[id]}枚）
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!board) return null;

  return (
    <div
      className={`${immersiveScreenShell} rk-tile-match-play !items-stretch !justify-stretch !px-0 bg-gradient-to-b from-rk-amber-50 via-rk-sky-50 to-rk-cyan-50`}
    >
      <div className="w-full max-w-none h-full min-h-0 flex flex-1 flex-col py-2 gap-2">
        <div className="shrink-0 space-y-1.5 px-2">
          <div className="flex items-stretch gap-2 rounded-xl bg-gradient-to-r from-rk-amber-200 via-rk-sky-200 to-rk-cyan-200 px-2 py-2 shadow-sm border-2 border-rk-white">
            <RK19QuietRoomBackButton onClick={handleCancel} title="中止" />
            <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
              <span className="text-sm sm:text-base font-black text-rk-slate-800 tabular-nums whitespace-nowrap">
                経過 {formatTileMatchElapsed(displayedElapsedMs)}
              </span>
              <div className="w-px h-6 bg-rk-slate-400/35 shrink-0" aria-hidden />
              <span className="text-sm sm:text-base font-black text-rk-slate-800 tabular-nums whitespace-nowrap">
                残り {remaining}枚
              </span>
            </div>
          </div>
          <div
            className="flex items-center justify-center gap-1.5 flex-wrap px-2 py-1 rounded-xl bg-rk-white border-2 border-rk-amber-200/80 shadow-sm"
            aria-label="参加者"
          >
            {boardParticipants.slice(0, 12).map((p, idx) => (
              <span
                key={p.uid ?? `${p.name}-${idx}`}
                title={p.name}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-rk-sky-300 bg-gradient-to-b from-rk-amber-50 to-rk-sky-50 text-lg shadow-sm"
              >
                {p.emoji}
              </span>
            ))}
            {boardParticipants.length > 12 ? (
              <span className="text-[10px] font-bold text-rk-violet-800 tabular-nums">
                +{boardParticipants.length - 12}
              </span>
            ) : null}
          </div>
        </div>

        <div
          ref={boardContainerRef}
          className="flex-1 min-h-0 relative w-full max-w-none px-0"
        >
          <div
            ref={boardAreaRef}
            className="absolute inset-0 overflow-hidden rounded-xl border-2 border-rk-amber-200/80 shadow-md"
            aria-label="カードの山"
          >
            <div
              className="absolute inset-0 z-0 pointer-events-none"
              style={slideBackgroundStyle}
              aria-hidden
            />
          {boardPx ? (
            <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden p-1">
              <div
                className="relative shrink-0 rk-tile-match-mountain"
                style={{
                  width: Math.ceil(boardPx.contentW),
                  height: Math.ceil(boardPx.contentH),
                  transform: `scale(${boardPx.scale})`,
                  transformOrigin: 'center center',
                }}
              >
              {board.slots.map((slot) => {
                const tile = board.tiles[slot.id];
                if (!tile || tile.removed) return null;
                const free = isSlotFree(slot.id, board.slots, board.tiles);
                const selected = board.selectedSlotId === slot.id;
                const hinted =
                  effectiveHintHighlight &&
                  (effectiveHintHighlight.a === slot.id || effectiveHintHighlight.b === slot.id);
                const pos = slotDisplayPx(slot, boardPx.cell, boardPx.pad);
                const { w: tileW, h: tileH } = playingCardPixelSize(boardPx.cell);
                const left = pos.left - boardPx.contentMinLeft;
                const top = pos.top - boardPx.contentMinTop;
                const z = 10 + slot.layer * 8 + (free ? 30 : 0) + (selected || hinted ? 100 : 0);
                let visual: TileMatchTileVisualState = free ? 'free' : 'blocked';
                if (selected) visual = 'selected';
                if (hinted) visual = 'hinted';
                return (
                  <TileMatchTile
                    key={slot.id}
                    symbol={tile.symbol}
                    width={tileW}
                    height={tileH}
                    left={left}
                    top={top}
                    zIndex={z}
                    state={visual}
                    disabled={showStuck || (!free && !selected)}
                    ariaLabel={`${tile.symbol}${free ? '' : '（取れません）'}`}
                    onClick={() => handleTap(slot.id)}
                  />
                );
              })}
              </div>
            </div>
          ) : null}
          </div>
        </div>

        {message ? (
          <p
            className="text-center text-xs font-bold text-rk-violet-900 shrink-0 rounded-lg bg-rk-amber-100/90 border border-rk-amber-300 px-2 py-1"
            role="status"
          >
            {message}
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2 shrink-0 pb-1 px-2">
          <button
            type="button"
            className={`${BTN_GHOST} !bg-rk-sky-100 !border-rk-sky-400 !text-rk-sky-900`}
            onClick={handleHint}
            disabled={showStuck}
          >
            <Lightbulb className="w-4 h-4 inline mr-1" />
            ヒント ({TILE_MATCH_HINT_LIMIT - board.hintsUsed})
          </button>
          <button
            type="button"
            className={`${BTN_GHOST} !bg-rk-violet-100 !border-rk-violet-400 !text-rk-violet-900`}
            onClick={handleUndo}
            disabled={showStuck || isCoop}
          >
            <Undo2 className="w-4 h-4 inline mr-1" />
            戻す ({TILE_MATCH_UNDO_LIMIT - board.undosUsed})
          </button>
          <button
            type="button"
            className={`${BTN_GHOST} !bg-rk-white !border-rk-amber-300 !text-rk-slate-800`}
            onClick={handleCancel}
          >
            <XCircle className="w-4 h-4 inline mr-1" />
            中止
          </button>
        </div>
      </div>

      {showStuck ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-rk-slate-900/60 p-4">
          <div className="bg-gradient-to-b from-rk-rose-50 via-rk-white to-rk-amber-50 rounded-2xl p-6 max-w-sm w-full shadow-xl border-4 border-rk-rose-400 text-center space-y-4">
            <p className="text-xl font-black text-rk-rose-800">おしまい</p>
            <p className="text-sm font-bold text-rk-slate-700">
              取れるペアがなくなりました。
              <br />
              この局はまけです。
            </p>
            <p className="text-base font-black text-rk-violet-900">残りの配置を変えて続けますか？</p>
            <div className="flex flex-col gap-2">
              <button type="button" className={BTN} onClick={handleContinueShuffle}>
                はい、続ける
              </button>
              <button
                type="button"
                className={`${BTN_GHOST} !border-rk-slate-400`}
                onClick={handleStuckGiveUp}
              >
                いいえ、やめる
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showComplete ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-rk-slate-900/50 p-4">
          <div className="bg-gradient-to-b from-rk-success-50 via-rk-white to-rk-sky-50 rounded-2xl p-6 max-w-sm w-full shadow-xl border-4 border-rk-success-400 text-center space-y-4">
            <p className="text-xl font-black text-rk-success-800">クリア！</p>
            <p className="text-sm font-bold text-rk-emerald-800">
              {isCoop ? 'みんなで山をなくしました！' : 'ぜんぶのペアを取りました（かち）'}
              <br />
              <span className="text-rk-slate-600 tabular-nums">
                経過 {formatTileMatchElapsed(displayedElapsedMs)}
              </span>
            </p>
            <button
              type="button"
              className={BTN}
              onClick={() => {
                vibrate(10);
                onBack();
              }}
            >
              らくだ珈琲にもどる
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TileMatchGame;
