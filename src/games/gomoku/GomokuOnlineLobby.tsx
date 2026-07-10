import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LogEntry } from '../../types';
import {
  GOMOKU_DEFAULT_ROOM_DEFAULTS,
  GOMOKU_RECRUIT_COMMENT_MAX,
  gomokuOnlineStartModeHintJa,
  gomokuOnlineStartModeLabelJa,
  normalizeGomokuRecruitComment,
  type GomokuOnlineStartMode,
  type GomokuRoomDefaults,
} from '../../lib/gomokuConfig';
import {
  GOMOKU_HANDICAP_OPTIONS,
  gomokuBoardSizeLabelJa,
  gomokuHandicapHintJa,
  gomokuHandicapLabelJa,
  type GomokuBoardSize,
  type GomokuColor,
  type GomokuHandicapStones,
} from '../../lib/gomokuLogic';
import {
  gomokuHostRecordSummaryJa,
  gomokuHostStrengthHintJa,
} from '../../lib/gomokuMatchLog';
import type { GomokuRoomDoc } from '../../lib/gomokuRooms';
import { gomokuOpenRoomRulesJa, gomokuWaitingAgeJa } from '../../lib/gomokuRooms';
import { RK02PrimaryTouchButton, RK03GhostTouchButton } from '../../ui/baselineParts';

export function GomokuLogsPanel({
  logs,
  isLoggedIn,
  onLogin,
  onDone,
}: {
  logs: LogEntry[];
  isLoggedIn: boolean;
  onLogin: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 w-full max-w-md flex flex-col py-3">
      {!isLoggedIn ? (
        <div className="rounded-xl border border-rk-amber-300 bg-rk-amber-50 p-4 text-center space-y-3 mb-3">
          <p className="text-[0.85em] text-rk-amber-950 leading-snug">
            対戦記録はログインした人だけ残ります。
          </p>
          <RK02PrimaryTouchButton className="w-full" onClick={onLogin}>
            Googleでログイン
          </RK02PrimaryTouchButton>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 rounded-xl border border-rk-amber-300/80 bg-rk-white/90 p-2">
        {logs.length === 0 ? (
          <p className="text-[0.82em] text-center text-rk-amber-900/65 py-8">
            {isLoggedIn ? 'まだ記録がありません' : 'ログイン後に記録されます'}
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-rk-slate-200 bg-rk-slate-50/80 px-3 py-2 text-[0.78em]"
            >
              <div className="flex items-center gap-1.5 font-bold text-rk-slate-800">
                <span>{log.emoji ?? '⚫'}</span>
                <span className="tabular-nums text-rk-slate-500 font-medium">{log.timestamp}</span>
              </div>
              <p className="mt-0.5 text-rk-slate-800 leading-snug">{log.message}</p>
            </div>
          ))
        )}
      </div>
      <RK02PrimaryTouchButton className="w-full mt-3 shrink-0" onClick={onDone}>
        もどる
      </RK02PrimaryTouchButton>
    </div>
  );
}

export function OpenGomokuRoomCard({
  room,
  busy,
  onJoin,
}: {
  room: GomokuRoomDoc;
  busy: boolean;
  onJoin: () => void;
}) {
  const strengthHint = gomokuHostStrengthHintJa(room.hostRecord);
  const recordSummary = gomokuHostRecordSummaryJa(room.hostRecord);
  const rules = gomokuOpenRoomRulesJa(room);
  const waitingAge = gomokuWaitingAgeJa(room.createdAt);

  return (
    <div className="rounded-lg border border-rk-amber-200 bg-rk-amber-50/70 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-rk-amber-950 leading-snug truncate">
            {room.host.emoji} {room.host.name}
          </p>
        </div>
        <span className="shrink-0 text-rk-amber-900/55 tabular-nums">{waitingAge}</span>
      </div>
      {room.recruitComment ? (
        <p className="mt-1.5 font-medium text-rk-amber-950 leading-snug">{room.recruitComment}</p>
      ) : null}
      <p className="mt-1.5 text-rk-amber-900/80 leading-snug">{recordSummary}</p>
      {strengthHint ? (
        <p className="mt-0.5 font-bold text-rk-amber-900/85">{strengthHint}</p>
      ) : null}
      <p className="mt-1 text-rk-amber-900/65 leading-snug">{rules}</p>
      <RK02PrimaryTouchButton className="mt-2 w-full" disabled={busy} onClick={onJoin}>
        このルームに参加
      </RK02PrimaryTouchButton>
    </div>
  );
}

