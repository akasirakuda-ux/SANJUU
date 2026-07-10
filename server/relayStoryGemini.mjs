/**
 * 連続小説「今日のお題」— Gemini で「起」を生成（サーバー専用）
 */
import { GoogleGenAI } from '@google/genai';

export const RELAY_PROMPT_GENRES = [
  'ミステリー',
  '学園',
  'スポーツ',
  'ファンタジー',
  'SF',
  'ほのぼの',
  '動物',
  '季節',
];

export const RELAY_PROMPT_MAX_CHARS = 200;

const MODEL = 'gemini-2.5-flash';

/** 子ども向けに避ける語（部分一致） */
const FORBIDDEN_FRAGMENTS = [
  '死',
  '殺',
  '血',
  '暴力',
  '銃',
  'ナイフ',
  '自殺',
  'いじめ',
  'セックス',
  'エロ',
  '裸',
  'おっぱい',
  'チン',
  'マン',
];

/** AI Studio からのコピーで全角括弧などが混ざることがある */
function sanitizeGeminiApiKey(raw) {
  let s = String(raw ?? '').trim();
  s = s.replace(/^[\s"'「『（(\[]+|[\s"'」』）)\]]+$/g, '').trim();
  return s.replace(/[^\x21-\x7E]/g, '');
}

function readGeminiApiKey() {
  const key = sanitizeGeminiApiKey(process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_2 ?? '');
  return key;
}

export function pickRelayPromptGenre(dateKey) {
  const key = String(dateKey ?? '').trim() || '1970-01-01';
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return RELAY_PROMPT_GENRES[Math.abs(h) % RELAY_PROMPT_GENRES.length];
}

export function todayKeyJst(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function normalizeGeneratedText(raw) {
  let t = String(raw ?? '').trim();
  t = t.replace(/^["「『]+|["」』]+$/g, '').trim();
  t = t.replace(/\s+/g, '');
  return t;
}

export function validateRelayPromptText(text) {
  const t = normalizeGeneratedText(text);
  if (!t) return { ok: false, reason: 'empty' };
  const len = [...t].length;
  if (len < 30) return { ok: false, reason: 'too_short', length: len };
  if (len > RELAY_PROMPT_MAX_CHARS) return { ok: false, reason: 'too_long', length: len };
  for (const frag of FORBIDDEN_FRAGMENTS) {
    if (t.includes(frag)) return { ok: false, reason: 'forbidden', fragment: frag };
  }
  return { ok: true, text: t, length: len };
}

function buildPrompt(genre) {
  return `あなたは子ども向けサイト「らくだ珈琲」の連続小説の公式お題担当です。
ジャンル「${genre}」の物語の「起」（冒頭）だけを、日本語で書いてください。

【ルール】
- ${RELAY_PROMPT_MAX_CHARS}文字以内（句読点含む。超えないこと）
- 1段落・地の文のみ（タイトル・見出し・「起：」などのラベルは不要）
- 小学生が読めるやさしい言葉
- 子どもが安心して読める内容（暴力・恐怖の強調・恋愛の露骨な描写・差別は避ける）
- ミステリーでも怖すぎない、ほのぼのな不安さまで
- 次の参加者が「承」を書きやすい、余韻のある終わり方

本文だけを出力してください。`;
}

/**
 * @returns {Promise<{ text: string, length: number, attempts: number } | { error: string }>}
 */
export async function generateRelayStoryOpening(genre) {
  const apiKey = readGeminiApiKey();
  if (!apiKey) return { error: 'gemini_not_configured' };

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(genre);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: attempt === 1 ? prompt : `${prompt}\n\n前回は文字数または内容が不適切でした。必ず${RELAY_PROMPT_MAX_CHARS}字以内で、よりやさしく書き直してください。`,
        config: {
          maxOutputTokens: 512,
          temperature: attempt === 1 ? 0.85 : 0.6,
        },
      });
      const validated = validateRelayPromptText(response.text);
      if (validated.ok) {
        return { text: validated.text, length: validated.length, attempts: attempt };
      }
      console.warn('[relayStoryGemini] validation failed', { genre, attempt, reason: validated.reason });
    } catch (e) {
      console.error('[relayStoryGemini] generate failed', { genre, attempt, message: e?.message ?? e });
      if (attempt === 2) return { error: 'gemini_api_error' };
    }
  }

  return { error: 'generation_failed' };
}
