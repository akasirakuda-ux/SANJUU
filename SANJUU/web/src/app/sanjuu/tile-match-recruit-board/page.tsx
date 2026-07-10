import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** 旧「ペア探し」募集板 — ひと言探し募集板へリダイレクト */
export default async function SanjuuTileMatchRecruitBoardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') u.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => u.append(k, x));
  }
  const qs = u.toString();
  redirect(`/sanjuu/recruit-board${qs ? `?${qs}` : ''}`);
}
