
import { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry, LogType } from '../types';
import { db, auth } from '../firebase';
import { 
  doc, 
  setDoc, 
  collection, 
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';

const STORAGE_KEY_LOGS = 'word_search_system_logs';

export const useLogs = (firebaseUser: any, handleFirestoreError: any) => {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  }, [logs]);

  const logBufferRef = useRef<LogEntry[]>([]);
  const lastLogSyncRef = useRef<number>(Date.now());

  const addLog = useCallback((type: LogType, tag: string, message: string, details?: any, emoji?: string) => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}.${(now.getMonth()+1).toString().padStart(2,'0')}.${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    const newLog: LogEntry = { id: Math.random().toString(36).substr(2, 9), timestamp, type, tag, message, emoji, details };
    setLogs(prev => [newLog, ...prev].slice(0, 200)); 

    // Buffer logs for batch syncing
    logBufferRef.current.push(newLog);
  }, []);

  // Batch sync logs to Firestore
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const syncLogs = async () => {
      if (logBufferRef.current.length === 0) return;

      const logsToSync = [...logBufferRef.current];
      logBufferRef.current = [];
      
      console.log(`Syncing ${logsToSync.length} logs to Firestore...`);
      
      try {
        const batch = writeBatch(db);
        
        logsToSync.forEach(log => {
          const logRef = doc(db, 'users', currentUid, 'logs', log.id);
          const firestoreData = JSON.parse(JSON.stringify(log));
          batch.set(logRef, firestoreData);
        });
        
        await batch.commit();
        lastLogSyncRef.current = Date.now();
      } catch (e) {
        console.error('Error batch syncing logs:', e);
      }
    };

    const interval = setInterval(syncLogs, 60000); // Sync every 60 seconds
    
    return () => {
      clearInterval(interval);
      syncLogs();
    };
  }, [firebaseUser]);

  // Sync logs from Firestore on login
  useEffect(() => {
    const currentUid = firebaseUser?.uid || auth.currentUser?.uid;
    if (!currentUid) return;

    const fetchLogs = async () => {
      const logsRef = collection(db, 'users', currentUid, 'logs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(200));
      
      try {
        const snapshot = await getDocs(q);
        const firestoreLogs = snapshot.docs.map(doc => doc.data() as LogEntry);
        setLogs(prev => {
          const combined = [...firestoreLogs];
          prev.forEach(localLog => {
            if (!combined.find(l => l.id === localLog.id)) {
              combined.push(localLog);
            }
          });
          return combined.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
        });
      } catch (error) {
        handleFirestoreError(error, 'list', `users/${currentUid}/logs`);
      }
    };

    fetchLogs();
  }, [firebaseUser, handleFirestoreError]);

  return {
    logs,
    addLog
  };
};
