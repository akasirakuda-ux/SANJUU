import React, { useCallback } from 'react';
import type { HundredPublicRecruit, HundredRoomListMeta, RenrakuchoPublicScreenState } from './types';
import HundredDetailPanel from './hundred/HundredDetailPanel';
import HundredWaitPanel from './hundred/HundredWaitPanel';
import HundredBoardPanel from './hundred/HundredBoardPanel';

const HundredFlow: React.FC<{
  publicScreen: string;
  selectedHundred: HundredPublicRecruit | null;
  nickname: string;
  userEmoji: string;
  currentUid: string | undefined;
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
  nickname,
  userEmoji,
  currentUid,
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
