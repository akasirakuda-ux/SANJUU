/**
 * 番号付き基準 UI — 置き換え用 React コンポーネント
 *
 * Cursor が作った同等 UI は、コメント `// was: …` のうえで RK-xx に差し替える。
 * カタログ: `partsRegistry.ts` / `baseline.md`
 */
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { RakudaHomeSquircleButton } from '../components/RakudaHomeSquircleButton';
import {
  badgeClass,
  btnGhostTouch,
  btnGhostTouchHalfH,
  btnGhostTouchHalfW,
  btnPrimaryTouch,
  btnPrimaryTouchHalfH,
  btnPrimaryTouchHalfW,
  cardClass,
  homeSquircleHalfSize,
  homeSquircleSize,
  hubMenuBtn,
  hubMenuBtnHalfH,
  hubMenuBtnHalfW,
  hubMenuBtnHalfWFill,
  immersiveContentHalfWidth,
  immersiveContentWidth,
  immersiveHeader,
  immersiveKicker,
  immersiveScreenShell,
  immersiveSubtitle,
  immersiveTitle,
  quietRoomBackBtn,
} from './policy';

// ── RK-01 ───────────────────────────────────────────────────

export interface RK01HubMenuRowProps {
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
  'aria-label'?: string;
  disabled?: boolean;
  /** 横並び 2 列で親幅いっぱい（オセロ下部ボタン等） */
  fill?: boolean;
}

