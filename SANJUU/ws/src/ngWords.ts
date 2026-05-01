// MVP: 最低限のフィルタ（必要に応じて拡張）
export const NG_WORDS = [
  '住所',
  '電話',
  'LINE',
  'メール',
  '学校',
  '本名',
  '個人情報',
  '殺',
  '死',
];

export function hasNgWord(input: string): boolean {
  const s = String(input ?? '').toLowerCase();
  return NG_WORDS.some((w) => s.includes(w.toLowerCase()));
}

