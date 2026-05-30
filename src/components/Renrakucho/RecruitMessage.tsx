import React, { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { btnAccent } from '../../ui/policy';
import { firestoreLikeToMillis, formatFirestoreTimeJa, RENRAKU_RECRUIT_TTL_MS } from '../../lib/rakudaHubShell';
import type { Message } from './types';
import RenrakuReportButton from './RenrakuReportButton';
import RenrakuMessageBody from './RenrakuMessageBody';
import RenrakuCopyTextButton from './RenrakuCopyTextButton';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../lib/rakudaGate';
import { renrakuBoardPostElementId } from '../../lib/renrakuReport';

const RecruitMessage: React.FC<{
  msg: Message;
  isAdmin: boolean;
  currentUid?: string;
  isInteractionBlocked?: boolean;
  onDelete: () => void;
  onJoinRoom?: (rid: string) => void;
}> = ({ msg, isAdmin, currentUid, isInteractionBlocked, onDelete, onJoinRoom }) => {
  const [isExpired, setIsExpired] = useState(false);
  const [roomStatus, setRoomStatus] = useState<string | null>(null);
  const roomUnsubRef = useRef<(() => void) | null>(null);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    const createdMs = firestoreLikeToMillis(msg.createdAt);
    if (createdMs == null) return;
    const expiryTime = createdMs + RENRAKU_RECRUIT_TTL_MS;
    const checkExpiry = () => {
      if (Date.now() > expiryTime) {
        setIsExpired(true);
      }
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 10000);
    return () => clearInterval(interval);
  }, [msg.createdAt]);

  useEffect(() => {
    const url = msg.roomInfo?.url;
    if (!url) return;
    try {
      const urlObj = new URL(url);
      const roomId = urlObj.searchParams.get('room');
      if (!roomId) return;

      if (roomUnsubRef.current) {
        roomUnsubRef.current();
        roomUnsubRef.current = null;
      }
      if (roomIdRef.current === roomId) return;
      roomIdRef.current = roomId;

      const roomRef = doc(db, 'rooms', roomId);
      const unsubscribe = onSnapshot(roomRef, (snap) => {
        const data = snap.data();
        if (data) {
          setRoomStatus(data.status || 'waiting');
        } else {
          setRoomStatus('deleted');
        }
      });
      roomUnsubRef.current = unsubscribe;
      return () => {
        if (roomUnsubRef.current) {
          roomUnsubRef.current();
          roomUnsubRef.current = null;
        }
        roomIdRef.current = null;
      };
    } catch (e) {
      console.error('Error parsing room URL in recruitment:', e);
    }
  }, [msg.roomInfo?.url]);

  const canJoin = !isExpired && roomStatus === 'waiting';
  const isMine = !!currentUid && currentUid === (msg as { fromUserUid?: string }).fromUserUid;

  return (
    <div
      id={renrakuBoardPostElementId(msg.id)}
      className="scroll-mt-4 bg-rk-success-50 rounded-xl p-3 shadow-sm border border-rk-success-200 relative group"
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-xl border border-rk-slate-200 ${
              !canJoin
                ? 'bg-rk-slate-50 text-rk-slate-600'
                : isMine
                  ? `bg-rk-success-50 border-rk-success-200 ${RK_GATE_NICK_DISPLAY_CLASS}`
                  : 'bg-rk-success-50 text-rk-slate-700 border-rk-success-200'
            }`}
          >
            {!canJoin ? '募集終了' : msg.fromUser}
          </span>
        </div>
        <span className="text-[10px] text-rk-slate-400 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
      </div>
      <RenrakuMessageBody text={msg.message} className="text-xs text-rk-slate-700 leading-relaxed whitespace-pre-wrap mb-3" />
      {canJoin && msg.roomInfo?.url && (
        <button
          onClick={() => {
            const url = new URL(msg.roomInfo!.url);
            const roomId = url.searchParams.get('room');
            if (roomId && onJoinRoom) {
              onJoinRoom(roomId);
            } else if (roomId) {
              window.history.pushState({}, '', `?room=${roomId}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            } else {
              window.location.href = msg.roomInfo!.url;
            }
          }}
          className={`${btnAccent} inline-flex items-center gap-2`}
        >
          参加する！
        </button>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RenrakuCopyTextButton text={msg.message} variant="chip" className="border-rk-success-200 bg-rk-white" />
        <RenrakuReportButton
          variant="emerald"
          targetType="renraku_public"
          targetId={msg.id}
          authorUid={msg.fromUserUid}
          reporterUid={currentUid}
          interactionBlocked={!!isInteractionBlocked}
        />
      </div>
      {isAdmin && (
        <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-1.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity max-w-[min(100%,14rem)]">
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 rounded-lg border border-rk-rose-200 text-rk-rose-700 bg-rk-rose-50 hover:bg-rk-rose-100"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
};

export default RecruitMessage;
