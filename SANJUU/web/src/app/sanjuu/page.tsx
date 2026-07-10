import SanjuuFromRakudaHub from '../../components/SanjuuFromRakudaHub';

/** `/sanjuu` 直リンク用ハブ。全体掲示板・水色の募集掲示板はらくだトップからのみ（このハブのナビには載せない） */
export default function SanjuuHubPage() {
  return <SanjuuFromRakudaHub heading="ひと言探し（らくだから）" />;
}
