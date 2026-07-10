/** らくだ珈琲ハブ・連絡帳まわりで共有： PLAYER 番号プリセット用 */

export const RAKUDA_DEFAULT_PROFILE_EMOJI = '👤';

/** 教室想定で 1〜30（三十の満員に合わせる） */
export const RAKUDA_PLAYER_PRESET_COUNT = 30;

export function rakudaPlayerPresetNickname(index1Based: number): string {
  return `PLAYER${index1Based}`;
}
