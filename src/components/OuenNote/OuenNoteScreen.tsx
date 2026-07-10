import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { CircleHelp, PenLine } from 'lucide-react';
import { RK19QuietRoomBackButton, RK02PrimaryTouchButton, RK03GhostTouchButton } from '../../ui/baselineParts';
import {
  btnGhostTouch,
  btnPrimaryTouch,
  cardClass,
  immersiveContentWidth,
  immersiveHeader,
  immersiveKicker,
  immersiveSubtitle,
  immersiveTitle,
} from '../../ui/policy';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../lib/rakudaGate';
import RenrakuReportButton from '../Renrakucho/RenrakuReportButton';
import {
  OUEN_NOTE_FIELD_LIMITS,
  OUEN_NOTE_FORM_INTRO,
  OUEN_NOTE_GATE_INTRO,
  OUEN_NOTE_NAME_GUIDANCE,
  OUEN_NOTE_POSTING_NOTICE,
  OUEN_NOTE_PROFILE_FIELD_LIMITS,
  OUEN_NOTE_PROFILE_GUIDANCE,
  OUEN_NOTE_RESPECT_MESSAGE,
  OUEN_NOTE_TITLE,
  OUEN_NOTE_COMMENT_MAX_CHARS,
} from '../../lib/ouenNoteConfig';
import OuenNoteGuidePopup from './OuenNoteGuidePopup';
import {
  consultantProfileFromParticipantProfile,
  emptyOuenNoteParticipantProfile,
  fetchOuenNoteParticipantProfile,
  ouenNoteProfileSaveErrorMessage,
  saveOuenNoteParticipantProfile,
  type OuenNoteParticipantProfile,
} from '../../lib/ouenNoteProfileClient';
import {
  createOuenNoteComment,
  createOuenNoteTopic,
  ouenNoteSaveErrorMessage,
  subscribeOuenNoteComments,
  subscribeOuenNoteTopics,
  type OuenNoteComment,
  type OuenNoteTopic,
} from '../../lib/ouenNoteClient';
import {
  emptyOuenNoteDraft,
  OUEN_NOTE_FORM_SECTIONS,
  topicCommentCount,
  topicDisplaySections,
  topicListPreview,
  topicListTitle,
  type OuenNoteTopicDraft,
} from '../../lib/ouenNoteTopicFormat';
import {
  isOuenNoteCommentUnread,
  isOuenNoteTopicUnread,
  markOuenNoteHubSeen,
  markOuenNoteTopicSeen,
  OUEN_NOTE_READ_CHANGED_EVENT,
  topicActivityMs,
} from '../../lib/ouenNoteReadState';
import { vibrate } from '../../lib/utils';

type OuenNoteView = 'list' | 'topic' | 'compose';

const shellClass =
  'absolute inset-0 z-40 h-full max-h-[100dvh] overflow-hidden flex flex-col items-center px-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[clamp(0.9375rem,3.6vw,1.0625rem)] bg-gradient-to-b from-rk-teal-50 via-rk-white to-rk-sky-50 text-rk-slate-900';

interface OuenNoteScreenProps {
  onBack: () => void;
  nickname: string;
  userEmoji: string;
  firebaseUser: User | null;
  onGoogleLogin?: () => void;
  interactionBlocked?: boolean;
}

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function OuenNoteUnreadMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border border-rk-rose-300 bg-rk-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rk-rose-800 ${className}`}
    >
      未読
    </span>
  );
}

function OuenNoteCommentBadge({ count, hasUnread = false }: { count: number; hasUnread?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border-2 px-2.5 py-1 text-[11px] font-black shadow-sm ${
        hasUnread
          ? 'border-rk-rose-500 bg-rk-rose-500 text-rk-white'
          : 'border-rk-teal-600 bg-rk-teal-600 text-rk-white'
      }`}
    >
      コメント
      <span className="tabular-nums">{count}</span>
      {hasUnread ? <span className="sr-only">未読あり</span> : null}
    </span>
  );
}

