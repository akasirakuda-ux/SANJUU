/** 放置検知 — スライドパズル応援モードと同じ 5 分（DEV は短縮） */
export const KOTOBA_ROBO_IDLE_ARM_MS = 5 * 60 * 1000;

/** ロボが次の正解を見つけるまでの最短・最長（粛々と、メトロノーム感を避ける） */
export const KOTOBA_ROBO_FIND_MIN_MS = 8_000;
export const KOTOBA_ROBO_FIND_MAX_MS = 18_000;

export function getKotobaRoboIdleArmMs(): number {
  return import.meta.env.DEV ? 20_000 : KOTOBA_ROBO_IDLE_ARM_MS;
}

export function pickKotobaRoboFindDelayMs(): number {
  const span = KOTOBA_ROBO_FIND_MAX_MS - KOTOBA_ROBO_FIND_MIN_MS;
  return KOTOBA_ROBO_FIND_MIN_MS + Math.floor(Math.random() * (span + 1));
}