function GomokuRadioOption({
  name,
  value,
  checked,
  label,
  hint,
  onSelect,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
        checked ? 'border-rk-amber-600 bg-rk-amber-100' : 'border-rk-slate-300 bg-rk-white',
      ].join(' ')}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-rk-amber-700"
      />
      <span className="min-w-0 text-left">
        <span className="block font-black text-rk-amber-950">{label}</span>
        {hint ? (
          <span className="block text-[0.88em] font-medium text-rk-amber-900/70 mt-0.5">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.82em] font-black text-rk-amber-950 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

export function GomokuRecruitComposer({
  draft,
  busy,
  onChange,
  onReset,
  onSaveDefaults,
  onSubmit,
}: {
  draft: GomokuRoomDefaults;
  busy: boolean;
  onChange: (next: GomokuRoomDefaults) => void;
  onReset: () => void;
  onSaveDefaults: () => void;
  onSubmit: () => void;
}) {
  const startModes: GomokuOnlineStartMode[] = ['default_black', 'guest_black', 'coin'];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 text-[105%]">
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-rk-amber-300/80 bg-rk-white/90 p-3 space-y-3">
        <SettingsSection label="先攻・後攻">
          <fieldset className="space-y-1.5 border-0 p-0 m-0">
            {startModes.map((mode) => (
              <GomokuRadioOption
                key={mode}
                name="gomoku-online-start-mode"
                value={mode}
                checked={draft.onlineStartMode === mode}
                label={gomokuOnlineStartModeLabelJa(mode)}
                hint={gomokuOnlineStartModeHintJa(mode)}
                onSelect={() => onChange({ ...draft, onlineStartMode: mode })}
              />
            ))}
          </fieldset>
        </SettingsSection>

        <SettingsSection label="盤面">
          <div className="flex gap-2">
            {([13, 15] as GomokuBoardSize[]).map((boardSize) => (
              <button
                key={boardSize}
                type="button"
                onClick={() => onChange({ ...draft, boardSize })}
                className={[
                  'flex-1 rounded-lg border px-2 py-2 font-bold',
                  draft.boardSize === boardSize
                    ? 'border-rk-amber-600 bg-rk-amber-200 text-rk-amber-950'
                    : 'border-rk-slate-300 bg-rk-white',
                ].join(' ')}
              >
                {gomokuBoardSizeLabelJa(boardSize)}
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection label="星ハンデ（らくだ式）">
          <p className="text-[0.78em] text-rk-amber-900/65 mb-1.5">{gomokuHandicapHintJa()}</p>
          <div className="flex gap-1.5 flex-wrap">
            {GOMOKU_HANDICAP_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ ...draft, handicapStones: n as GomokuHandicapStones })}
                className={[
                  'min-w-10 rounded-lg border px-2 py-1.5 font-bold text-[0.9em]',
                  draft.handicapStones === n
                    ? 'border-rk-amber-600 bg-rk-amber-200 text-rk-amber-950'
                    : 'border-rk-slate-300 bg-rk-white',
                ].join(' ')}
              >
                {gomokuHandicapLabelJa(n)}
              </button>
            ))}
          </div>
          {draft.handicapStones > 0 ? (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <GomokuRadioOption
                name="gomoku-recruit-handicap-color"
                value="white"
                checked={draft.handicapBeneficiary === 'white'}
                label="ハンデは白"
                onSelect={() => onChange({ ...draft, handicapBeneficiary: 'white' })}
              />
              <GomokuRadioOption
                name="gomoku-recruit-handicap-color"
                value="black"
                checked={draft.handicapBeneficiary === 'black'}
                label="ハンデは黒"
                onSelect={() => onChange({ ...draft, handicapBeneficiary: 'black' as GomokuColor })}
              />
            </div>
          ) : null}
        </SettingsSection>

        <SettingsSection label="コメント（任意）">
          <textarea
            value={draft.recruitComment}
            onChange={(e) =>
              onChange({
                ...draft,
                recruitComment: normalizeGomokuRecruitComment(e.target.value),
              })
            }
            placeholder="お気楽にどうぞ。"
            rows={3}
            maxLength={GOMOKU_RECRUIT_COMMENT_MAX}
            className="w-full rounded-lg border border-rk-slate-300 px-3 py-2 leading-snug resize-none"
          />
          <p className="mt-1 text-rk-amber-900/55 text-right tabular-nums">
            {draft.recruitComment.length}/{GOMOKU_RECRUIT_COMMENT_MAX}
          </p>
        </SettingsSection>
      </div>

      <RK02PrimaryTouchButton className="w-full shrink-0" disabled={busy} onClick={onSubmit}>
        募集を開始
      </RK02PrimaryTouchButton>
      <div className="flex gap-2 shrink-0">
        <RK03GhostTouchButton className="flex-1" disabled={busy} onClick={onReset}>
          初期値に戻す
        </RK03GhostTouchButton>
        <RK03GhostTouchButton className="flex-1" disabled={busy} onClick={onSaveDefaults}>
          自分の設定として保存
        </RK03GhostTouchButton>
      </div>
    </div>
  );
}

