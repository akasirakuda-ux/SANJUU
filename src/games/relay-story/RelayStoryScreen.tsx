import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { BookOpen, PenLine } from 'lucide-react';
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
import {
  RELAY_STORY_CHAR_RULE_LABEL,
  RELAY_STORY_MAX_CHARS,
  RELAY_STORY_POSTING_NOTICE,
  RELAY_STORY_REVIEW_MAX_CHARS,
  relayStoryKindAtStep,
  relayStoryProgressLabel,
  relayStoryRatingSummaryLabel,
  isTodayRelayPromptTitle,
} from '../../lib/relayStoryConfig';
import {
  appendRelayStorySegment,
  canUserWriteOnStory,
  createRelayStory,
  listRelayStories,
  relayStorySaveErrorMessage,
  relayStoryWriteBlockedReason,
  resolveRelayStoryAuthor,
  validateRelayStoryText,
  visibleRelayStorySegments,
} from '../../lib/relayStoryClient';
import {
  listRelayStoryReviews,
  relayStoryReviewSaveErrorMessage,
  submitRelayStoryReview,
} from '../../lib/relayStoryReviewClient';
import type { RelayStory, RelayStoryReview } from '../../lib/relayStoryTypes';
import { vibrate } from '../../lib/utils';

type RelayStoryView = 'home' | 'read' | 'start';

const relayStoryImmersiveShell =
  'absolute inset-0 z-40 h-full max-h-[100dvh] overflow-hidden flex flex-col items-center px-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[clamp(0.9375rem,3.6vw,1.0625rem)] bg-gradient-to-b from-rk-amber-50 via-rk-white to-rk-sky-50 text-rk-slate-900';

interface RelayStoryScreenProps {
  onBack: () => void;
  nickname: string;
  userEmoji: string;
  firebaseUser: User | null;
  onGoogleLogin?: () => void;
}

