import React, { useEffect, useState } from 'react';
import { subscribeIdleArmProgress } from '../lib/rakudaIdleArm';

type RakudaIdleArmGaugeProps = {
  hidden?: boolean;
};

/**
 * 操作がないあいだ 5 分（DEV は 20 秒）で右へ伸びる極細ゲージ。
 * 満タン時の処理は {@link subscribeIdleArmComplete}（AppShell / 応援モード）が担当。
 */
const RakudaIdleArmGauge: React.FC<RakudaIdleArmGaugeProps> = ({ hidden = false }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (hidden) {
      setProgress(0);
      return;
    }
    return subscribeIdleArmProgress(setProgress);
  }, [hidden]);

  if (hidden) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2000] h-[1.5px]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-rk-violet-100 opacity-100" />
      <div
        className="absolute inset-y-0 left-0 bg-rk-violet-500 opacity-100 transition-[width] duration-500 ease-linear"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
};

export default RakudaIdleArmGauge;
