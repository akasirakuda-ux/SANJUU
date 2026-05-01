/**
 * 広告管理サービス
 * 将来的に Google AdMob などの SDK を導入する際、
 * このファイルを書き換えるだけで済むように設計しています。
 */
export const adService = {
  /**
   * 全面広告（インタースティシャル広告）を表示する
   * @returns 表示に成功したかどうか
   */
  showInterstitial: async (): Promise<boolean> => {
    if (import.meta.env.DEV) {
      console.log('[AD_SERVICE] 全面広告の表示リクエストを受け取りました。');
    }
    
    // 将来の実装例:
    // if (window.AdMob) {
    //   await window.AdMob.showInterstitial();
    //   return true;
    // }
    
    return true; // 現状はプレースホルダーを表示するため常に true
  },

  /**
   * バナー広告のユニットIDなどを管理
   */
  config: {
    bannerId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
    interstitialId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
  }
};