function StarRatingRow({
  value,
  onPick,
  readonly = false,
  size = 'md',
}: {
  value: number;
  onPick?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}) {
  const starClass = size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <div className="flex gap-0.5" aria-label={readonly ? `${value}つ星` : '星を選ぶ'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly || !onPick}
          className={`${starClass} leading-none transition-transform ${
            n <= value ? 'text-rk-amber-500' : 'text-rk-slate-300'
          } ${readonly || !onPick ? 'cursor-default' : 'active:scale-110'}`}
          onClick={() => {
            if (!onPick) return;
            vibrate(8);
            onPick(n);
          }}
          aria-label={`${n}つ星`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const RelayStoryScreen: React.FC<RelayStoryScreenProps> = ({
  onBack,
  nickname,
  userEmoji,
  firebaseUser,
  onGoogleLogin,
}) => {
  const [view, setView] = useState<RelayStoryView>('home');
  const [tab, setTab] = useState<'read' | 'write'>('write');
  const [stories, setStories] = useState<RelayStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RelayStory | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reviews, setReviews] = useState<RelayStoryReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);
  const actionFormRef = useRef<HTMLElement | null>(null);

  const uid = firebaseUser?.uid ?? null;
  const authorProfile = useMemo(
    () =>
      resolveRelayStoryAuthor(
        uid,
        nickname,
        userEmoji,
        firebaseUser?.displayName,
        firebaseUser?.email,
      ),
    [firebaseUser?.displayName, firebaseUser?.email, nickname, uid, userEmoji],
  );

  const refresh = useCallback(async (): Promise<RelayStory[]> => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listRelayStories();
      setStories(list);
      return list;
    } catch (e) {
      console.warn('[RelayStory] list failed', e);
      setLoadError('物語の一覧を読み込めませんでした');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = globalThis.setTimeout(() => setToast(null), 3200);
    return () => globalThis.clearTimeout(t);
  }, [toast]);

  const loadReviews = useCallback(async (storyId: string) => {
    setReviewsLoading(true);
    setReviewFormError(null);
    try {
      const list = await listRelayStoryReviews(storyId);
      setReviews(list);
      const mine = uid ? list.find((r) => r.authorUid === uid) : undefined;
      setReviewRating(mine?.rating ?? 0);
      setReviewText(mine?.text ?? '');
    } catch (e) {
      console.warn('[RelayStory] reviews failed', e);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (view !== 'read' || !selected || selected.status !== 'complete') {
      setReviews([]);
      setReviewRating(0);
      setReviewText('');
      return;
    }
    void loadReviews(selected.id);
  }, [view, selected, loadReviews]);

  useEffect(() => {
    if (view !== 'read' || !selected || selected.status !== 'complete') return;
    const t = globalThis.requestAnimationFrame(() => {
      actionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => globalThis.cancelAnimationFrame(t);
  }, [view, selected?.id, selected?.status]);

  const completedStories = useMemo(
    () => stories.filter((s) => s.status === 'complete'),
    [stories],
  );
  const openStories = useMemo(
    () => stories.filter((s) => s.status === 'open' && s.currentStep < 4),
    [stories],
  );
  const writableStories = useMemo(
    () => openStories.filter((s) => canUserWriteOnStory(s, uid)),
    [openStories, uid],
  );

  const openRead = (story: RelayStory, forWrite = false) => {
    vibrate(10);
    if (forWrite) {
      const blocked = relayStoryWriteBlockedReason(uid);
      if (blocked) {
        setToast(blocked);
        return;
      }
      if (!canUserWriteOnStory(story, uid)) {
        setToast('この物語には参加できません');
        return;
      }
    }
    if (forWrite || canUserWriteOnStory(story, uid)) {
      setTextInput('');
      setFormError(null);
    }
    setSelected(story);
    setView('read');
  };

  const openStart = () => {
    vibrate(10);
    const blocked = relayStoryWriteBlockedReason(uid);
    if (blocked) {
      setToast(blocked);
      return;
    }
    setTitleInput('');
    setTextInput('');
    setFormError(null);
    setView('start');
  };

  const handleBackInner = () => {
    vibrate(10);
    if (view === 'home') {
      onBack();
      return;
    }
    setView('home');
    setSelected(null);
    setFormError(null);
  };

  const submitStart = async () => {
    if (!authorProfile) return;
    const err = validateRelayStoryText(textInput);
    if (err) {
      setFormError(err);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createRelayStory({
        title: titleInput,
        text: textInput,
        authorUid: authorProfile.authorUid,
        authorNick: authorProfile.authorNick,
        authorEmoji: authorProfile.authorEmoji,
      });
      setToast('「起」を書きました。次の人を待ちます');
      await refresh();
      setView('home');
      setTab('read');
    } catch (e) {
      setFormError(relayStorySaveErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitContinue = async () => {
    if (!authorProfile || !selected) return;
    const err = validateRelayStoryText(textInput);
    if (err) {
      setFormError(err);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await appendRelayStorySegment({
        storyId: selected.id,
        text: textInput,
        authorUid: authorProfile.authorUid,
        authorNick: authorProfile.authorNick,
        authorEmoji: authorProfile.authorEmoji,
      });
      const kind = relayStoryKindAtStep(selected.currentStep);
      const done = selected.currentStep >= 3;
      setToast(done ? '「結」で物語が完結しました' : `「${kind}」を書きました`);
      await refresh();
      setView('home');
      setSelected(null);
    } catch (e) {
      setFormError(relayStorySaveErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!authorProfile || !selected) return;
    if (reviewRating < 1) {
      setReviewFormError('★を1〜5で選んでください');
      return;
    }
    setReviewSubmitting(true);
    setReviewFormError(null);
    try {
      await submitRelayStoryReview({
        storyId: selected.id,
        rating: reviewRating,
        text: reviewText,
        authorUid: authorProfile.authorUid,
        authorNick: authorProfile.authorNick,
        authorEmoji: authorProfile.authorEmoji,
      });
      setToast('レビューを投稿しました');
      const list = await refresh();
      const updated = list.find((s) => s.id === selected.id);
      if (updated) setSelected(updated);
      await loadReviews(selected.id);
    } catch (e) {
      setReviewFormError(relayStoryReviewSaveErrorMessage(e));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const renderReviewSection = (story: RelayStory) => {
    const summary = relayStoryRatingSummaryLabel(story.reviewCount, story.ratingSum);
    const displayRating =
      story.reviewCount && story.ratingSum
        ? Math.round(story.ratingSum / story.reviewCount)
        : 0;
    const hasMyReview = reviews.some((r) => r.authorUid === uid);

    return (
      <section
        ref={!canUserWriteOnStory(story, uid) ? actionFormRef : undefined}
        className="flex flex-col gap-3 pt-2 border-t border-rk-amber-200/80"
      >
        <div>
          <h3 className="text-sm font-black text-rk-amber-950">みんなのレビュー</h3>
          <p className="text-xs text-rk-slate-600 mt-1 leading-relaxed">
            ★を選んで、よければひとこと書いて、<strong>確定ボタン</strong>で投稿します。
          </p>
        </div>

        {uid && authorProfile ? (
          <div className={`${cardClass} border-rk-violet-200 bg-rk-violet-50/40 px-4 py-3 flex flex-col gap-2`}>
            <p className="text-xs font-bold text-rk-violet-900">あなたのレビュー</p>
            <StarRatingRow value={reviewRating} onPick={setReviewRating} />
            <textarea
              className="w-full min-h-[88px] rounded-xl border border-rk-violet-200 px-3 py-2 text-sm leading-relaxed resize-y bg-rk-white"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              maxLength={RELAY_STORY_REVIEW_MAX_CHARS}
              placeholder="よかったところ、感じたこと（任意）"
            />
            <p className="text-[11px] text-rk-slate-500 text-right">
              {reviewText.length}/{RELAY_STORY_REVIEW_MAX_CHARS}
            </p>
            {reviewFormError ? <p className="text-sm text-rk-rose-700">{reviewFormError}</p> : null}
            <p className="text-xs font-bold text-center text-rk-violet-900">
              書き終えたら、このボタンで確定
            </p>
            <RK02PrimaryTouchButton
              type="button"
              className={`${btnPrimaryTouch} w-full text-base font-black`}
              disabled={reviewSubmitting}
              onClick={() => void submitReview()}
            >
              {reviewSubmitting
                ? '送信中…'
                : hasMyReview
                  ? 'レビューを確定して更新'
                  : 'レビューを確定して投稿'}
            </RK02PrimaryTouchButton>
          </div>
        ) : onGoogleLogin ? (
          <RK03GhostTouchButton type="button" className={btnGhostTouch} onClick={onGoogleLogin}>
            Google でログインしてレビューする
          </RK03GhostTouchButton>
        ) : null}

        {summary ? (
          <div className="flex items-center gap-2">
            <StarRatingRow value={displayRating} readonly size="sm" />
            <span className="text-xs font-bold text-rk-amber-900/85">{summary}</span>
          </div>
        ) : (
          <p className="text-xs text-rk-slate-500">まだレビューはありません。</p>
        )}

        {reviewsLoading ? (
          <p className="text-xs text-rk-slate-500 text-center py-2">レビューを読み込み中…</p>
        ) : reviews.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {reviews.map((review) => (
              <li
                key={review.id}
                className={`${cardClass} border-rk-amber-100 bg-rk-white/90 px-3 py-2.5 text-left`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rk-slate-700">
                    <span>{review.authorEmoji || '📖'}</span>
                    <span>{review.authorNick || '読者'}</span>
                  </div>
                  <StarRatingRow value={review.rating} readonly size="sm" />
                </div>
                {review.text ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-rk-slate-800 whitespace-pre-wrap break-words">
                    {review.text}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  };

  const renderPostingNotice = () => (
    <p className="text-[11px] leading-relaxed text-rk-slate-500">{RELAY_STORY_POSTING_NOTICE}</p>
  );

  const renderContinueForm = (story: RelayStory) => {
    const kind = relayStoryKindAtStep(story.currentStep);
    return (
      <section
        ref={actionFormRef}
        className={`${cardClass} border-rk-violet-200 bg-rk-violet-50/40 px-4 py-3 flex flex-col gap-2`}
      >
        <p className="text-sm font-bold text-rk-violet-900">
          「{kind}」を書く（{RELAY_STORY_MAX_CHARS}文字まで）
        </p>
        <p className="text-xs text-rk-slate-600 leading-relaxed">
          上の「これまでの話」を読みながら、続きを書いてください。書き終えたら<strong>確定ボタン</strong>で投稿します。
        </p>
        {authorProfile ? (
          <p className="text-xs text-rk-amber-900/75">
            投稿名: {authorProfile.authorEmoji} {authorProfile.authorNick}
          </p>
        ) : null}
        <textarea
          className="w-full min-h-[140px] rounded-xl border border-rk-violet-200 px-3 py-2 text-sm leading-relaxed resize-y bg-rk-white"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          maxLength={RELAY_STORY_MAX_CHARS}
          placeholder={`${kind}の一文…`}
        />
        <p className="text-[11px] text-rk-slate-500 text-right">
          {textInput.length}/{RELAY_STORY_MAX_CHARS}
        </p>
        {formError ? <p className="text-sm text-rk-rose-700">{formError}</p> : null}
        <RK02PrimaryTouchButton
          type="button"
          className={`${btnPrimaryTouch} w-full text-base font-black`}
          disabled={submitting}
          onClick={() => void submitContinue()}
        >
          {submitting ? '送信中…' : `「${kind}」を確定して投稿`}
        </RK02PrimaryTouchButton>
        {renderPostingNotice()}
      </section>
    );
  };

  const renderSegmentList = (
    story: RelayStory,
    revealAll: boolean,
    layout: 'full' | 'writeReference' = 'full',
  ) => {
    const segments = revealAll ? story.segments : visibleRelayStorySegments(story);
    const hiddenCount = story.status === 'open' ? Math.max(0, 4 - segments.length) : 0;
    const compact = layout === 'writeReference';
    return (
      <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
        {segments.map((seg, i) => (
          <article
            key={`${story.id}-${i}`}
            className={`${cardClass} border-rk-amber-200/80 bg-rk-amber-50/70 text-left ${
              compact ? 'px-3 py-2' : 'px-4 py-3'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-rk-amber-900/80">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-rk-amber-200/80">
                {seg.authorEmoji || '📖'}
              </span>
              <span>
                {seg.kind}（{RELAY_STORY_MAX_CHARS}文字まで）
              </span>
              <span className="font-medium text-rk-amber-950/70">{seg.authorNick || '匿名'}</span>
            </div>
            <p
              className={`mt-1.5 leading-relaxed text-rk-slate-900 whitespace-pre-wrap break-words ${
                compact ? 'text-xs' : 'text-sm'
              }`}
            >
              {seg.text}
            </p>
          </article>
        ))}
        {hiddenCount > 0 ? (
          <p className="text-center text-xs text-rk-amber-900/70 py-2">
            まだ {hiddenCount} 話は誰にも見えません。完結までお楽しみに。
          </p>
        ) : null}
      </div>
    );
  };

  const renderWriteReferencePanel = (story: RelayStory) => (
    <section
      aria-label="これまでの話"
      className="flex flex-col gap-2 shrink-0"
    >
      <p className="text-xs font-bold text-rk-amber-900/85 leading-relaxed">
        これまでの話（この枠の中を上下にスクロールできます）
      </p>
      <div className="max-h-[min(45vh,17.5rem)] overflow-y-auto overscroll-y-contain rounded-xl border border-rk-amber-300/70 bg-rk-amber-50/50 p-2 shadow-inner">
        {renderSegmentList(story, true, 'writeReference')}
      </div>
    </section>
  );

  const homeBody = (
    <>
      <div className="flex rounded-xl border border-rk-amber-300/60 bg-rk-white/80 p-1 gap-1">
        <button
          type="button"
          className={`flex-1 min-h-[40px] rounded-lg text-sm font-bold transition-colors ${
            tab === 'read' ? 'bg-rk-amber-400 text-rk-white shadow-sm' : 'text-rk-amber-950/80'
          }`}
          onClick={() => {
            vibrate(10);
            setTab('read');
          }}
        >
          読む
        </button>
        <button
          type="button"
          className={`flex-1 min-h-[40px] rounded-lg text-sm font-bold transition-colors ${
            tab === 'write' ? 'bg-rk-amber-400 text-rk-white shadow-sm' : 'text-rk-amber-950/80'
          }`}
          onClick={() => {
            vibrate(10);
            setTab('write');
          }}
        >
          つなぐ
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-rk-slate-600 text-center py-8">読み込み中…</p>
      ) : tab === 'read' ? (
        <div className="flex flex-col gap-4">
          {loadError ? (
            <div className="rounded-xl border border-rk-rose-200 bg-rk-rose-50/80 px-4 py-3 text-center space-y-2">
              <p className="text-sm text-rk-rose-800">{loadError}</p>
              <p className="text-xs text-rk-rose-900/75 leading-relaxed">
                読む一覧は後でもう一度試せます。「つなぐ」から「起」を書けます。
              </p>
              <RK02PrimaryTouchButton
                type="button"
                className={`${btnPrimaryTouch} w-full`}
                onClick={() => {
                  vibrate(10);
                  setTab('write');
                }}
              >
                つなぐ（書く）へ
              </RK02PrimaryTouchButton>
            </div>
          ) : null}
          {!loadError && completedStories.length === 0 && openStories.length === 0 ? (
            <p className="text-sm text-rk-slate-600 text-center py-6">
              まだ物語がありません。「つなぐ」から最初の「起」を書いてみてください。
            </p>
          ) : null}
          {openStories.length > 0 ? (
            <section>
              <h2 className="text-xs font-bold text-rk-amber-900/80 mb-2">書きかけ</h2>
              <ul className="flex flex-col gap-2">
                {openStories.map((story) => (
                  <li key={story.id}>
                    <button
                      type="button"
                      className={`${cardClass} w-full text-left px-4 py-3 border-rk-sky-200 bg-rk-sky-50/60 active:scale-[0.99] transition-transform`}
                      onClick={() => openRead(story)}
                    >
                      <p className="font-bold text-rk-slate-900">
                        {isTodayRelayPromptTitle(story.title) ? (
                          <span className="mr-1.5 inline-block rounded-full bg-rk-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-rk-amber-950/80 align-middle">
                            お題
                          </span>
                        ) : null}
                        {story.title}
                      </p>
                      <p className="text-xs text-rk-slate-600 mt-1">
                        {relayStoryProgressLabel(story.segments.length, false)} · あと
                        {4 - story.currentStep}話
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {completedStories.length > 0 ? (
            <section>
              <h2 className="text-xs font-bold text-rk-amber-900/80 mb-2">完結した物語</h2>
              <ul className="flex flex-col gap-2">
                {completedStories.map((story) => {
                  const ratingLabel = relayStoryRatingSummaryLabel(story.reviewCount, story.ratingSum);
                  return (
                  <li key={story.id}>
                    <button
                      type="button"
                      className={`${cardClass} w-full text-left px-4 py-3 border-rk-amber-200 bg-rk-amber-50/50 active:scale-[0.99] transition-transform`}
                      onClick={() => openRead(story)}
                    >
                      <p className="font-bold text-rk-slate-900">
                        {isTodayRelayPromptTitle(story.title) ? (
                          <span className="mr-1.5 inline-block rounded-full bg-rk-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-rk-amber-950/80 align-middle">
                            お題
                          </span>
                        ) : null}
                        {story.title}
                      </p>
                      <p className="text-xs text-rk-amber-800/80 mt-1">
                        完結 · 4話{ratingLabel ? ` · ${ratingLabel}` : ''}
                      </p>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {loadError ? (
            <p className="text-xs text-center text-rk-amber-900/70 leading-relaxed">
              一覧は読み込めませんでしたが、新しい物語の「起」は書けます。
            </p>
          ) : null}
          <RK02PrimaryTouchButton type="button" className={btnPrimaryTouch} onClick={openStart}>
            <PenLine className="size-4 shrink-0" aria-hidden />
            新しい物語をはじめる（起）
          </RK02PrimaryTouchButton>
          {!uid && onGoogleLogin ? (
            <RK03GhostTouchButton type="button" className={btnGhostTouch} onClick={onGoogleLogin}>
              Google でログイン
            </RK03GhostTouchButton>
          ) : null}
          <section>
            <h2 className="text-xs font-bold text-rk-amber-900/80 mb-2">続きを書ける物語</h2>
            {loadError ? (
              <p className="text-sm text-rk-slate-600 text-center py-4">
                一覧を読み込めないため、続きの物語は表示できません。
              </p>
            ) : writableStories.length === 0 ? (
              <p className="text-sm text-rk-slate-600 text-center py-4">
                いま書ける物語はありません。自分で「起」を書くか、あとでまた見てください。
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {writableStories.map((story) => (
                  <li key={story.id}>
                    <button
                      type="button"
                      className={`${cardClass} w-full text-left px-4 py-3 border-rk-violet-200 bg-rk-violet-50/50 active:scale-[0.99] transition-transform`}
                      onClick={() => openRead(story, true)}
                    >
                      <p className="font-bold text-rk-slate-900">
                        {isTodayRelayPromptTitle(story.title) ? (
                          <span className="mr-1.5 inline-block rounded-full bg-rk-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-rk-amber-950/80 align-middle">
                            お題
                          </span>
                        ) : null}
                        {story.title}
                      </p>
                      <p className="text-xs text-rk-violet-800/80 mt-1">
                        次は「{relayStoryKindAtStep(story.currentStep)}」を書けます（
                        {RELAY_STORY_MAX_CHARS}文字まで）
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );

  return (
    <div className={relayStoryImmersiveShell}>
      <header className={`${immersiveHeader} shrink-0 w-full`}>
        <RK19QuietRoomBackButton onClick={handleBackInner} />
        <div className={`${immersiveContentWidth} mx-auto pt-2 pb-4`}>
          <p className={immersiveKicker}>らくだ珈琲</p>
          <h1 className={immersiveTitle}>
            <BookOpen className="inline size-6 -mt-0.5 mr-1 text-rk-amber-700" aria-hidden />
            連続小説
          </h1>
          <p className={immersiveSubtitle}>
            {RELAY_STORY_CHAR_RULE_LABEL}の４話でひとつの物語。完結したら★とレビューでみんなに読んでもらえます。
          </p>
        </div>
      </header>

      <main
        className={`${immersiveContentWidth} w-full flex-1 min-h-0 overflow-y-auto overscroll-y-contain mx-auto px-4 pb-10 flex flex-col gap-4`}
      >
        {view === 'home' ? homeBody : null}

        {view === 'read' && selected ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-black text-rk-slate-900">{selected.title}</h2>
            {canUserWriteOnStory(selected, uid) ? (
              <>
                {renderWriteReferencePanel(selected)}
                {renderContinueForm(selected)}
              </>
            ) : (
              renderSegmentList(
                selected,
                selected.status === 'complete' || canUserWriteOnStory(selected, uid),
              )
            )}
            {selected.status === 'open' &&
            uid &&
            selected.participantUids.includes(uid) &&
            !canUserWriteOnStory(selected, uid) ? (
              <p className="text-sm text-center text-rk-amber-900/80 leading-relaxed px-2">
                この物語にはすでに参加しています。「
                {relayStoryKindAtStep(selected.currentStep)}」は別の方の番です。
              </p>
            ) : null}
            {selected.status === 'complete' ? renderReviewSection(selected) : null}
          </div>
        ) : null}

        {view === 'start' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-rk-slate-700">
              物語の<strong>起</strong>を書いてください。{RELAY_STORY_CHAR_RULE_LABEL}です。
            </p>
            {authorProfile ? (
              <p className="text-xs text-rk-amber-900/75">
                投稿名: {authorProfile.authorEmoji} {authorProfile.authorNick}
              </p>
            ) : null}
            <label className="text-xs font-bold text-rk-slate-600">
              タイトル（任意）
              <input
                className="mt-1 w-full rounded-xl border border-rk-amber-200 px-3 py-2 text-sm"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                maxLength={40}
                placeholder="空欄なら起の冒頭から"
              />
            </label>
            <label className="text-xs font-bold text-rk-slate-600">
              起（{RELAY_STORY_MAX_CHARS}文字まで）
              <textarea
                className="mt-1 w-full min-h-[140px] rounded-xl border border-rk-amber-200 px-3 py-2 text-sm leading-relaxed resize-y"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                maxLength={RELAY_STORY_MAX_CHARS}
                placeholder="むかしむかし…"
              />
            </label>
            <p className="text-[11px] text-rk-slate-500 text-right">
              {textInput.length}/{RELAY_STORY_MAX_CHARS}
            </p>
            {formError ? <p className="text-sm text-rk-rose-700">{formError}</p> : null}
            <p className="text-xs font-bold text-center text-rk-amber-900">
              書き終えたら、このボタンで確定
            </p>
            <RK02PrimaryTouchButton
              type="button"
              className={`${btnPrimaryTouch} w-full text-base font-black`}
              disabled={submitting}
              onClick={() => void submitStart()}
            >
              {submitting ? '送信中…' : '「起」を確定して投稿'}
            </RK02PrimaryTouchButton>
            {renderPostingNotice()}
          </div>
        ) : null}
      </main>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[900] max-w-[min(92vw,20rem)] rounded-xl bg-rk-slate-900/90 text-rk-white text-sm px-4 py-3 text-center shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
};

export default RelayStoryScreen;
