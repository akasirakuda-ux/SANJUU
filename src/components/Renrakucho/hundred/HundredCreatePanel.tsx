import React, { useCallback, useState } from 'react';
import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../../firebase';
import { PROHIBITED_WORDS, convertToHiragana } from '../../../constants';
import {
  HUNDRED_AUTO_WORD_LENGTH_OPTIONS,
  isAutoWordLengthValidForBoard,
  maxAutoTargetWordLengthForBoard,
  pickAutoTargetWordForBoard,
  type HundredAutoWordLength,
} from '../../../lib/hundredAutoTargetWord';
import { btnPrimary } from '../../../ui/policy';
import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME } from '../../../lib/reversiConfig';
import { targetWordFitsBoard } from '../../../lib/boardDimensions';
import type { HundredPublicRecruit, HundredRecruitDurationSec } from '../types';

type BoardPreset = {
  id: string;
  cols: number;
  rows: number;
  label: string;
};

const BOARD_PRESETS: BoardPreset[] = [
  { id: '5', cols: 5, rows: 5, label: '5×5' },
  { id: '10', cols: 10, rows: 10, label: '10×10' },
  { id: '15', cols: 15, rows: 15, label: '15×15' },
  { id: '20', cols: 20, rows: 20, label: '20×20' },
  { id: '20x30', cols: 20, rows: 30, label: '20×30' },
];

const DURATION_OPTIONS: { sec: HundredRecruitDurationSec; label: string }[] = [
  { sec: 300, label: '5分' },
  { sec: 600, label: '10分' },
  { sec: 900, label: '15分' },
];

const RK_LAST_AUTO_WORD_KEY = 'rk_hundred_last_auto_word';

type WordMode = 'manual' | 'auto';

function readLastAutoWord(): string {
  try {
    return localStorage.getItem(RK_LAST_AUTO_WORD_KEY) || '';
  } catch {
    return '';
  }
}

function writeLastAutoWord(word: string): void {
  try {
    localStorage.setItem(RK_LAST_AUTO_WORD_KEY, word);
  } catch {
    /* ignore */
  }
}