/** RK-01 ハブ・メニュー行 */
export function RK01HubMenuRow({
  className = '',
  onClick,
  children,
  'aria-label': ariaLabel,
  disabled,
}: RK01HubMenuRowProps) {
  return (
    <button
      type="button"
      className={`${hubMenuBtn} ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// ── RK-02 / RK-03 ───────────────────────────────────────────

export type RK02PrimaryTouchButtonProps = React.ComponentPropsWithoutRef<'button'>;

/** RK-02 主 CTA（タッチ） */
export function RK02PrimaryTouchButton({
  className = '',
  children,
  type = 'button',
  ...rest
}: RK02PrimaryTouchButtonProps) {
  return (
    <button type={type} className={`${btnPrimaryTouch} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export type RK03GhostTouchButtonProps = React.ComponentPropsWithoutRef<'button'>;

/** RK-03 副 CTA（ゴースト） */
export function RK03GhostTouchButton({
  className = '',
  children,
  type = 'button',
  ...rest
}: RK03GhostTouchButtonProps) {
  return (
    <button type={type} className={`${btnGhostTouch} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

// ── RK-04 ───────────────────────────────────────────────────

export interface RK04HomeBackButtonProps {
  onClick: () => void;
  title?: string;
}

/** RK-04 ホーム戻る（スキュア） */
export function RK04HomeBackButton({ onClick, title }: RK04HomeBackButtonProps) {
  return (
    <RakudaHomeSquircleButton sizeClassName={homeSquircleSize} onClick={onClick} title={title} />
  );
}

// ── RK-05 / RK-06 / RK-10 ───────────────────────────────────

export interface RK05ImmersiveScreenProps {
  /** 例: `bg-gradient-to-b from-rk-success-100 … text-rk-slate-800` */
  themeClassName: string;
  children: React.ReactNode;
}

/** RK-05 没入画面シェル */
export function RK05ImmersiveScreen({ themeClassName, children }: RK05ImmersiveScreenProps) {
  return <div className={`${immersiveScreenShell} ${themeClassName}`.trim()}>{children}</div>;
}

export interface RK06ImmersiveHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack: () => void;
  kickerClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  /** false のとき上部「らくだ珈琲」行を出さない */
  showKicker?: boolean;
  /** 左上戻る。既定 RK-04、リバーシ等は RK-19 */
  backButton?: 'rk04' | 'rk19';
  backButtonTitle?: string;
}

/** RK-06 没入ヘッダ（三行＋ RK-04） */
export function RK06ImmersiveHeader({
  title,
  subtitle,
  onBack,
  kickerClassName = 'text-rk-slate-700/75',
  titleClassName = 'text-rk-slate-900',
  subtitleClassName = 'text-rk-slate-700/70',
  showKicker = true,
  backButton = 'rk04',
  backButtonTitle = 'もどる',
}: RK06ImmersiveHeaderProps) {
  return (
    <header className={immersiveHeader}>
      <div className="absolute left-0 top-0 z-10">
        {backButton === 'rk19' ? (
          <RK19QuietRoomBackButton onClick={onBack} title={backButtonTitle} />
        ) : (
          <RK04HomeBackButton onClick={onBack} title={backButtonTitle} />
        )}
      </div>
      {showKicker ? (
        <p className={`${immersiveKicker} ${kickerClassName}`.trim()}>らくだ珈琲</p>
      ) : null}
      <h1 className={`${immersiveTitle} ${titleClassName}`.trim()}>{title}</h1>
      {subtitle != null && subtitle !== '' ? (
        <p className={`${immersiveSubtitle} ${subtitleClassName}`.trim()}>{subtitle}</p>
      ) : null}
    </header>
  );
}

export interface RK10ContentColumnProps {
  className?: string;
  children: React.ReactNode;
}

/** RK-10 コンテンツ幅ラッパ（max-w-md） */
export function RK10ContentColumn({ className = '', children }: RK10ContentColumnProps) {
  return <div className={`${immersiveContentWidth} ${className}`.trim()}>{children}</div>;
}

// ── RK-07 / RK-08 ───────────────────────────────────────────

export interface RK07CardProps {
  className?: string;
  children: React.ReactNode;
}

/** RK-07 カード面 */
export function RK07Card({ className = '', children }: RK07CardProps) {
  return <div className={`${cardClass} ${className}`.trim()}>{children}</div>;
}

export interface RK08BadgeProps {
  className?: string;
  children: React.ReactNode;
}

/** RK-08 バッジ */
export function RK08Badge({ className = '', children }: RK08BadgeProps) {
  return <span className={`${badgeClass} ${className}`.trim()}>{children}</span>;
}

// ── 半幅 / 半高（RK-11 … RK-18） ─────────────────────────────

/** RK-11 主 CTA・半幅 */
export function RK11PrimaryTouchButtonHalfW({
  className = '',
  children,
  type = 'button',
  ...rest
}: RK02PrimaryTouchButtonProps) {
  return (
    <button type={type} className={`${btnPrimaryTouchHalfW} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

/** RK-12 主 CTA・半高 */
export function RK12PrimaryTouchButtonHalfH({
  className = '',
  children,
  type = 'button',
  ...rest
}: RK02PrimaryTouchButtonProps) {
  return (
    <button type={type} className={`${btnPrimaryTouchHalfH} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

/** RK-13 副 CTA・半幅 */
export function RK13GhostTouchButtonHalfW({
  className = '',
  children,
  type = 'button',
  ...rest
}: RK03GhostTouchButtonProps) {
  return (
    <button type={type} className={`${btnGhostTouchHalfW} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

/** RK-14 副 CTA・半高 */
export function RK14GhostTouchButtonHalfH({
  className = '',
  children,
  type = 'button',
  ...rest
}: RK03GhostTouchButtonProps) {
  return (
    <button type={type} className={`${btnGhostTouchHalfH} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export type RK01HubMenuRowHalfProps = RK01HubMenuRowProps;

/** RK-15 ハブ・メニュー行・半幅 */
export function RK15HubMenuRowHalfW({
  className = '',
  onClick,
  children,
  'aria-label': ariaLabel,
  disabled,
  fill = false,
}: RK01HubMenuRowHalfProps) {
  const base = fill ? hubMenuBtnHalfWFill : hubMenuBtnHalfW;
  return (
    <button
      type="button"
      className={`${base} ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** RK-16 ハブ・メニュー行・半高 */
export function RK16HubMenuRowHalfH({
  className = '',
  onClick,
  children,
  'aria-label': ariaLabel,
  disabled,
}: RK01HubMenuRowHalfProps) {
  return (
    <button
      type="button"
      className={`${hubMenuBtnHalfH} ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** RK-17 コンテンツ幅・半幅 */
export function RK17ContentColumnHalfW({ className = '', children }: RK10ContentColumnProps) {
  return <div className={`${immersiveContentHalfWidth} ${className}`.trim()}>{children}</div>;
}

/** RK-18 ホーム戻る・半サイズ */
export function RK18HomeBackButtonHalf({ onClick, title }: RK04HomeBackButtonProps) {
  return (
    <RakudaHomeSquircleButton
      sizeClassName={homeSquircleHalfSize}
      onClick={onClick}
      title={title}
      compact
    />
  );
}

export interface RK19QuietRoomBackButtonProps {
  onClick: () => void;
  title?: string;
}

/** RK-19 しずかの間・左上戻る（白角丸） */
export function RK19QuietRoomBackButton({ onClick, title = 'もどる' }: RK19QuietRoomBackButtonProps) {
  return (
    <button type="button" onClick={onClick} className={quietRoomBackBtn} aria-label={title} title={title}>
      <ChevronLeft size={32} strokeWidth={3} aria-hidden />
    </button>
  );
}
