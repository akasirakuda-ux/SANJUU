import type { ReactNode } from 'react';
import '../sanjuu/sanjuu-rk-theme.css';

/** らくだ入口トーンに合わせる（docs/rakuda-ui-spine.md の RK パス） */
export default function PlaySectionLayout({ children }: { children: ReactNode }) {
  return <div className="sj-rk-theme">{children}</div>;
}
