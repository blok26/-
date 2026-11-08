import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getDatabase, Database, ref, onValue } from 'firebase/database';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const STORAGE_KEY = 'drawit_firebase_config';

export function getStoredFirebaseConfig(): FirebaseConfigOptions | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey && parsed.databaseURL && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON errors
  }

  // Fallback to environment variables
  const envConfig: FirebaseConfigOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  if (envConfig.apiKey && envConfig.databaseURL && !envConfig.apiKey.includes('MY_') && !envConfig.apiKey.includes('AIzaSy...')) {
    return envConfig;
  }

  return null;
}

export function saveFirebaseConfig(config: FirebaseConfigOptions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.location.reload();
}

export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

export function isFirebaseConfigured(): boolean {
  return getStoredFirebaseConfig() !== null;
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Database | null = null;
let serverTimeOffset = 0;

export function getFirebaseApp(): FirebaseApp | null {
  if (appInstance) return appInstance;

  const config = getStoredFirebaseConfig();
  if (!config) return null;

  try {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(config);
    }
    return appInstance;
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return null;
  }
}

export function getAppAuth(): Auth | null {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  authInstance = getAuth(app);
  return authInstance;
}

export function getAppDatabase(): Database | null {
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  dbInstance = getDatabase(app);

  // Monitor server time offset for synchronous round timers
  const offsetRef = ref(dbInstance, '.info/serverTimeOffset');
  onValue(offsetRef, (snap) => {
    serverTimeOffset = (snap.val() as number) || 0;
  });

  return dbInstance;
}

export function getEstimatedServerTime(): number {
  return Date.now() + serverTimeOffset;
}

/**
 * Ensures anonymous authentication and returns the User object
 */
export async function ensureAnonymousUser(): Promise<User> {
  const auth = getAppAuth();
  if (!auth) {
    throw new Error('Firebase غير مهيأ بعد. يرجى إدخال إعدادات Firebase.');
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        unsubscribe();
        resolve(currentUser);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          unsubscribe();
          resolve(cred.user);
        } catch (err) {
          unsubscribe();
          reject(err);
        }
      }
    });
  });
}

/**
 * Returns a valid user UID immediately, whether Firebase is configured or running in Local Mode
 */
export async function getOrCreateUserUid(): Promise<string> {
  if (isFirebaseConfigured()) {
    try {
      const user = await ensureAnonymousUser();
      return user.uid;
    } catch (e) {
      console.warn('Anonymous auth failed, falling back to local UID:', e);
    }
  }

  let localUid = localStorage.getItem('drawit_local_uid');
  if (!localUid) {
    localUid = 'usr_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('drawit_local_uid', localUid);
  }
  return localUid;
}