const HundredCreatePanel: React.FC<{
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
  nickname,
  userEmoji,
  currentUid,
  isBoardInteractionBlocked,
  ensureAuth,
  onCreatedRecruit,
  plainChrome = false,
}) => {
  const [targetWord, setTargetWord] = useState('');
  const [wordMode, setWordMode] = useState<WordMode>('manual');
  const [autoWordLength, setAutoWordLength] = useState<HundredAutoWordLength>(3);
  const [boardPresetId, setBoardPresetId] = useState<string>('10');
  const [durationSec, setDurationSec] = useState<HundredRecruitDurationSec>(300);
  const [listOnBoard, setListOnBoard] = useState(true);
  const [busy, setBusy] = useState(false);
  /** 掲示板ではチェック UI を出さず、常に募集一覧へ載せる */
  const effectiveListOnBoard = plainChrome ? true : listOnBoard;
  const framed = !plainChrome;

  const selectedPreset =
    BOARD_PRESETS.find((p) => p.id === boardPresetId) ?? BOARD_PRESETS[1];

  const { cols: presetCols, rows: presetRows } = selectedPreset;

  const validAutoLengths = HUNDRED_AUTO_WORD_LENGTH_OPTIONS.filter((len) =>
    isAutoWordLengthValidForBoard(len, presetCols, presetRows),
  );

  const effectiveAutoLength: HundredAutoWordLength =
    validAutoLengths.includes(autoWordLength)
      ? autoWordLength
      : validAutoLengths[0] ?? 3;

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

    const twManual = (targetWord || '').trim();
    let tw = twManual;

    const { cols, rows } = selectedPreset;

    if (wordMode === 'auto') {
      if (validAutoLengths.length === 0) {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', {
            detail: `この盤面（${cols}×${rows}）で${RAKUDA_ROBO_NAME}が選べることばがありません`,
          }),
        );
        return;
      }
      const picked = pickAutoTargetWordForBoard(cols, rows, effectiveAutoLength, {
        exclude: readLastAutoWord() ? [readLastAutoWord()] : [],
      });
      if (!picked) {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', {
            detail: `${effectiveAutoLength}文字の${RAKUDA_ROBO_NAME}ことばが見つかりませんでした`,
          }),
        );
        return;
      }
      tw = picked;
      writeLastAutoWord(picked);
    } else if (!tw) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '「探すことば」を入力してください' }));
      return;
    }

    if (!targetWordFitsBoard(tw, cols, rows)) {
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', {
          detail: `ことばの長さが盤面（${cols}×${rows}）より長いです`,
        })
      );
      return;
    }

    const h = convertToHiragana(tw);
    if (PROHIBITED_WORDS.some((w) => h.includes(w))) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ことばに使えない語が含まれています' }));
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

      const roomId = crypto.randomUUID();
      const recruitDeadlineAt = Timestamp.fromMillis(Date.now() + durationSec * 1000);
      const hostNickname = nick;
      const emoji = (userEmoji || '').trim() || '🐫';

      const batch = writeBatch(db);
      const roomRef = doc(db, 'hundred_rooms', roomId);

      const boardFields = {
        boardSize: cols,
        boardCols: cols,
        boardRows: rows,
      };

      let publicId: string;
      if (effectiveListOnBoard) {
        const publicRef = doc(collection(db, 'hundred_public'));
        publicId = publicRef.id;
        batch.set(publicRef, {
          type: 'hundred',
          roomId,
          targetWord: tw,
          ...boardFields,
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
        hostUid: uid,
        hostNickname,
        hostEmoji: emoji,
        recruitDeadlineAt,
        createdAt: Timestamp.now(),
        gameTimeLimitSec: 0,
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
    durationSec,
    effectiveListOnBoard,
    userEmoji,
    ensureAuth,
    onCreatedRecruit,
  ]);

  return (
    <div
      className={
        plainChrome
          ? 'px-0 py-0'
          : 'rounded-xl border-[3px] border-rk-amber-500 bg-gradient-to-b from-rk-amber-100/90 to-rk-amber-50/95 px-4 py-[32px] shadow-md'
      }
    >
      <div className={`${framed ? 'text-[19px]' : 'text-base'} font-black uppercase tracking-widest text-rk-amber-950`}>
        30の問題を作る
      </div>

      <div className={framed ? 'mt-[32px] space-y-[27px]' : 'mt-[27px] space-y-[22.5px]'}>
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
              文字数を選ぶと、{RAKUDA_ROBO_NAME}が辞書から名詞を選び、待機室で盤面を作ります
            </p>
          ) : null}
        </div>

        {wordMode === 'manual' ? (
          <label className="block">
            <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>探すことば</span>
            <input
              type="text"
              value={targetWord}
              onChange={(e) => setTargetWord(e.target.value)}
              disabled={busy || isBoardInteractionBlocked}
              className={`${framed ? 'mt-[11px] text-[19px] py-3' : 'mt-[9px] text-base py-2.5'} w-full rounded-lg border border-rk-slate-200 bg-rk-white px-3 font-bold text-rk-slate-900`}
              placeholder="例：らくだ"
              autoComplete="off"
            />
          </label>
        ) : (
          <div>
            <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>
              探すことばの文字数
            </span>
            <div className={`${framed ? 'mt-[11px] gap-3' : 'mt-[9px] gap-2'} flex flex-wrap`}>
              {HUNDRED_AUTO_WORD_LENGTH_OPTIONS.map((len) => {
                const enabled =
                  len <= maxAutoTargetWordLengthForBoard(presetCols, presetRows) &&
                  isAutoWordLengthValidForBoard(len, presetCols, presetRows);
                return (
                  <button
                    key={len}
                    type="button"
                    disabled={busy || isBoardInteractionBlocked || !enabled}
                    onClick={() => setAutoWordLength(len)}
                    className={`min-w-[2.75rem] rounded-lg px-2.5 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                      effectiveAutoLength === len
                        ? 'bg-rk-hundred-recruit text-rk-white'
                        : enabled
                          ? 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                          : 'border border-rk-slate-100 bg-rk-slate-50 text-rk-slate-300'
                    }`}
                  >
                    {len}文字
                  </button>
                );
              })}
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

        <div>
          <span className={`${framed ? 'text-[14px]' : 'text-xs'} font-black text-rk-slate-600`}>募集の時間（締め切りまで）</span>
          <div className={`${framed ? 'mt-[16px] gap-4' : 'mt-[13.5px] gap-3'} flex flex-wrap`}>
            {DURATION_OPTIONS.map(({ sec, label }) => (
              <button
                key={sec}
                type="button"
                disabled={busy || isBoardInteractionBlocked}
                onClick={() => setDurationSec(sec)}
                className={`rounded-lg px-3 ${framed ? 'py-2.5 text-[17px]' : 'py-2 text-sm'} font-black transition-colors ${
                  durationSec === sec
                    ? 'bg-rk-primary text-rk-white'
                    : 'border border-rk-slate-200 bg-rk-white text-rk-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!plainChrome ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rk-slate-200/80 bg-rk-white/90 px-3 py-[27px]">
            <input
              type="checkbox"
              checked={listOnBoard}
              disabled={busy || isBoardInteractionBlocked}
              onChange={(e) => setListOnBoard(e.target.checked)}
              className={`${framed ? 'h-5 w-5' : 'h-4 w-4'} mt-0.5 shrink-0 rounded border-rk-slate-300`}
            />
            <span className={`${framed ? 'text-[17px]' : 'text-sm'} font-bold leading-snug text-rk-slate-800`}>
              ひと言探しの募集一覧に載せる（だれでも「参加」から入れます）
            </span>
          </label>
        ) : null}
      </div>

      {currentUid ? (
        <button
          type="button"
          disabled={busy || isBoardInteractionBlocked}
          onClick={() => void handleSubmit()}
          className={`${btnPrimary} ${framed ? 'mt-[32px] text-[19px] py-4' : 'mt-[27px] text-base py-3'} w-full`}
        >
          {busy ? '作成中…' : wordMode === 'auto' ? `${RAKUDA_ROBO_NAME}におまかせで待機室へ` : 'この内容で待機室へ'}
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
