import type { LogEntry } from '../types';
import type { GomokuHostRecord } from './gomokuRooms';

export function gomokuLogResult(log: LogEntry): 'win' | 'lose' | 'draw' | null {
  const details = log.details as { result?: string } | undefined;
  if (details?.result === 'win' || details?.result === 'lose' || details?.result === 'draw') {
    return details.result;
  }
  if (log.message.includes('勝ち')) return 'win';
  if (log.message.includes('負け')) return 'lose';
  if (log.message.includes('引き分け')) return 'draw';
  return null;
}

export function summarizeGomokuMatchResults(logs: LogEntry[]): {
  wins: number;
  losses: number;
  draws: number;
} {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const log of logs) {
    const result = gomokuLogResult(log);
    if (result === 'win') wins += 1;
    else if (result === 'lose') losses += 1;
    else if (result === 'draw') draws += 1;
  }
  return { wins, losses, draws };
}

export function buildGomokuHostRecord(logs: LogEntry[]): GomokuHostRecord {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let onlineWins = 0;
  let onlineLosses = 0;
  let onlineDraws = 0;
  for (const log of logs) {
    const result = gomokuLogResult(log);
    if (!result) continue;
    const details = log.details as { playKind?: string } | undefined;
    const online = details?.playKind === 'online';
    if (result === 'win') {
      wins += 1;
      if (online) onlineWins += 1;
    } else if (result === 'lose') {
      losses += 1;
      if (online) onlineLosses += 1;
    } else {
      draws += 1;
      if (online) onlineDraws += 1;
    }
  }
  return { wins, losses, draws, onlineWins, onlineLosses, onlineDraws };
}

export function gomokuHostRecordSummaryJa(record: GomokuHostRecord | undefined): string {
  if (!record) return '戦績不明';
  const { wins, losses, draws, onlineWins, onlineLosses, onlineDraws } = record;
  const allTotal = wins + losses + draws;
  const onlineTotal = onlineWins + onlineLosses + onlineDraws;
  if (allTotal === 0) return '記録なし';
  if (onlineTotal === 0) {
    return `全体 ${wins}勝${losses}敗${draws > 0 ? `${draws}分` : ''}（オンライン未プレイ）`;
  }
  return `全体 ${wins}勝${losses}敗 · オンライン ${onlineWins}勝${onlineLosses}敗`;
}

export function gomokuHostStrengthHintJa(record: GomokuHostRecord | undefined): string {
  if (!record) return '';
  const onlineTotal = record.onlineWins + record.onlineLosses + record.onlineDraws;
  if (onlineTotal === 0) {
    const all = record.wins + record.losses + record.draws;
    if (all === 0) return 'はじめての方かも';
    return 'オンラインは未記録';
  }
  if (onlineTotal < 3) return 'オンライン少なめ';
  const rate = record.onlineWins / onlineTotal;
  if (rate >= 0.65) return 'やや強め';
  if (rate <= 0.35) return 'ゆったり';
  return '普通';
}
