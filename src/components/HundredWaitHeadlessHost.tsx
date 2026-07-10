import React, { useCallback } from 'react';
import type { HundredPublicRecruit } from './Renrakucho/types';
import HundredWaitPanel from './Renrakucho/hundred/HundredWaitPanel';
import type { HundredStartOpts } from '../lib/tileMatch/config';
import type {
  HundredWaitHeadlessController,
  HundredWaitHeadlessState,
} from '../lib/hundredWaitHeadless';
import { clearHundredRestoreSession } from '../lib/rakudaHundredRestore';

const HundredWaitHeadlessHost: React.FC<{
  recruit: HundredPublicRecruit;
  nickname: string;
  userEmoji: string;
  currentUid: string | undefined;
  streamMode?: boolean;
  onStartHundred: (roomId: string, opts?: HundredStartOpts) => void | Promise<boolean>;
  onHeadlessState: (state: HundredWaitHeadlessState) => void;
  onHeadlessController: (controller: HundredWaitHeadlessController | null) => void;
  onCloseRecruitment?: () => void | Promise<void>;
  onGenerationCancelled?: () => void;
  onSessionEnded?: () => void;
}> = ({
  recruit,
  nickname,
  userEmoji,
  currentUid,
  streamMode = false,
  onStartHundred,
  onHeadlessState,
  onHeadlessController,
  onCloseRecruitment,
  onGenerationCancelled,
  onSessionEnded,
}) => {
  const handleBack = useCallback(() => {
    clearHundredRestoreSession();
    onSessionEnded?.();
  }, [onSessionEnded]);

  const handleGuestClosed = useCallback(() => {
    clearHundredRestoreSession();
    onSessionEnded?.();
  }, [onSessionEnded]);

  return (
    <HundredWaitPanel
      headless
      selectedHundred={recruit}
      nickname={nickname}
      userEmoji={userEmoji}
      currentUid={currentUid}
      streamMode={streamMode}
      onBack={handleBack}
      onStartHundred={onStartHundred}
      onGenerationCancelled={onGenerationCancelled}
      onCloseRecruitment={onCloseRecruitment}
      onGuestRecruitmentClosed={handleGuestClosed}
      onHeadlessState={onHeadlessState}
      onHeadlessController={onHeadlessController}
    />
  );
};

export default HundredWaitHeadlessHost;
