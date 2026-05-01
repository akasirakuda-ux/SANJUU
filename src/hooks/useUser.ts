
import { useState, useEffect, useCallback } from 'react';
import { UserAccount } from '../types';

const STORAGE_KEY_USER = 'word_search_user_v2';
const STORAGE_KEY_USERS = 'word_search_users_v1';
const STORAGE_KEY_ACTIVE_USER_ID = 'word_search_active_user_id_v1';
/** 新規・未設定時の 🐫 ポイント初期値 */
const STARTING_TOTAL_POINTS = 10_000;
/** 既存セーブに一度だけ適用する下限（この値未満なら繰り上げ） */
const POINTS_FLOOR_MIGRATION_KEY = 'word_search_user_points_floor_v1';

function createBlankUser(): UserAccount {
  const now = new Date().toISOString();
  return {
    user_id: 'local_' + Math.random().toString(36).substr(2, 9),
    created_at: now,
    login_count: 0,
    cards: [],
    totalPoints: STARTING_TOTAL_POINTS,
    inventory: [],
    nickname: '',
    userEmoji: '',
    addOns: [],
    completedDates: [],
    specialDates: [],
  };
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const useUser = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    // 1) 新形式（複数アカウント）を読む
    const list = safeParse<UserAccount[]>(localStorage.getItem(STORAGE_KEY_USERS));
    if (Array.isArray(list) && list.length > 0) return list;

    // 2) 旧形式（単一アカウント）から移行
    const saved = safeParse<any>(localStorage.getItem(STORAGE_KEY_USER));
    if (saved) {
      const parsed = saved ?? {};
      if (!parsed.created_at) parsed.created_at = new Date().toISOString();
      const user_id =
        parsed.user_id || parsed.uid || 'local_' + Math.random().toString(36).substr(2, 9);
      const login_count =
        parsed.login_count !== undefined ? parsed.login_count : parsed.play_count !== undefined ? parsed.play_count : 0;
      const cards = parsed.cards || [];
      let totalPoints = parsed.totalPoints !== undefined ? parsed.totalPoints : STARTING_TOTAL_POINTS;
      try {
        if (localStorage.getItem(POINTS_FLOOR_MIGRATION_KEY) !== '1') {
          totalPoints = Math.max(totalPoints, STARTING_TOTAL_POINTS);
          localStorage.setItem(POINTS_FLOOR_MIGRATION_KEY, '1');
        }
      } catch {
        /* ignore quota / private mode */
      }
      const addOns = parsed.addOns || [];
      const completedDates = parsed.completedDates || [];
      const specialDates = parsed.specialDates || [];
      const migrated: UserAccount = {
        ...parsed,
        user_id,
        login_count,
        cards,
        totalPoints,
        nickname: parsed.nickname || '',
        userEmoji: parsed.userEmoji || '',
        addOns,
        completedDates,
        specialDates,
      };
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([migrated]));
        localStorage.setItem(STORAGE_KEY_ACTIVE_USER_ID, String(user_id));
      } catch {
        /* ignore */
      }
      return [migrated];
    }

    // 3) 何もなければ新規作成
    const one = createBlankUser();
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([one]));
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER_ID, String(one.user_id));
    } catch {
      /* ignore */
    }
    return [one];
  });

  const [activeUserId, setActiveUserId] = useState<string>(() => {
    const id = localStorage.getItem(STORAGE_KEY_ACTIVE_USER_ID);
    if (id) return id;
    // accounts は上で初期化済み（初期 state initializer の中で確定）
    return accounts[0]?.user_id ?? 'local_unknown';
  });

  const activeAccount = accounts.find((a) => a.user_id === activeUserId) ?? accounts[0] ?? createBlankUser();
  const [user, setUserState] = useState<UserAccount>(activeAccount);
  const [nickname, setNicknameState] = useState(activeAccount.nickname || '');
  const [userEmoji, setUserEmojiState] = useState(activeAccount.userEmoji || '');

  useEffect(() => {
    // activeUserId が変わったら activeAccount を state に反映
    const next = accounts.find((a) => a.user_id === activeUserId);
    if (next) {
      setUserState(next);
      setNicknameState(next.nickname || '');
      setUserEmojiState(next.userEmoji || '');
    }
  }, [accounts, activeUserId]);

  useEffect(() => {
    // 互換のため旧キーも更新（他の処理で参照されうる）
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(accounts));
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER_ID, String(activeUserId));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }, [accounts, activeUserId, user]);

  const updateActiveUser = useCallback((updater: (prev: UserAccount) => UserAccount) => {
    setAccounts((prev) => {
      const idx = prev.findIndex((a) => a.user_id === activeUserId);
      const current = idx >= 0 ? prev[idx] : prev[0];
      const next = updater(current ?? createBlankUser());
      const nextList = idx >= 0 ? prev.map((a, i) => (i === idx ? next : a)) : [next, ...prev];
      return nextList;
    });
    setUserState((p) => updater(p));
  }, [activeUserId]);

  const handleSetNickname = useCallback((newNickname: string) => {
    setNicknameState(newNickname);
    updateActiveUser((prev) => ({ ...prev, nickname: newNickname }));
  }, [updateActiveUser]);

  const handleSetUserEmoji = useCallback((newEmoji: string) => {
    setUserEmojiState(newEmoji);
    updateActiveUser((prev) => ({ ...prev, userEmoji: newEmoji }));
  }, [updateActiveUser]);

  const handleSpendPoints = useCallback((amount: number) => {
    updateActiveUser((prev) => ({ ...prev, totalPoints: Math.max(0, prev.totalPoints - amount) }));
  }, [updateActiveUser]);

  const handleAddPoints = useCallback((amount: number) => {
    updateActiveUser((prev) => ({ ...prev, totalPoints: prev.totalPoints + amount }));
  }, [updateActiveUser]);

  const setUser = useCallback((next: UserAccount | ((prev: UserAccount) => UserAccount)) => {
    updateActiveUser((prev) => (typeof next === 'function' ? (next as (p: UserAccount) => UserAccount)(prev) : next));
  }, [updateActiveUser]);

  const switchAccount = useCallback((userId: string) => {
    setActiveUserId(userId);
  }, []);

  const createAccount = useCallback(() => {
    const one = createBlankUser();
    setAccounts((prev) => [one, ...prev]);
    setActiveUserId(one.user_id);
    return one.user_id;
  }, []);

  return {
    user,
    setUser,
    nickname,
    setNickname: handleSetNickname,
    userEmoji,
    setUserEmoji: handleSetUserEmoji,
    spendPoints: handleSpendPoints,
    addPoints: handleAddPoints,
    accounts,
    activeUserId,
    switchAccount,
    createAccount,
  };
};
