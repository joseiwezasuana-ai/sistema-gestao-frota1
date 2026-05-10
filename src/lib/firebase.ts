import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  memoryLocalCache,
  doc, 
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Safety check for incorrect appId which causes blank screen/timeouts in production
const IS_SISTEMA_AUDITADO = firebaseConfig.projectId === 'sistema-auditado';
const HAS_DEFAULT_APP_ID = firebaseConfig.appId.includes('1015177486923');

if (IS_SISTEMA_AUDITADO && HAS_DEFAULT_APP_ID) {
  const msg = "⚠️ ERRO DE CONFIGURAÇÃO: Você ainda está usando o 'appId' padrão. Atualize o arquivo 'firebase-applet-config.json' com os dados do projeto 'sistema-auditado' no Console Firebase.";
  console.error(msg);
  (window as any)._firebaseConfigError = msg;
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Optimized settings for specific AI Studio runtime constraints
const dbSettings: any = {
  experimentalAutoDetectLongPolling: true, // Auto-ajuste para melhor compatibilidade
  localCache: memoryLocalCache(),
  ignoreUndefinedProperties: true
};

export const db = initializeFirestore(app, dbSettings, firebaseConfig.firestoreDatabaseId || '(default)');

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ 
  prompt: 'select_account',
  // Ensure the popup doesn't get messed up by translations
  hl: 'pt-PT'
});

// Remove aggressive connection test that causes noise in logs

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
        photoUrl: provider.photoURL || ''
      })) || []
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
