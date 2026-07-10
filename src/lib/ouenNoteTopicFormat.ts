import type { OuenNoteTopic } from './ouenNoteClient';
import { OUEN_NOTE_FIELD_LIMITS } from './ouenNoteConfig';

export type OuenNoteTopicDraft = {
  title: string;
  consultantProfile: string;
  goal: string;
  situation: string;
  feelings: string;
  triedResearch: string;
  postNick: string;
  postEmoji: string;
};

export const OUEN_NOTE_FORM_SECTIONS: Array<{
  key: keyof Omit<OuenNoteTopicDraft, 'postNick' | 'postEmoji'>;
  label: string;
  hint: string;
  rows: number;
  required?: boolean;
}> = [
  {
    key: 'title',
    label: '1. 相談のタイトル',
    hint: '例：サイトの使い方で困っている、友だちとのことで悩んでいる',
    rows: 2,
    required: true,
  },
  {
    key: 'consultantProfile',
    label: '2. 相談者の年齢・性別・ご職業',
    hint: '例：30代・女性・パート。書きたくない部分は「非公開」でOK',
    rows: 2,
  },
  {
    key: 'goal',
    label: '3. 相談のゴール（どうしたいか）',
    hint: '例：落ち着いて次に何をすればいいか整理したい',
    rows: 3,
  },
  {
    key: 'situation',
    label: '4. 現在の状況・事実（何が起きているか）',
    hint: 'いつ・どこで・誰が・何をしたか。事実ベースで',
    rows: 4,
  },
  {
    key: 'feelings',
    label: '5. 自分の気持ち・考え',
    hint: 'どう感じているか、どうしたいか',
    rows: 4,
  },
  {
    key: 'triedResearch',
    label: '6. これまでに試したこと・調べたこと',
    hint: 'すでに試したこと、参考にした情報（なければ「まだない」でOK）',
    rows: 3,
  },
];

export function emptyOuenNoteDraft(defaultNick: string, defaultEmoji: string): OuenNoteTopicDraft {
  return {
    title: '',
    consultantProfile: '',
    goal: '',
    situation: '',
    feelings: '',
    triedResearch: '',
    postNick: defaultNick,
    postEmoji: defaultEmoji || '🐫',
  };
}

/** 年齢・性別・職業（書き方自由）→ 項目2用の1行 */
export function formatConsultantProfileFromParts(parts: {
  ageText?: string;
  genderText?: string;
  occupationText?: string;
}): string {
  const segments = [parts.ageText, parts.genderText, parts.occupationText]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  return segments.join('・');
}

export function clipOuenNoteDraft(draft: OuenNoteTopicDraft): OuenNoteTopicDraft {
  return {
    title: draft.title.slice(0, OUEN_NOTE_FIELD_LIMITS.title),
    consultantProfile: draft.consultantProfile.slice(0, OUEN_NOTE_FIELD_LIMITS.consultantProfile),
    goal: draft.goal.slice(0, OUEN_NOTE_FIELD_LIMITS.goal),
    situation: draft.situation.slice(0, OUEN_NOTE_FIELD_LIMITS.situation),
    feelings: draft.feelings.slice(0, OUEN_NOTE_FIELD_LIMITS.feelings),
    triedResearch: draft.triedResearch.slice(0, OUEN_NOTE_FIELD_LIMITS.triedResearch),
    postNick: draft.postNick.slice(0, OUEN_NOTE_FIELD_LIMITS.postNick),
    postEmoji: draft.postEmoji.slice(0, OUEN_NOTE_FIELD_LIMITS.postEmoji) || '🐫',
  };
}

/** Firestore 保存用 — 一覧・検索・旧クライアント向けに本文も残す */
export function composeOuenNoteBody(draft: OuenNoteTopicDraft): string {
  const d = clipOuenNoteDraft(draft);
  const blocks: string[] = [];
  if (d.title.trim()) blocks.push(`【${d.title.trim()}】`);
  if (d.consultantProfile.trim()) blocks.push(`■ 相談者\n${d.consultantProfile.trim()}`);
  if (d.goal.trim()) blocks.push(`■ ゴール\n${d.goal.trim()}`);
  if (d.situation.trim()) blocks.push(`■ 状況・事実\n${d.situation.trim()}`);
  if (d.feelings.trim()) blocks.push(`■ 気持ち・考え\n${d.feelings.trim()}`);
  if (d.triedResearch.trim()) blocks.push(`■ 試したこと・調べたこと\n${d.triedResearch.trim()}`);
  return blocks.join('\n\n').trim();
}

export function topicListTitle(topic: OuenNoteTopic): string {
  const t = (topic.title || '').trim();
  if (t) return t;
  const body = (topic.body || '').trim();
  const first = body.split('\n')[0]?.replace(/^【|】$/g, '').trim();
  return first || body.slice(0, 48) || '（無題）';
}

export function topicListPreview(topic: OuenNoteTopic): string {
  const parts = [topic.goal, topic.situation, topic.feelings]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  if (parts.length > 0) return parts[0].slice(0, 120);
  const body = (topic.body || '').trim();
  if (body.startsWith('【')) {
    const rest = body.split('\n\n').slice(1).join(' ').trim();
    return rest.slice(0, 120);
  }
  return body.slice(0, 120);
}

export type OuenNoteDisplaySection = { label: string; text: string };

export function topicDisplaySections(topic: OuenNoteTopic): OuenNoteDisplaySection[] {
  const rows: OuenNoteDisplaySection[] = [];
  const push = (label: string, text?: string) => {
    const t = (text || '').trim();
    if (t) rows.push({ label, text: t });
  };
  push('相談のタイトル', topic.title);
  push('相談者', topic.consultantProfile);
  push('ゴール', topic.goal);
  push('状況・事実', topic.situation);
  push('気持ち・考え', topic.feelings);
  push('試したこと・調べたこと', topic.triedResearch);
  if (rows.length === 0 && topic.body.trim()) {
    rows.push({ label: '相談内容', text: topic.body.trim() });
  }
  return rows;
}

export function topicCommentCount(topic: OuenNoteTopic, liveCount?: number): number {
  if (typeof liveCount === 'number') return liveCount;
  return typeof topic.commentCount === 'number' ? topic.commentCount : 0;
}
