import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
  type FirebaseStorage,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const FIREBASE_CONFIG_SUMMARY = {
  projectId: firebaseConfig.projectId || '',
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  authDomain: firebaseConfig.authDomain || '',
  storageBucket: firebaseConfig.storageBucket || '',
  hasValidConfig: Boolean(
    firebaseConfig.projectId &&
      firebaseConfig.apiKey &&
      firebaseConfig.projectId !== 'remixed-project-id'
  ),
  hasStorageBucket: Boolean(
    firebaseConfig.storageBucket &&
      firebaseConfig.storageBucket.trim().length > 0 &&
      !firebaseConfig.storageBucket.includes('remixed')
  ),
} as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Pass the provisioned firestoreDatabaseId so Firestore connects to the right database.
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Ensure authentication state persists across browser refreshes.
void setPersistence(auth, browserLocalPersistence).catch(() => {
  // Fallback safely if browser privacy mode restricts IndexedDB/localStorage persistence
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const storage: FirebaseStorage | null = FIREBASE_CONFIG_SUMMARY.hasStorageBucket
  ? getStorage(app)
  : null;

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function extractReadableError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;
  const raw = error instanceof Error ? error.message : String(error);

  try {
    const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string') {
      if (parsed.error.toLowerCase().includes('permission') || parsed.error.includes('PERMISSION_DENIED')) {
        if (auth.currentUser && !auth.currentUser.emailVerified) {
          return 'Please verify your email address before saving or publishing changes.';
        }
        return 'Permission denied by Firestore security rules. Ensure rules are deployed and you are signed in.';
      }
      if (parsed.error.includes('index') || parsed.error.includes('FAILED_PRECONDITION')) {
        return 'A Firestore composite index is required for this query. Deploy firestore.indexes.json in Firebase Console.';
      }
      if (parsed.error.includes('Quota exceeded')) {
        return 'Daily Firestore free-tier quota exceeded. Quota resets tomorrow.';
      }
      return parsed.error;
    }
  } catch {
    // Not a JSON-encoded FirestoreErrorInfo string
  }

  if (raw.includes('permission-denied') || raw.includes('PERMISSION_DENIED')) {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      return 'Please verify your email address before saving or publishing changes.';
    }
    return 'Permission denied by Firestore security rules. Please deploy firestore.rules to enable live writes.';
  }
  if (raw.includes('the client is offline')) {
    return 'Unable to reach Cloud Firestore. Check your internet connection or Firebase configuration.';
  }
  if (raw.includes('storage/unauthorized')) {
    return 'Firebase Storage denied this upload. Verify Storage is enabled and storage.rules are deployed.';
  }
  if (raw.includes('storage/bucket-not-found') || raw.includes('storage/unknown')) {
    return 'Firebase Storage bucket is not active yet. Enable Storage in Firebase Console to upload images.';
  }
  return raw || fallback;
}

export type ConnectionCheckStatus = 'checking' | 'connected' | 'offline' | 'permission-blocked';

export async function testConnection(): Promise<ConnectionCheckStatus> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return 'connected';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return 'offline';
    }
    // A permission-denied response on test/connection confirms the server was reached cleanly.
    if (message.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
      return 'connected';
    }
    return 'connected';
  }
}

export async function uploadCompressedImageToStorage(params: {
  blob: Blob;
  userId: string;
  folder: 'posts' | 'avatars';
  mimeType: string;
  onProgress?: (percent: number) => void;
}): Promise<string> {
  if (!storage || !FIREBASE_CONFIG_SUMMARY.hasStorageBucket) {
    throw new Error(
      'Firebase Storage is not configured in firebase-applet-config.json. Enable Storage in Firebase Console to upload images.'
    );
  }

  const ext = params.mimeType === 'image/webp' ? 'webp' : params.mimeType === 'image/png' ? 'png' : 'jpg';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const objectPath = `uploads/${params.userId}/${params.folder}/${safeName}`;
  const storageRef = ref(storage, objectPath);

  return new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, params.blob, {
      contentType: params.mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && params.onProgress) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          params.onProgress(pct);
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
