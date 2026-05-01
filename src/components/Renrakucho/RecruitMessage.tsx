import React, { useEffect, useRef, useState } from 'react';
import MentionText from './MentionText';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { btnAccent } from '../../ui/policy';
import { firestoreLikeToMillis, formatFirestoreTimeJa, RENRAKU_RECRUIT_TTL_MS } from '../../lib/firestoreTime';
import type { Message } from './types';

const RecruitMessage: React.FC<{
  msg: Message;
  isAdmin: boolean;
  currentUid?: string;
  onDelete: () => void;
  onJoinRoom?: (rid: string) => void;
}> = ({ msg, isAdmin, currentUid, onDelete, onJoinRoom }) => {
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

  return (
    <div className="bg-emerald-50 rounded-xl p-3 shadow-sm border border-emerald-200 relative group">
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-xl border border-slate-200 ${!canJoin ? 'bg-slate-50 text-slate-600' : 'bg-emerald-50 text-slate-700 border-emerald-200'}`}
          >
            {!canJoin ? '募集終了' : msg.fromUser}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
      </div>
      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
        <MentionText text={msg.message} />
      </p>
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
      {isAdmin && (
        <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-1.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity max-w-[min(100%,14rem)]">
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
};

export default RecruitMessage;
