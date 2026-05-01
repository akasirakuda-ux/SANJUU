import React from 'react';

export type SanjuuBrandHeadingProps = {
  /** ページ先頭は h1、連絡帳内セクションは h2 推奨 */
  as?: 'h1' | 'h2';
};

/**
 * 30SANJUU ブランド見出し（ことば探し系と同じ M PLUS Rounded、text-3xl / font-bold）
 */
const SanjuuBrandHeading: React.FC<SanjuuBrandHeadingProps> = ({ as: Tag = 'h1' }) => {
  return (
    <Tag className="text-3xl font-bold text-center text-blue-500 mb-6 font-[family-name:var(--font-rounded)]">
      【30SANJUU】
    </Tag>
  );
};

export default SanjuuBrandHeading;
