import React from 'react';

/**
 * 本文中の `@なまえ` を青色で表示（改行はそのまま）
 */
const MentionText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const lines = text.split('\n');
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 ? '\n' : null}
          <LineWithMentions line={line} />
        </React.Fragment>
      ))}
    </span>
  );
};

function LineWithMentions({ line }: { line: string }) {
  const parts = line.split(/(@[^\s@]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-rk-sky-600 font-semibold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default MentionText;
