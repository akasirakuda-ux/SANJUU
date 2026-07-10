/**
 * AdSense サイト審査（rakuda.coffee / pub-7642612812471632）向け。
 * 審査通過後に `VITE_ADSENSE_SITE_APPROVED=1` をビルドへ入れてから全面広告プレースホルダー／実広告を有効化する。
 */
export function isAdsenseSiteApprovedForGateAds(): boolean {
  return import.meta.env.VITE_ADSENSE_SITE_APPROVED === '1';
}
