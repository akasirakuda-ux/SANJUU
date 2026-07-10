import type { ReactNode } from 'react';
import './sanjuu-rk-theme.css';

export default function SanjuuSectionLayout({ children }: { children: ReactNode }) {
  return <div className="sj-rk-theme">{children}</div>;
}
