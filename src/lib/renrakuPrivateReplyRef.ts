import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { RENRAKU_PRIVATE_REPLY_DOC_ID } from './renrakuPrivateReply';

export function renrakuPrivateReplyRef(messageId: string) {
  return doc(db, 'renraku_private', messageId, 'private_reply', RENRAKU_PRIVATE_REPLY_DOC_ID);
}
