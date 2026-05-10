import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore, 
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Safety check for incorrect appId
const IS_SISTEMA_AUDITADO = firebaseConfig.projectId === 'sistema-auditado';
const HAS_DEFAULT_APP_ID = firebaseConfig.appId.includes('1015177486923');

if (IS_SISTEMA_AUDITADO && HAS_DEFAULT_APP_ID) {
  const msg = "⚠️ ERRO DE CONFIGURAÇÃO: Você ainda está usando o 'appId' padrão. Atualize o arquivo 'firebase-applet-config.json' com os dados do projeto 'sistema-auditado' no Console Firebase.";
  console.error(msg);
  (window as any)._firebaseConfigError = msg;
}

// Ensure app is only initialized once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use a more robust initialization pattern for Firestore
// forceLongPolling is often required in environments with strict proxies or deep inspection
const dbSettings: any = {
  experimentalForceLongPolling: true, 
  localCache: memoryLocalCache(), 
  ignoreUndefinedProperties: true
};

// Handle (default) or named database correctly
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "" 
  ? firebaseConfig.firestoreDatabaseId 
  : "(default)";

export const db = initializeFirestore(app, dbSettings, databaseId);

// Diagnostic helper to detect hangs
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 15000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("ERRO_TIMEOUT: A base de dados não respondeu a tempo. Verifique se o Cloud Firestore está ativo no Console Firebase."));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ 
  prompt: 'select_account',
  hl: 'pt-PT'
});

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
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || '',
      email: auth.currentUser?.email || '',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoURL: provider.photoURL || ''
      })) || []
    }
  };
  console.error('Firestore Error Details:', errInfo);
  // Don't stringify nested info in the throw message to avoid double escaping issues
  throw new Error(`Firebase Error [${operationType}] at ${path}: ${errInfo.error}`);
}
