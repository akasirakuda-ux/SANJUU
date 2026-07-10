import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }

  async getWordExplanation(word: string, language: 'ja' | 'en'): Promise<string> {
    try {
      const prompt = language === 'ja' 
        ? `「${word}」という言葉について、小学生でもわかるように、短いおもしろ雑学か、ひとこと説明を1行（50文字以内）で教えてください。
           【重要】公序良俗に反する内容、性的な描写、暴力的な表現は一切含めないでください。子供向けの安全な内容にしてください。`
        : `Provide a very short (max 100 characters) interesting fact or explanation about the word "${word}" that a child could understand.
           [IMPORTANT] Do not include any inappropriate, sexual, or violent content. Keep it safe for children.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 100,
          temperature: 0.7,
        }
      });

      return response.text || (language === 'ja' ? '説明が見つかりませんでした。' : 'No explanation found.');
    } catch (error) {
      console.error("Gemini API Error:", error);
      return language === 'ja' ? '通信エラーが発生しました。' : 'Connection error occurred.';
    }
  }

  async getGameNarration(state: {
    role: 'host' | 'client';
    status: 'WAITING' | 'START' | 'PLAYING' | 'END';
    participants: { name: string; score: number }[];
    seed: string;
    lastFoundWord?: string;
    lastFoundBy?: string;
  }, language: 'ja' | 'en'): Promise<string> {
    try {
      const isJa = language === 'ja';
      const roleText = state.role === 'host' ? 'ホスト（進行役）' : 'クライアント（参加者）';
      
      let prompt = `あなたは「ことば探し Pro」というゲームの進行役（ナレーター）です。
現在のゲーム状況に基づいて、プレイヤーを盛り上げる短い実況セリフ（1行、50文字以内）を生成してください。
あなたは状態を保持しません。渡された情報のみを見て、適切な返事をしてください。

【状況】
役割: ${roleText}
ステータス: ${state.status}
参加者: ${state.participants.map(p => `${p.name}(${p.score}pt)`).join(', ')}
シード値: ${state.seed}
${state.lastFoundWord ? `直前に見つかった単語: ${state.lastFoundWord} (見つけた人: ${state.lastFoundBy})` : ''}

【指示】
- WAITING: 参加者を待っている状況。人数に応じてコメント。
- START: ゲーム開始の合図。カウントダウンや期待感を煽る。
- PLAYING: 進行状況やスコアに言及。誰かが単語を見つけたら褒める。
- END: 結果発表。優勝者を称える。
- キャラクター: 親しみやすく、少しユーモアのあるラクダのキャラクター（🐫）として話してください。
- 言語: ${isJa ? '日本語' : 'English'}
- 【重要】公序良俗に反する内容は一切含めないでください。`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 100,
          temperature: 0.8,
        }
      });

      return response.text || '';
    } catch (error) {
      console.error("Narration Error:", error);
      return '';
    }
  }
}

export const geminiService = new GeminiService();