const OuenNoteScreen: React.FC<OuenNoteScreenProps> = ({
  onBack,
  nickname,
  userEmoji,
  firebaseUser,
  onGoogleLogin,
  interactionBlocked = false,
}) => {
  const [view, setView] = useState<OuenNoteView>('list');
  const [topics, setTopics] = useState<OuenNoteTopic[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedTopic, setSelectedTopic] = useState<OuenNoteTopic | null>(null);
  const [comments, setComments] = useState<OuenNoteComment[]>([]);
  const [draft, setDraft] = useState<OuenNoteTopicDraft>(() => emptyOuenNoteDraft(nickname, userEmoji));
  const [participantProfile, setParticipantProfile] = useState<OuenNoteParticipantProfile>(
    emptyOuenNoteParticipantProfile,
  );
  const [profileBusy, setProfileBusy] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showGuidePopup, setShowGuidePopup] = useState(false);
  const [readTick, setReadTick] = useState(0);

  const uid = firebaseUser?.uid ?? null;
  const canWrite = !!uid && !interactionBlocked;

  useEffect(() => {
    markOuenNoteHubSeen();
  }, []);

  useEffect(() => {
    const bump = () => setReadTick((n) => n + 1);
    window.addEventListener(OUEN_NOTE_READ_CHANGED_EVENT, bump);
    return () => window.removeEventListener(OUEN_NOTE_READ_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    setLoadState('loading');
    const unsub = subscribeOuenNoteTopics(
      (rows) => {
        setTopics(rows);
        setLoadState('ready');
      },
      () => setLoadState('error'),
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (view !== 'topic' || !selectedTopic) {
      setComments([]);
      return;
    }
    const unsub = subscribeOuenNoteComments(selectedTopic.id, setComments);
    return unsub;
  }, [view, selectedTopic]);

  useEffect(() => {
    if (view !== 'compose' || !uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const saved = await fetchOuenNoteParticipantProfile(uid);
        if (cancelled || !saved) return;
        setParticipantProfile(saved);
        const line = consultantProfileFromParticipantProfile(saved);
        if (!line) return;
        setDraft((prev) => (prev.consultantProfile.trim() ? prev : { ...prev, consultantProfile: line }));
      } catch {
        /* プロフィール未設定は正常 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, uid]);

  useEffect(() => {
    if (view !== 'topic' || !selectedTopic) return;
    const latestCommentMs =
      comments.length > 0 ? Math.max(...comments.map((c) => c.createdAtMs)) : 0;
    markOuenNoteTopicSeen(selectedTopic.id, Math.max(topicActivityMs(selectedTopic), latestCommentMs));
  }, [view, selectedTopic, comments]);

  const openTopic = useCallback((topic: OuenNoteTopic) => {
    vibrate(8);
    setSelectedTopic(topic);
    setReplyText('');
    setView('topic');
  }, []);

  const openCompose = useCallback(() => {
    vibrate(8);
    setDraft(emptyOuenNoteDraft(nickname, userEmoji));
    setParticipantProfile(emptyOuenNoteParticipantProfile());
    setView('compose');
  }, [nickname, userEmoji]);

  const patchDraft = useCallback((patch: Partial<OuenNoteTopicDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchParticipantProfile = useCallback((patch: Partial<OuenNoteParticipantProfile>) => {
    setParticipantProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyProfileToConsultantField = useCallback(() => {
    const line = consultantProfileFromParticipantProfile(participantProfile);
    if (!line) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'プロフィールを1つ以上書いてください' }));
      return;
    }
    patchDraft({ consultantProfile: line });
    window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '項目2に入れました' }));
  }, [participantProfile, patchDraft]);

  const saveParticipantProfile = useCallback(async () => {
    if (!uid || profileBusy) return;
    const hasAny =
      participantProfile.ageText.trim() ||
      participantProfile.genderText.trim() ||
      participantProfile.occupationText.trim();
    if (!hasAny) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '保存する内容を書いてください' }));
      return;
    }
    setProfileBusy(true);
    try {
      await saveOuenNoteParticipantProfile(uid, participantProfile);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'プロフィールを保存しました' }));
    } catch (e) {
      const msg =
        e instanceof Error && e.message.length < 120 ? e.message : ouenNoteProfileSaveErrorMessage(e);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: msg }));
    } finally {
      setProfileBusy(false);
    }
  }, [uid, profileBusy, participantProfile]);

  const submitTopic = useCallback(async () => {
    if (!uid || saving) return;
    setSaving(true);
    try {
      const topicId = await createOuenNoteTopic({
        draft,
        authorUid: uid,
        authUser: firebaseUser,
      });
      markOuenNoteTopicSeen(topicId, Date.now());
      const hasProfile =
        participantProfile.ageText.trim() ||
        participantProfile.genderText.trim() ||
        participantProfile.occupationText.trim();
      if (hasProfile) {
        void saveOuenNoteParticipantProfile(uid, participantProfile).catch(() => {});
      }
      setDraft(emptyOuenNoteDraft(nickname, userEmoji));
      setView('list');
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ノートに書きました' }));
    } catch (e) {
      const msg = e instanceof Error && e.message.length < 120 ? e.message : ouenNoteSaveErrorMessage(e);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: msg }));
    } finally {
      setSaving(false);
    }
  }, [uid, saving, draft, nickname, userEmoji, firebaseUser, participantProfile]);

  const submitReply = useCallback(async () => {
    if (!uid || !selectedTopic || saving) return;
    setSaving(true);
    try {
      await createOuenNoteComment({
        topicId: selectedTopic.id,
        text: replyText,
        authorUid: uid,
        authorNick: nickname,
        authorEmoji: userEmoji,
        authUser: firebaseUser,
      });
      markOuenNoteTopicSeen(selectedTopic.id, Date.now());
      setReplyText('');
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '返信しました' }));
    } catch (e) {
      const msg = e instanceof Error && e.message.length < 120 ? e.message : ouenNoteSaveErrorMessage(e);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: msg }));
    } finally {
      setSaving(false);
    }
  }, [uid, selectedTopic, saving, replyText, nickname, userEmoji, firebaseUser]);

  const headerTitle = useMemo(() => {
    if (view === 'compose') return '相談を書く';
    if (view === 'topic') return selectedTopic ? topicListTitle(selectedTopic) : '相談';
    return OUEN_NOTE_TITLE;
  }, [view, selectedTopic]);

  const canSubmitTopic =
    draft.title.trim().length > 0 &&
    (draft.consultantProfile.trim() ||
      draft.goal.trim() ||
      draft.situation.trim() ||
      draft.feelings.trim() ||
      draft.triedResearch.trim());

  void readTick;

  const topicHasUnreadComments = useCallback(
    (topicId: string, topicComments: OuenNoteComment[]) =>
      topicComments.some((c) => isOuenNoteCommentUnread(c, topicId, uid)),
    [uid],
  );

  const selectedTopicHasUnreadComments = useMemo(
    () => (selectedTopic ? topicHasUnreadComments(selectedTopic.id, comments) : false),
    [selectedTopic, comments, topicHasUnreadComments],
  );

  return (
    <div className={shellClass}>
      <OuenNoteGuidePopup open={showGuidePopup} onDismiss={() => setShowGuidePopup(false)} />
      <header className={`${immersiveHeader} w-full max-w-lg`}>
        <RK19QuietRoomBackButton
          onClick={() => {
            if (view === 'list') {
              onBack();
              return;
            }
            setView('list');
          }}
        />
        <div className={`${immersiveContentWidth} text-center min-w-0`}>
          <p className={immersiveKicker}>らくだ珈琲</p>
          <h1 className={`${immersiveTitle} text-base sm:text-lg leading-snug line-clamp-2`}>{headerTitle}</h1>
          {view === 'list' ? (
            <p className={`${immersiveSubtitle} text-[11px] leading-relaxed mt-1`}>{OUEN_NOTE_GATE_INTRO}</p>
          ) : null}
        </div>
      </header>

      <main className={`${immersiveContentWidth} flex-1 min-h-0 overflow-y-auto overscroll-contain w-full pb-4`}>
        {view === 'list' ? (
          <div className="space-y-3">
            <RK03GhostTouchButton
              type="button"
              className={`${btnGhostTouch} w-full flex items-center justify-center gap-2`}
              onClick={() => {
                vibrate(8);
                setShowGuidePopup(true);
              }}
            >
              <CircleHelp size={16} aria-hidden />
              説明を見る
            </RK03GhostTouchButton>

            {canWrite ? (
              <RK02PrimaryTouchButton
                type="button"
                className={`${btnPrimaryTouch} w-full flex items-center justify-center gap-2`}
                onClick={openCompose}
              >
                <PenLine size={16} aria-hidden />
                相談を書く
              </RK02PrimaryTouchButton>
            ) : (
              <div className={`${cardClass} text-xs font-bold text-rk-slate-700 leading-relaxed`}>
                {interactionBlocked
                  ? 'いまは投稿できません'
                  : '書く・返信するには Google ログインが必要です'}
                {!uid && onGoogleLogin ? (
                  <button
                    type="button"
                    className="mt-2 underline text-rk-teal-800"
                    onClick={() => onGoogleLogin()}
                  >
                    Google でログイン
                  </button>
                ) : null}
              </div>
            )}

            {loadState === 'loading' ? (
              <p className="text-center text-xs font-bold text-rk-slate-400 py-8">読み込み中…</p>
            ) : null}
            {loadState === 'error' ? (
              <p className="text-center text-xs font-bold text-rk-rose-700 py-8">読み込みに失敗しました</p>
            ) : null}
            {loadState === 'ready' && topics.length === 0 ? (
              <p className="text-center text-xs font-bold text-rk-slate-500 py-8">まだ相談はありません</p>
            ) : null}

            <ul className="space-y-3">
              {topics.map((topic) => {
                const preview = topicListPreview(topic);
                const count = topicCommentCount(topic);
                const topicUnread = isOuenNoteTopicUnread(topic, uid);
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      className={`${cardClass} w-full text-left border-2 bg-rk-white shadow-sm hover:bg-rk-teal-50/50 transition-colors p-4 ${
                        topicUnread ? 'border-rk-rose-300/90' : 'border-rk-teal-200/90'
                      }`}
                      onClick={() => openTopic(topic)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[15px] font-black text-rk-teal-950 leading-snug break-words">
                              {topicListTitle(topic)}
                            </p>
                            {topicUnread ? <OuenNoteUnreadMark /> : null}
                          </div>
                          {preview ? (
                            <p className="mt-2 text-[13px] font-medium text-rk-slate-700 leading-relaxed line-clamp-3 break-words">
                              {preview}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-rk-slate-500">
                            <span className={RK_GATE_NICK_DISPLAY_CLASS}>
                              {topic.authorEmoji} {topic.authorNick}
                            </span>
                            <span>{formatWhen(topic.createdAtMs)}</span>
                          </div>
                        </div>
                        <OuenNoteCommentBadge count={count} hasUnread={topicUnread && count > 0} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {view === 'compose' ? (
          <div className="space-y-3">
            <div className={`${cardClass} border border-rk-amber-200 bg-rk-amber-50/60 space-y-1`}>
              <p className="text-[11px] font-black text-rk-amber-950">{OUEN_NOTE_RESPECT_MESSAGE}</p>
              <p className="text-[11px] font-bold text-rk-slate-700 leading-relaxed">{OUEN_NOTE_FORM_INTRO}</p>
            </div>

            <div className={`${cardClass} border border-rk-teal-200 bg-rk-white space-y-3`}>
              <p className="text-xs font-black text-rk-teal-900">この相談での表示名</p>
              <p className="text-[10px] font-bold text-rk-slate-600 leading-relaxed">{OUEN_NOTE_NAME_GUIDANCE}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft.postEmoji}
                  onChange={(e) => patchDraft({ postEmoji: e.target.value.slice(0, OUEN_NOTE_FIELD_LIMITS.postEmoji) })}
                  className="w-16 rounded-xl border-2 border-rk-teal-200 bg-rk-white px-2 py-2 text-center text-xl"
                  aria-label="絵文字"
                  maxLength={OUEN_NOTE_FIELD_LIMITS.postEmoji}
                />
                <input
                  type="text"
                  value={draft.postNick}
                  onChange={(e) => patchDraft({ postNick: e.target.value.slice(0, OUEN_NOTE_FIELD_LIMITS.postNick) })}
                  className="flex-1 rounded-xl border-2 border-rk-teal-200 bg-rk-white px-3 py-2 text-sm font-bold text-rk-slate-900"
                  placeholder="ニックネーム"
                  maxLength={OUEN_NOTE_FIELD_LIMITS.postNick}
                />
              </div>
            </div>

            <div className={`${cardClass} border border-rk-sky-200 bg-rk-sky-50/50 space-y-3`}>
              <p className="text-xs font-black text-rk-sky-950">マイプロフィール（自分だけ）</p>
              <p className="text-[10px] font-bold text-rk-slate-600 leading-relaxed">{OUEN_NOTE_PROFILE_GUIDANCE}</p>
              <label className="block space-y-1">
                <span className="text-[11px] font-black text-rk-slate-700">年齢（書き方自由）</span>
                <input
                  type="text"
                  value={participantProfile.ageText}
                  onChange={(e) =>
                    patchParticipantProfile({
                      ageText: e.target.value.slice(0, OUEN_NOTE_PROFILE_FIELD_LIMITS.ageText),
                    })
                  }
                  className="w-full rounded-xl border-2 border-rk-sky-200 bg-rk-white px-3 py-2 text-sm font-medium"
                  placeholder="例：30代 / 非公開"
                  maxLength={OUEN_NOTE_PROFILE_FIELD_LIMITS.ageText}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-black text-rk-slate-700">性別（書き方自由）</span>
                <input
                  type="text"
                  value={participantProfile.genderText}
                  onChange={(e) =>
                    patchParticipantProfile({
                      genderText: e.target.value.slice(0, OUEN_NOTE_PROFILE_FIELD_LIMITS.genderText),
                    })
                  }
                  className="w-full rounded-xl border-2 border-rk-sky-200 bg-rk-white px-3 py-2 text-sm font-medium"
                  placeholder="例：女性 / 答えたくない"
                  maxLength={OUEN_NOTE_PROFILE_FIELD_LIMITS.genderText}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-black text-rk-slate-700">ご職業（書き方自由）</span>
                <input
                  type="text"
                  value={participantProfile.occupationText}
                  onChange={(e) =>
                    patchParticipantProfile({
                      occupationText: e.target.value.slice(0, OUEN_NOTE_PROFILE_FIELD_LIMITS.occupationText),
                    })
                  }
                  className="w-full rounded-xl border-2 border-rk-sky-200 bg-rk-white px-3 py-2 text-sm font-medium"
                  placeholder="例：パート / 学生"
                  maxLength={OUEN_NOTE_PROFILE_FIELD_LIMITS.occupationText}
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <RK03GhostTouchButton
                  type="button"
                  className={`${btnGhostTouch} w-full sm:flex-1`}
                  disabled={profileBusy}
                  onClick={() => void saveParticipantProfile()}
                >
                  {profileBusy ? '保存中…' : '保存する'}
                </RK03GhostTouchButton>
                <RK02PrimaryTouchButton
                  type="button"
                  className={`${btnPrimaryTouch} w-full sm:flex-1`}
                  onClick={applyProfileToConsultantField}
                >
                  項目2に入れる
                </RK02PrimaryTouchButton>
              </div>
            </div>

            {OUEN_NOTE_FORM_SECTIONS.map((section) => {
              const limit = OUEN_NOTE_FIELD_LIMITS[section.key];
              const value = draft[section.key];
              return (
                <label key={section.key} className="block space-y-1.5">
                  <span className="text-xs font-black text-rk-teal-950">
                    {section.label}
                    {section.required ? <span className="text-rk-rose-600"> *</span> : null}
                  </span>
                  <span className="block text-[10px] font-bold text-rk-slate-500 leading-snug">{section.hint}</span>
                  <textarea
                    value={value}
                    onChange={(e) => patchDraft({ [section.key]: e.target.value.slice(0, limit) })}
                    rows={section.rows}
                    className="w-full rounded-xl border-2 border-rk-teal-200 bg-rk-white p-3 text-sm font-medium text-rk-slate-900 resize-y min-h-[4.5rem]"
                    maxLength={limit}
                  />
                  <p className="text-[10px] text-rk-slate-400 text-right tabular-nums">
                    {value.length}/{limit}
                  </p>
                </label>
              );
            })}

            <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">{OUEN_NOTE_POSTING_NOTICE}</p>

            <RK02PrimaryTouchButton
              type="button"
              disabled={saving || !canSubmitTopic}
              className={`${btnPrimaryTouch} w-full`}
              onClick={() => void submitTopic()}
            >
              {saving ? '送信中…' : '投稿する'}
            </RK02PrimaryTouchButton>
            <RK03GhostTouchButton type="button" className={`${btnGhostTouch} w-full`} onClick={() => setView('list')}>
              やめる
            </RK03GhostTouchButton>
          </div>
        ) : null}

        {view === 'topic' && selectedTopic ? (
          <div className="space-y-3">
            <article className={`${cardClass} border-2 border-rk-teal-300 bg-rk-white space-y-3`}>
              <h2 className="text-base font-black text-rk-teal-950 leading-snug break-words">
                {topicListTitle(selectedTopic)}
              </h2>
              {topicDisplaySections(selectedTopic)
                .filter((section) => !(section.label === '相談のタイトル' && (selectedTopic.title || '').trim()))
                .map((section) => (
                <div key={section.label} className="border-t border-rk-slate-100 pt-3 first:border-0 first:pt-0">
                  <p className="text-[10px] font-black text-rk-teal-800 uppercase tracking-wide">{section.label}</p>
                  <p className="mt-1 text-sm font-medium text-rk-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                    {section.text}
                  </p>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2 border-t border-rk-slate-100 pt-3 text-[10px] font-bold text-rk-slate-500">
                <span className={RK_GATE_NICK_DISPLAY_CLASS}>
                  {selectedTopic.authorEmoji} {selectedTopic.authorNick}
                </span>
                <span>{formatWhen(selectedTopic.createdAtMs)}</span>
                <RenrakuReportButton
                  targetType="ouen_note_topic"
                  targetId={selectedTopic.id}
                  authorUid={selectedTopic.authorUid}
                  authorName={selectedTopic.authorNick}
                  reporterUid={uid}
                  interactionBlocked={interactionBlocked}
                />
              </div>
            </article>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-black text-rk-slate-700">コメント</h2>
                {selectedTopicHasUnreadComments ? <OuenNoteUnreadMark /> : null}
              </div>
              <OuenNoteCommentBadge
                count={topicCommentCount(selectedTopic, comments.length)}
                hasUnread={selectedTopicHasUnreadComments}
              />
            </div>

            <p className="text-[11px] font-bold text-rk-sky-900 leading-relaxed rounded-lg border border-rk-sky-200 bg-rk-sky-50/80 px-3 py-2">
              {OUEN_NOTE_RESPECT_MESSAGE}
            </p>

            <ul className="space-y-2">
              {comments.map((c) => {
                const commentUnread = isOuenNoteCommentUnread(c, selectedTopic.id, uid);
                return (
                <li
                  key={c.id}
                  className={`${cardClass} bg-rk-white border-2 shadow-sm ${
                    commentUnread ? 'border-rk-rose-300' : 'border-rk-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-rk-slate-800 whitespace-pre-wrap break-words leading-relaxed flex-1 min-w-0">
                      {c.text}
                    </p>
                    {commentUnread ? <OuenNoteUnreadMark /> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-rk-slate-500">
                    <span className={RK_GATE_NICK_DISPLAY_CLASS}>
                      {c.authorEmoji} {c.authorNick}
                    </span>
                    <span>{formatWhen(c.createdAtMs)}</span>
                    <RenrakuReportButton
                      targetType="ouen_note_comment"
                      targetId={`${c.topicId}/${c.id}`}
                      authorUid={c.authorUid}
                      authorName={c.authorNick}
                      reporterUid={uid}
                      interactionBlocked={interactionBlocked}
                    />
                  </div>
                </li>
              );
              })}
              {comments.length === 0 ? (
                <p className="text-center text-xs font-bold text-rk-slate-400 py-4">まだコメントはありません</p>
              ) : null}
            </ul>

            {canWrite ? (
              <div className="space-y-2 pt-2 border-t-2 border-rk-teal-200">
                <p className="text-xs font-black text-rk-teal-900">コメントを書く</p>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value.slice(0, OUEN_NOTE_COMMENT_MAX_CHARS))}
                  rows={4}
                  className="w-full rounded-xl border-2 border-rk-teal-200 bg-rk-white p-3 text-sm font-medium resize-y"
                  placeholder="やさしく、聞いたよ・一緒に考えよう、くらいの温度で"
                  maxLength={OUEN_NOTE_COMMENT_MAX_CHARS}
                />
                <p className="text-[10px] text-rk-slate-500 text-right tabular-nums">
                  {replyText.length}/{OUEN_NOTE_COMMENT_MAX_CHARS}
                </p>
                <RK02PrimaryTouchButton
                  type="button"
                  disabled={saving || !replyText.trim()}
                  className={`${btnPrimaryTouch} w-full`}
                  onClick={() => void submitReply()}
                >
                  {saving ? '送信中…' : 'コメントする'}
                </RK02PrimaryTouchButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default OuenNoteScreen;
