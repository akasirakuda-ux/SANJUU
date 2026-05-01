
import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const stringToSeed = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const vibrate = (pattern: number | number[]) => {
  if (typeof window === 'undefined') return;
  if (!window.navigator?.vibrate) return;

  // Chrome blocks vibrate until the user has interacted with the page.
  // We enable it after the first user gesture to avoid noisy console interventions.
  const w = window as any;
  if (w.__rakudaVibrateEnabled !== true) return;
  window.navigator.vibrate(pattern);
};

// Enable vibrate after first user gesture (once).
if (typeof window !== 'undefined') {
  const w = window as any;
  if (w.__rakudaVibrateInit !== true) {
    w.__rakudaVibrateInit = true;
    w.__rakudaVibrateEnabled = false;
    const enable = () => {
      w.__rakudaVibrateEnabled = true;
      window.removeEventListener('pointerdown', enable, true);
      window.removeEventListener('touchstart', enable, true);
      window.removeEventListener('keydown', enable, true);
    };
    window.addEventListener('pointerdown', enable, true);
    window.addEventListener('touchstart', enable, true);
    window.addEventListener('keydown', enable, true);
  }
}

export const encodeProCode = (diff: number, catId: string, seed: number) => {
  const diffChar = String.fromCharCode(65 + diff); // A=0, B=1...
  return `${catId}-${diffChar}-${seed}`;
};

export const decodeProCode = (code: string) => {
  const parts = code.split('-');
  if (parts.length !== 3) return null;
  return {
    category: parts[0],
    difficulty: parts[1].charCodeAt(0) - 65,
    seed: parseInt(parts[2])
  };
};
