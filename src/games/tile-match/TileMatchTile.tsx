import React from 'react';
import { tileCardSuitForSymbol } from '../../lib/tileMatch/cardSymbol';
import styles from './TileMatchTile.module.css';

export type TileMatchTileVisualState = 'free' | 'blocked' | 'selected' | 'hinted';

interface TileMatchTileProps {
  symbol: string;
  width: number;
  height: number;
  left: number;
  top: number;
  zIndex: number;
  state: TileMatchTileVisualState;
  disabled: boolean;
  ariaLabel: string;
  onClick: () => void;
}

const TileMatchTile: React.FC<TileMatchTileProps> = ({
  symbol,
  width,
  height,
  left,
  top,
  zIndex,
  state,
  disabled,
  ariaLabel,
  onClick,
}) => {
  const suit = tileCardSuitForSymbol(symbol);
  const cornerSize = Math.max(9, Math.round(Math.min(width, height) * 0.22));
  const centerSize = Math.max(14, Math.round(Math.min(width, height) * 0.46));

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={[styles.root, styles[state], styles[suit]].join(' ')}
      style={{
        left,
        top,
        width,
        height,
        zIndex,
        ['--tm-w' as string]: `${width}px`,
        ['--tm-h' as string]: `${height}px`,
        ['--tm-corner' as string]: `${cornerSize}px`,
        ['--tm-center' as string]: `${centerSize}px`,
      }}
    >
      <span className={styles.card} style={{ width, height }}>
        <span className={styles.cornerTop} aria-hidden>
          {symbol}
        </span>
        <span className={styles.center} aria-hidden>
          {symbol}
        </span>
        <span className={styles.cornerBottom} aria-hidden>
          {symbol}
        </span>
      </span>
    </button>
  );
};

export default TileMatchTile;
