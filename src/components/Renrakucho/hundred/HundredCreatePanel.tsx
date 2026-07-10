import React, { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../../firebase';
import { getRakudaDisplayNameValidationError } from '../../../lib/rakudaDisplayNamePolicy';
import {
  HUNDRED_PICKUP_TARGET_WORD_MAX_LEN,
  pickAutoTargetWordForBoard,
  pickupTargetWordCharCount,
  type HundredAutoWordLength,
} from '../../../lib/hundredAutoTargetWord';
import {
  charsetValidationError,
  isPickupTargetWordCharsetOk,
  isPickupTargetWordLengthOk,
  isManualPickupTargetWordAllowed,
  manualInputHint,
  manualPickupTargetWordError,
  manualInputPlaceholder,
  normalizePickupTargetWord,
  pickAutoTargetWordForPickupCharset,
  pickupLengthBounds,
  PICKUP_CHARSET_OPTIONS,
  pickupCharsetDescription,
  type PickupCharset,
} from '../../../lib/hundredPickupCharset';
import {
  isPickupBoardComboFeasible,
  pickupBoardFeasibilityErrorMessage,
  pickupFeasibleWordLengthsForBoard,
} from '../../../lib/hundredPickupFeasibility';
import { btnPrimary } from '../../../ui/policy';
import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME } from '../../../lib/reversiConfig';
import { targetWordFitsBoard } from '../../../lib/boardDimensions';
import { HUNDRED_OPEN_RECRUIT_DEADLINE_MS } from '../../../lib/firestoreTime';
import type { HundredPublicRecruit } from '../types';
import {
  TILE_MATCH_DIFFICULTY_LABELS_JA,
  TILE_MATCH_DIFFICULTY_TILE_COUNTS,
  TILE_MATCH_HUNDRED_MODE,
  TILE_MATCH_EMOJI,
  TILE_MATCH_LABEL_JA,
  type TileMatchDifficultyId,
} from '../../../lib/tileMatch/config';
import {
  fetchHostActiveHundredResumeRecruit,
  fetchHostHasActiveHundredRecruit,
  HOST_HUNDRED_RECRUIT_LIMIT_MESSAGE,
} from '../../../lib/hundredHostRecruitLimit';

type BoardPreset = {
  id: string;
  cols: number;
  rows: number;
  label: string;
};

const BOARD_PRESETS: BoardPreset[] = [
  { id: '5', cols: 5, rows: 5, label: '5×5' },
  { id: '10', cols: 10, rows: 10, label: '10×10' },
  { id: '10x15', cols: 10, rows: 15, label: '10×15' },
  { id: '15', cols: 15, rows: 15, label: '15×15' },
  { id: '15x20', cols: 15, rows: 20, label: '15×20' },
];

const RK_LAST_AUTO_WORD_KEY = 'rk_hundred_last_auto_word';

type WordMode = 'manual' | 'auto';

function readLastAutoWord(charset: PickupCharset): string {
  try {
    return localStorage.getItem(`${RK_LAST_AUTO_WORD_KEY}_${charset}`) || '';
  } catch {
    return '';
  }
}

function writeLastAutoWord(charset: PickupCharset, word: string): void {
  try {
    localStorage.setItem(`${RK_LAST_AUTO_WORD_KEY}_${charset}`, word);
  } catch {
    /* ignore */
  }
}

export type HundredCreatePanelVariant = 'pickup' | 'tile_match';