export function GomokuSidePickOverlay({
  mode,
  myColor,
  host,
  guest,
}: {
  mode: 'anim' | 'reveal';
  myColor: GomokuColor | null;
  host: GomokuRoomDoc['host'];
  guest?: GomokuRoomDoc['guest'];
}) {
  const isBlack = myColor === 'black';
  const isWhite = myColor === 'white';

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-rk-amber-950/55 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-rk-amber-300/80 bg-rk-white/95 p-6 text-center shadow-xl"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
      >
        {mode === 'anim' ? (
          <>
            <p className="text-[1.05em] font-black text-rk-amber-950 mb-4">コインで先後を決定中…</p>
            <motion.div
              className="mx-auto flex size-28 items-center justify-center rounded-full border-4 border-rk-amber-500 bg-gradient-to-b from-rk-amber-200 to-rk-amber-400 text-5xl shadow-lg"
              animate={{ rotateY: [0, 360, 720, 1080], scale: [1, 1.08, 1] }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
            >
              🪙
            </motion.div>
            <p className="mt-5 text-[0.88em] font-medium text-rk-amber-900/70 leading-snug">
              {host.emoji} {host.name} と {guest?.emoji ?? '👤'} {guest?.name ?? '相手'}
              <br />
              お待ちください…
            </p>
          </>
        ) : (
          <>
            <p className="text-[0.9em] font-black text-rk-amber-900 mb-2">🪙 コインの結果</p>
            {isBlack ? (
              <div className="space-y-2">
                <p className="text-[1.35em] font-black text-rk-slate-900">あなたは 黒（先手）</p>
                <span className="inline-flex size-14 items-center justify-center rounded-full border-4 border-rk-slate-700 bg-rk-slate-900 shadow-md" />
                <p className="text-[0.88em] font-bold text-rk-amber-900/75">先攻でスタートします</p>
              </div>
            ) : isWhite ? (
              <div className="space-y-2">
                <p className="text-[1.35em] font-black text-rk-slate-800">あなたは 白（後攻）</p>
                <span className="inline-flex size-14 items-center justify-center rounded-full border-4 border-rk-slate-300 bg-rk-white shadow-md" />
                <p className="text-[0.88em] font-bold text-rk-amber-900/75">後攻でスタートします</p>
              </div>
            ) : (
              <p className="text-[0.95em] font-bold text-rk-amber-950">先後が決まりました</p>
            )}
            <p className="mt-4 text-[0.82em] text-rk-amber-900/65">まもなく対局が始まります…</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export { GOMOKU_DEFAULT_ROOM_DEFAULTS };
