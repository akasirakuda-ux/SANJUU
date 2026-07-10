import React from 'react';

export type SanjuuBrandHeadingProps = {
  /** ページ先頭は h1、連絡帳内セクションは h2 推奨 */
  as?: 'h1' | 'h2';
};

/**
 * ひと言探し（みんなで）ブランド見出し（らくだの丸ゴシック `--font-rounded` に合わせる）
 */
const SanjuuBrandHeading: React.FC<SanjuuBrandHeadingProps> = ({ as: Tag = 'h1' }) => {
  return (
    <Tag className="text-3xl font-bold text-center text-rk-blue-500 mb-4 font-[family-name:var(--font-rounded)]">
      【ひと言探し】
    </Tag>
  );
};

export default SanjuuBrandHeading;
