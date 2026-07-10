import { resolveRenrakuPrivateReplyText } from './renrakuPrivateReply';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  resolveRenrakuPrivateReplyText({ replyMessage: '親' }, { text: 'サブ', toUserUid: '' }) === 'サブ',
  'subcollection wins'
);
assert(
  resolveRenrakuPrivateReplyText({ replyMessage: '親のみ' }, undefined) === '親のみ',
  'parent fallback'
);
assert(
  resolveRenrakuPrivateReplyText({}, { text: '  ', toUserUid: '' }) === '',
  'empty'
);

console.log('renrakuPrivateReply.selftest: ok');
