import React, { useCallback } from 'react';
import type { HundredPublicRecruit, HundredRoomListMeta, RenrakuchoPublicScreenState } from './types';
import HundredCreate from '../HundredCreate';
import HundredDetailPanel from './hundred/HundredDetailPanel';
import HundredWaitPanel from './hundred/HundredWaitPanel';
import HundredBoardPanel from './hundred/HundredBoardPanel';

const HundredFlow: React.FC<{
  publicScreen: string;
  selectedHundred: HundredPublicRecruit | null;
  setSelectedHundred: React.Dispatch<React.SetStateAction<HundredPublicRecruit | null>>;
  nickname: string;
  userEmoji: string;
  currentUid: string | undefined;
  isAdmin: boolean;
  setPublicScreen: React.Dispatch<React.SetStateAction<RenrakuchoPublicScreenState>>;
  onStartHundred: (roomId: string) => void;
  /** 配信/低負荷モード（YouTube Live 安定化用） */
  streamMode?: boolean;
  onCloseHundredRecruitment: () => void | Promise<void>;
  /** ホストが問題生成キャンセルで募集を閉じたとき（一覧へ戻す） */
  onHundredGenerationCancelled?: () => void;
  hundredRoomMetaByRoomId: Record<string, HundredRoomListMeta>;
  nowMs: number;
}> = ({
  publicScreen,
  selectedHundred,
  setSelectedHundred,
  nickname,
  userEmoji,
  currentUid,
  isAdmin,
  setPublicScreen,
  onStartHundred,
  streamMode = false,
  onCloseHundredRecruitment,
  onHundredGenerationCancelled,
  hundredRoomMetaByRoomId,
  nowMs,
}) => {
  const onGuestRecruitmentClosed = useCallback(() => {
    setPublicScreen('closed');
  }, [setPublicScreen]);

  return (
    <>
      {publicScreen === 'hundred-create' && (
        <HundredCreate
          hostNickname={nickname}
          hostEmoji={userEmoji}
          isAdmin={isAdmin}
          onCreated={({ id, roomId, targetWord, boardSize, hostUid, recruitDeadlineAt }) => {
            const display = (nickname || '').trim() || 'ホスト';
            setSelectedHundred({
              id,
              roomId,
              targetWord,
              boardSize,
              hostUid,
              gameTimeLimitSec: 0,
              recruitDeadlineAt,
              type: 'hundred',
              hostNickname: display,
              hostEmoji: (userEmoji || '').trim() || '🐫',
              createdAt: null as unknown as HundredPublicRecruit['createdAt'],
            });
            // 募集直後に画面を閉じず、既存の待機ロビー（HundredWaitPanel）へ。
            // hundred_public / hundred_rooms / recruitDeadlineAt / problemsGenerating の流れは変更しない。
            setPublicScreen('hundred-wait');
          }}
        />
      )}

      {publicScreen === 'hundred-detail' && selectedHundred && (
        <HundredDetailPanel
          selectedHundred={selectedHundred}
          currentUid={currentUid}
          roomMeta={selectedHundred.roomId ? hundredRoomMetaByRoomId[selectedHundred.roomId] : undefined}
          nowMs={nowMs}
          onBack={() => setPublicScreen('list')}
          onGoWait={() => setPublicScreen('hundred-wait')}
          onGoBoard={() => setPublicScreen('hundred-board')}
          onCloseHundredRecruitment={onCloseHundredRecruitment}
          onGuestRecruitmentClosed={onGuestRecruitmentClosed}
        />
      )}

      {publicScreen === 'hundred-wait' && selectedHundred && (
        <HundredWaitPanel
          selectedHundred={selectedHundred}
          nickname={nickname}
          userEmoji={userEmoji}
          currentUid={currentUid}
          streamMode={streamMode}
          onBack={() => setPublicScreen('list')}
          onStartHundred={onStartHundred}
          onGenerationCancelled={onHundredGenerationCancelled}
          onCloseRecruitment={onCloseHundredRecruitment}
        />
      )}

      {publicScreen === 'hundred-board' && selectedHundred && (
        <HundredBoardPanel
          selectedHundred={selectedHundred}
          streamMode={streamMode}
          onBack={() => setPublicScreen('list')}
          onStartHundred={onStartHundred}
          onGenerationCancelled={onHundredGenerationCancelled}
        />
      )}
    </>
  );
};

export default HundredFlow;
