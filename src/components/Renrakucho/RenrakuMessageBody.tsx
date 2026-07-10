import React from 'react';
import MentionText from './MentionText';

type RenrakuMessageBodyProps = {
  text: string;
  className?: string;
};

/** 掲示板本文 — サイト全体の select-none を上書きしてドラッグ選択・コピー可能にする */
const RenrakuMessageBody: React.FC<RenrakuMessageBodyProps> = ({
  text,
  className = 'text-xs leading-relaxed whitespace-pre-wrap text-rk-slate-700',
}) => (
  <p className={`rk-board-message-text ${className}`}>
    <MentionText text={String(text ?? '')} />
  </p>
);

export default RenrakuMessageBody;