const HundredCreatePanel: React.FC<{
  variant: HundredCreatePanelVariant;
  nickname: string;
  userEmoji: string;
  currentUid: string | undefined;
  isBoardInteractionBlocked: boolean;
  ensureAuth: () => Promise<void>;
  /** 掲示板 `/keijiban` では装飾枠を出さない */
  plainChrome?: boolean;
  /** 作成後、ホストを待機ロビーへ */
  onCreatedRecruit: (recruit: HundredPublicRecruit) => void;
}> = ({
  variant,
  nickname,
  userEmoji,
  currentUid,
  isBoardInteractionBlocked,
  ensureAuth,
  onCreatedRecruit,
  plainChrome = false,
}) => {
  if (variant === 'tile_match') return null;

  const [targetWord, setTargetWord] = useState('');
  const [pickupCharset, setPickupCharset] = useState<PickupCharset>('hiragana');
  const [wordMode, setWordMode] = useState<WordMode>('manual');
  const [autoWordLength, setAutoWordLength] = useState<HundredAutoWordLength>(3);
  const [boardPresetId, setBoardPresetId] = useState<string>('10');
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [listOnBoard, setListOnBoard] = useState(true);
  const [tileMatchDifficulty, setTileMatchDifficulty] = useState<TileMatchDifficultyId>('normal');
  const [busy, setBusy] = useState(false);
  const [hostRecruitBlocked, setHostRecruitBlocked] = useState(false);
  const [hostResumeRecruit, setHostResumeRecruit] = useState<HundredPublicRecruit | null>(null);
  const isTileMatchRecruit = variant === 'tile_match';
  /**
   * ひと言探し: 一覧は「あそび開始後」だけ載せる → 作成時点では hundred_public を作らない。
   * ペア探し: 従来どおり作成時に載せられる。
   */
  const effectiveListOnBoard = isTileMatchRecruit ? (plainChrome ? true : listOnBoard) : false;
  const framed = !plainChrome;

  const selectedPreset =
    BOARD_PRESETS.find((p) => p.id === boardPresetId) ?? BOARD_PRESETS[1];

  const { cols: presetCols, rows: presetRows } = selectedPreset;

  const validAutoLengths = isTileMatchRecruit
    ? []
    : pickupFeasibleWordLengthsForBoard(presetCols, presetRows, pickupCharset);

  const effectiveAutoLength: number =
    validAutoLengths.includes(autoWordLength)
      ? autoWordLength
      : validAutoLengths[0] ?? (pickupCharset === 'digit' ? 3 : 3);

  const manualMaxLen =
    pickupCharset === 'digit' ? 6 : pickupCharset === 'latin' ? 8 : HUNDRED_PICKUP_TARGET_WORD_MAX_LEN;

  const targetWordNeedsCharsetFix =
    !isTileMatchRecruit &&
    wordMode === 'manual' &&
    !!(targetWord || '').trim() &&
    !isPickupTargetWordCharsetOk(targetWord, pickupCharset);

  useEffect(() => {
    if (!currentUid) {
      setHostRecruitBlocked(false);
      setHostResumeRecruit(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [resume, blocked] = await Promise.all([
          fetchHostActiveHundredResumeRecruit(db, currentUid),
          effectiveListOnBoard
            ? fetchHostHasActiveHundredRecruit(db, currentUid)
            : Promise.resolve(false),
        ]);
        if (cancelled) return;
        setHostResumeRecruit(resume);
        setHostRecruitBlocked(blocked);
      } catch {
        if (!cancelled) {
          setHostRecruitBlocked(false);
          setHostResumeRecruit(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUid, effectiveListOnBoard]);

  const canResumeExistingWait = !!hostResumeRecruit;
  const createDisabled =
    busy || isBoardInteractionBlocked || (hostRecruitBlocked && !canResumeExistingWait);

  const handleSubmit = useCallback(async () => {
    if (isBoardInteractionBlocked) {
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', { detail: '現在、この操作はできません。' })
      );
      return;
    }
    const nick = (nickname || '').trim();
    if (!nick) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ニックネームを先に決めてください' }));
      return;
    }
    const displayNameError = getRakudaDisplayNameValidationError(nick, userEmoji, auth.currentUser);
    if (displayNameError) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: displayNameError }));
      return;
    }

    const twManual = (targetWord || '').trim();
    let tw = twManual;

    const { cols, rows } = isTileMatchRecruit
      ? { cols: 10, rows: 10 }
      : selectedPreset;

    if (isTileMatchRecruit) {
      tw = TILE_MATCH_LABEL_JA;
    } else if (wordMode === 'auto') {
      if (validAutoLengths.length === 0) {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', {
            detail: `この盤面（${cols}×${rows}）で${RAKUDA_ROBO_NAME}が選べることばがありません`,
          }),
        );
        return;
      }
      const excludeBase = readLastAutoWord(pickupCharset) ? [readLastAutoWord(pickupCharset)] : [];
      const tried: string[] = [];
      let picked: string | null = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate =
          pickupCharset === 'hiragana'
            ? pickAutoTargetWordForBoard(cols, rows, effectiveAutoLength as HundredAutoWordLength, {
                exclude: [...excludeBase, ...tried],
              })
            : pickAutoTargetWordForPickupCharset(pickupCharset, cols, rows, effectiveAutoLength, {
                exclude: [...excludeBase, ...tried],
              });
        if (!candidate) break;
        if (isPickupBoardComboFeasible(cols, rows, candidate, pickupCharset, 8)) {
          picked = candidate;
          break;
        }
        tried.push(candidate);
      }
      if (!picked) {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', {
            detail: `${effectiveAutoLength}文字の${RAKUDA_ROBO_NAME}ことばが見つかりませんでした`,
          }),
        );
        return;
      }
      tw = picked;
      writeLastAutoWord(pickupCharset, picked);
    } else if (!tw) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '「探すことば」を入力してください' }));
      return;
    } else {
      tw = normalizePickupTargetWord(twManual, pickupCharset);
    }

    if (!isTileMatchRecruit && wordMode === 'manual' && !isPickupTargetWordCharsetOk(tw, pickupCharset)) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: charsetValidationError(pickupCharset) }));
      return;
    }

    if (!isTileMatchRecruit && !isPickupTargetWordLengthOk(tw, pickupCharset)) {
      const { min, max } = pickupLengthBounds(pickupCharset);
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', {
          detail: `探すことばは${min}〜${max}${pickupCharset === 'digit' ? '桁' : '文字'}にしてください`,
        }),
      );
      return;
    }

    if (!isTileMatchRecruit && !targetWordFitsBoard(tw, cols, rows)) {
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', {
          detail: `ことばの長さが盤面（${cols}×${rows}）より長いです`,
        })
      );
      return;
    }

    if (!isTileMatchRecruit && !isPickupBoardComboFeasible(cols, rows, tw, pickupCharset, 12)) {
      window.alert(pickupBoardFeasibilityErrorMessage(cols, rows, tw, pickupCharset));
      return;
    }

    if (!isTileMatchRecruit && wordMode === 'manual' && !isManualPickupTargetWordAllowed(tw, pickupCharset)) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: manualPickupTargetWordError(pickupCharset, tw) }));
      return;
    }

    setBusy(true);
    try {
      await ensureAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ログインに失敗しました。通信を確認してください' }));
        return;
      }

      const resume = await fetchHostActiveHundredResumeRecruit(db, uid);
      if (resume) {
        setHostResumeRecruit(resume);
      }

      // 「いまの待機室へ続ける」を押したときだけ再開。新規作成を古控室で上書きしない。
      if (hostRecruitBlocked && resume) {
        onCreatedRecruit(resume);
        return;
      }

      if (effectiveListOnBoard) {
        const blocked = await fetchHostHasActiveHundredRecruit(db, uid);
        if (blocked) {
          setHostRecruitBlocked(true);
          setHostResumeRecruit(resume);
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', { detail: HOST_HUNDRED_RECRUIT_LIMIT_MESSAGE })
          );
          return;
        }
      }
      // pickup（開始後に一覧）は古控室があっても新規作成OK。再開は画面上の「続ける」だけ。

      const roomId = crypto.randomUUID();
      const recruitDeadlineAt = Timestamp.fromMillis(HUNDRED_OPEN_RECRUIT_DEADLINE_MS);
      const hostNickname = nick;
      const emoji = (userEmoji || '').trim() || '🐫';

      const batch = writeBatch(db);
      const roomRef = doc(db, 'hundred_rooms', roomId);

      const boardFields = {
        boardSize: cols,
        boardCols: cols,
        boardRows: rows,
      };
      const modeFields = isTileMatchRecruit
        ? {
            hundredMode: TILE_MATCH_HUNDRED_MODE,
            tileMatchDifficulty,
          }
        : { hundredMode: 'pickup' as const, hintsEnabled, pickupCharset };

      let publicId: string;
      if (effectiveListOnBoard) {
        const publicRef = doc(collection(db, 'hundred_public'));
        publicId = publicRef.id;
        batch.set(publicRef, {
          type: 'hundred',
          roomId,
          targetWord: tw,
          ...boardFields,
          ...modeFields,
          hostUid: uid,
          hostNickname,
          hostEmoji: emoji,
          createdAt: serverTimestamp(),
          recruitDeadlineAt,
          gameTimeLimitSec: 0,
        });
        batch.set(roomRef, {
          status: 'recruiting',
          createdAt: serverTimestamp(),
          startedAt: null,
          hostUid: uid,
          targetWord: tw,
          ...boardFields,
          ...modeFields,
          gameTimeLimitSec: 0,
          recruitDeadlineAt,
          hostNickname,
          hostEmoji: emoji,
          publicRecruitId: publicId,
        });
      } else {
        publicId = `local-${roomId}`;
        batch.set(roomRef, {
          status: 'recruiting',
          createdAt: serverTimestamp(),
          startedAt: null,
          hostUid: uid,
          targetWord: tw,
          ...boardFields,
          ...modeFields,
          gameTimeLimitSec: 0,
          recruitDeadlineAt,
          hostNickname,
          hostEmoji: emoji,
        });
      }

      await batch.commit();

      const recruit: HundredPublicRecruit = {
        id: publicId,
        type: 'hundred',
        roomId,
        targetWord: tw,
        boardSize: cols,
        boardCols: cols,
        boardRows: rows,
        ...modeFields,
        hostUid: uid,
        hostNickname,
        hostEmoji: emoji,
        recruitDeadlineAt,
        createdAt: Timestamp.now(),
        gameTimeLimitSec: 0,
        hintsEnabled: isTileMatchRecruit ? undefined : hintsEnabled,
      };
      onCreatedRecruit(recruit);
      if (wordMode === 'auto') {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: `探すことば（${RAKUDA_ROBO_NAME}）: ${tw}` }),
        );
      }
      setTargetWord('');
    } catch (e) {
      console.error('[HundredCreatePanel] create failed', e);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '募集の作成に失敗しました' }));
    } finally {
      setBusy(false);
    }
  }, [
    isBoardInteractionBlocked,
    nickname,
    targetWord,
    wordMode,
    effectiveAutoLength,
    validAutoLengths.length,
    selectedPreset,
    isTileMatchRecruit,
    tileMatchDifficulty,
    effectiveListOnBoard,
    hintsEnabled,
    userEmoji,
    ensureAuth,
    onCreatedRecruit,
    hostRecruitBlocked,
    pickupCharset,
  ]);

  const panelChrome = isTileMatchRecruit
    ? 'rounded-xl border-[3px] border-rk-teal-600 bg-gradient-to-b from-rk-teal-100/90 to-rk-cyan-50/95 px-4 py-[32px] shadow-md'
    : 'rounded-xl border-[3px] border-rk-amber-500 bg-gradient-to-b from-rk-amber-100/90 to-rk-amber-50/95 px-4 py-[32px] shadow-md';
  const titleClass = isTileMatchRecruit ? 'text-rk-teal-950' : 'text-rk-amber-950';
  const panelTitle = isTileMatchRecruit
    ? `${TILE_MATCH_EMOJI} ${TILE_MATCH_LABEL_JA}の問題を作る`
    : 'ひと言探しの問題を作る';
  const listLabel = isTileMatchRecruit
    ? 'ペア探しの募集一覧に載せる（だれでも「参加」から入れます）'
    : '「はじめる」のあと、すぐに遊べます。途中参加したい人には、開始後に一覧へ載ります。';

  return (
    <div className={plainChrome ? 'px-0 py-0' : panelChrome}>
      <div className={`${framed ? 'text-[19px]' : 'text-base'} font-black tracking-widest ${titleClass}`}>
        {panelTitle}
      </div>

      <div className={framed ? 'mt-[32px] space-y-[27px]' : 'mt-[27px] space-y-[22.5px]'}>
        {isTileMatchRecruit ? (
          <div>
            <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>難易度</span>
            <div className={`${framed ? 'mt-[11px] gap-3' : 'mt-[9px] gap-2'} flex flex-wrap`}>
              {(Object.keys(TILE_MATCH_DIFFICULTY_TILE_COUNTS) as TileMatchDifficultyId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy || isBoardInteractionBlocked}
                  onClick={() => setTileMatchDifficulty(id)}
                  className={`rounded-lg px-3 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                    tileMatchDifficulty === id
                      ? 'bg-rk-hundred-recruit text-rk-white'
                      : 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                  }`}
                >
                  {TILE_MATCH_DIFFICULTY_LABELS_JA[id]}（{TILE_MATCH_DIFFICULTY_TILE_COUNTS[id]}枚）
                </button>
              ))}
            </div>
            <p className={`${framed ? 'mt-2 text-[13px]' : 'mt-1.5 text-xs'} font-bold leading-snug text-rk-slate-600`}>
              同じ記号のペアをみんなで探して、山をなくします
            </p>
          </div>
        ) : null}

        {!isTileMatchRecruit ? (
        <>
        <div>
          <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>文字の種類</span>
          <div className={`${framed ? 'mt-[11px] gap-3' : 'mt-[9px] gap-2'} flex flex-wrap`}>
            {PICKUP_CHARSET_OPTIONS.map(({ id, label, hint }) => (
              <button
                key={id}
                type="button"
                disabled={busy || isBoardInteractionBlocked}
                onClick={() => {
                  setPickupCharset(id);
                  setTargetWord('');
                }}
                className={`rounded-lg px-3 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                  pickupCharset === id
                    ? 'bg-rk-hundred-recruit text-rk-white'
                    : 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                }`}
                title={hint}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={`${framed ? 'mt-2 text-[13px]' : 'mt-1.5 text-xs'} font-bold leading-snug text-rk-slate-600`}>
            {pickupCharsetDescription(pickupCharset)}
          </p>
        </div>

        <div>
          <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>ことばの決め方</span>
          <div className={`${framed ? 'mt-[11px] gap-3' : 'mt-[9px] gap-2'} flex flex-wrap`}>
            {(
              [
                { id: 'manual' as const, label: '自分で決める' },
                { id: 'auto' as const, label: `${RAKUDA_ROBO_EMOJI} ${RAKUDA_ROBO_NAME}におまかせ` },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                disabled={busy || isBoardInteractionBlocked}
                onClick={() => setWordMode(id)}
                className={`rounded-lg px-3 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                  wordMode === id
                    ? 'bg-rk-hundred-recruit text-rk-white'
                    : 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {wordMode === 'auto' ? (
            <p className={`${framed ? 'mt-2 text-[13px]' : 'mt-1.5 text-xs'} font-bold leading-snug text-rk-slate-600`}>
              {pickupCharset === 'latin'
                ? `文字数を選ぶと、${RAKUDA_ROBO_NAME}が英語リストから選び、待機室で盤面を作ります`
                : pickupCharset === 'digit'
                  ? `桁数を選ぶと、${RAKUDA_ROBO_NAME}が数字を選び、待機室で盤面を作ります`
                  : `文字数を選ぶと、${RAKUDA_ROBO_NAME}が辞書から名詞を選び、待機室で盤面を作ります`}
            </p>
          ) : null}
        </div>

        {wordMode === 'manual' ? (
          <label className="block">
            <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>探すことば</span>
            <input
              type="text"
              value={targetWord}
              onChange={(e) => {
                const next = e.target.value;
                if (pickupTargetWordCharCount(next) <= manualMaxLen) {
                  setTargetWord(next);
                }
              }}
              disabled={busy || isBoardInteractionBlocked}
              className={`${framed ? 'mt-[11px] text-[19px] py-3' : 'mt-[9px] text-base py-2.5'} w-full rounded-lg border border-rk-slate-200 bg-rk-white px-3 font-bold text-rk-slate-900${pickupCharset === 'latin' ? ' uppercase' : ''}`}
              placeholder={manualInputPlaceholder(pickupCharset)}
              autoComplete="off"
              inputMode={pickupCharset === 'digit' ? 'numeric' : 'text'}
            />
            <p className={`${framed ? 'mt-2 text-[13px]' : 'mt-1.5 text-xs'} font-bold leading-snug text-rk-slate-600`}>
              {manualInputHint(pickupCharset)}
            </p>
            {targetWordNeedsCharsetFix ? (
              <p className={`${framed ? 'mt-1 text-[13px]' : 'mt-1 text-xs'} font-bold text-rk-red-700`}>
                {charsetValidationError(pickupCharset)}
              </p>
            ) : null}
          </label>
        ) : (
          <div>
            <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>
              探すことばの{pickupCharset === 'digit' ? '桁数' : '文字数'}
            </span>
            <div className={`${framed ? 'mt-[11px] gap-3' : 'mt-[9px] gap-2'} flex flex-wrap`}>
              {validAutoLengths.map((len) => (
                <button
                  key={len}
                  type="button"
                  disabled={busy || isBoardInteractionBlocked}
                  onClick={() => setAutoWordLength(len as HundredAutoWordLength)}
                  className={`min-w-[2.75rem] rounded-lg px-2.5 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                    effectiveAutoLength === len
                      ? 'bg-rk-hundred-recruit text-rk-white'
                      : 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                  }`}
                >
                  {len}{pickupCharset === 'digit' ? '桁' : '文字'}
                </button>
              ))}
            </div>
            {validAutoLengths.length === 0 ? (
              <p className={`${framed ? 'mt-2 text-[13px]' : 'mt-1.5 text-xs'} font-bold text-rk-red-700`}>
                この盤面サイズでは{RAKUDA_ROBO_NAME}が選べることばがありません。盤面を大きくしてください。
              </p>
            ) : null}
          </div>
        )}

        <div>
          <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>盤面サイズ</span>
          <div className={`${framed ? 'mt-[16px] gap-4' : 'mt-[13.5px] gap-3'} flex flex-wrap`}>
            {BOARD_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={busy || isBoardInteractionBlocked}
                onClick={() => setBoardPresetId(preset.id)}
                className={`min-w-[3.25rem] rounded-lg px-2.5 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                  boardPresetId === preset.id
                    ? 'bg-rk-hundred-recruit text-rk-white'
                    : 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        </>
        ) : null}

        {!isTileMatchRecruit ? (
          <div>
            <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>☝️ヒント</span>
            <div className={`${framed ? 'mt-[11px] gap-3' : 'mt-[9px] gap-2'} flex flex-wrap`}>
              {(
                [
                  { enabled: true, label: 'あり' },
                  { enabled: false, label: 'なし' },
                ] as const
              ).map(({ enabled, label }) => (
                <button
                  key={label}
                  type="button"
                  disabled={busy || isBoardInteractionBlocked}
                  onClick={() => setHintsEnabled(enabled)}
                  className={`rounded-lg px-3 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                    hintsEnabled === enabled
                      ? 'bg-rk-hundred-recruit text-rk-white'
                      : 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={`${framed ? 'mt-2 text-[13px]' : 'mt-1.5 text-xs'} font-bold leading-snug text-rk-slate-600`}>
              {hintsEnabled
                ? '盤面下のヒントボタンで、まだ見つかっていない答えの位置がわかります'
                : 'ヒントなし。自分で見つけた答えだけが共有されます'}
            </p>
          </div>
        ) : null}

        {!plainChrome ? (
          <p
            className={`${framed ? 'text-[15px]' : 'text-sm'} font-bold leading-snug text-rk-slate-700 rounded-lg border border-rk-amber-200/80 bg-rk-white/90 px-3 py-3`}
          >
            {listLabel}
          </p>
        ) : null}
      </div>

      {hostRecruitBlocked ? (
        <p
          className={`${framed ? 'mt-[22px] text-[14px]' : 'mt-[18px] text-xs'} font-bold leading-relaxed ${
            isTileMatchRecruit ? 'text-rk-teal-950' : 'text-rk-amber-900'
          }`}
        >
          {hostResumeRecruit
            ? '前回の待機室が残っています。下のボタンで続けるか、待機室で「募集を中止」してから新しく作ってください。'
            : HOST_HUNDRED_RECRUIT_LIMIT_MESSAGE}
        </p>
      ) : null}

      {currentUid ? (
        <button
          type="button"
          disabled={createDisabled}
          onClick={() => void handleSubmit()}
          className={`${btnPrimary} ${framed ? 'mt-[32px] text-[19px] py-4' : 'mt-[27px] text-base py-3'} w-full`}
        >
          {busy
            ? '作成中…'
            : hostRecruitBlocked && hostResumeRecruit
              ? 'いまの待機室へ続ける'
              : isTileMatchRecruit
                ? 'この内容で待機室へ'
                : wordMode === 'auto'
                  ? `${RAKUDA_ROBO_NAME}におまかせではじめる`
                  : 'この内容ではじめる（ひとりでもOK）'}
        </button>
      ) : (
        <p className={`${framed ? 'mt-[22px] text-[14px]' : 'mt-[18px] text-xs'} font-bold text-rk-slate-500`}>
          準備中（ログインを待っています）…
        </p>
      )}
    </div>
  );
};

export default HundredCreatePanel;
