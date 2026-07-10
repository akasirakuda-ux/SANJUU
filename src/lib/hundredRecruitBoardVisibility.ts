import { isRoboLoungeRoundComplete } from './roboPickupLoungeFound';
import { isRoboPickupLoungeRecruit } from './roboPickupLoungeConfig';

export type RoboLoungeBoardRoomMeta = {
  foundWords?: unknown;
  words?: unknown;
  placedWords?: unknown;
  problemsGenerating?: boolean;
};

/** らくだロボ常設 — お題クリア後・次のお題準備中は募集一覧から外す */
export function shouldHideRoboPickupLoungeFromRecruitBoard(
  item: { roboPickupLounge?: boolean; roomId?: string },
  room: RoboLoungeBoardRoomMeta | undefined,
): boolean {
  if (!isRoboPickupLoungeRecruit(item)) return false;
  if (!room) return false;
  if (room.problemsGenerating === true) return true;
  return isRoboLoungeRoundComplete(room.foundWords, room.words ?? room.placedWords);
}
