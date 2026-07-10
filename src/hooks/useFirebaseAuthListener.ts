import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

/** Firebase の currentUser を直接購読（useAuth の state 遅れで表示がズレるのを防ぐ） */
export function useFirebaseAuthListener(): User | null {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
