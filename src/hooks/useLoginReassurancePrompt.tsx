import { useCallback, useState } from 'react';
import LoginReassuranceModal from '../components/LoginReassuranceModal';

/** ログイン前に「保護者の方へ」を挟む（トップ右上・画面下帯など共通） */
export function useLoginReassurancePrompt(
  onGoogleLogin?: () => void,
  onGoogleLoginPopup?: () => void | Promise<void>,
) {
  const [open, setOpen] = useState(false);
  const startLogin = onGoogleLoginPopup ?? onGoogleLogin;

  const promptLogin = useCallback(() => {
    if (startLogin) setOpen(true);
  }, [startLogin]);

  const loginReassuranceModal =
    open && startLogin ? (
      <LoginReassuranceModal
        onClose={() => setOpen(false)}
        onGoogleLogin={() => void startLogin()}
      />
    ) : null;

  return { promptLogin, loginReassuranceModal };
}
