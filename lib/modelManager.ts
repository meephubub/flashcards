import { pipeline } from '@xenova/transformers';

const DB_NAME = 'whisperModelDB';
const STORE_NAME = 'models';
const MODEL_NAME = 'Xenova/whisper-small';

type GetOrLoadModelOptions = {
  onDownloadStart?: () => void;
};

export async function getOrLoadModel(options?: GetOrLoadModelOptions) {
  if (typeof window === 'undefined') throw new Error('Not in browser');
  if ((window as any).whisperModel) {
    return (window as any).whisperModel;
  }
  const db = await openDB();
  const modelData = await getFromIndexedDB(db, MODEL_NAME);
  if (modelData) {
    // Model marker exists in IndexedDB, just load as normal (transformers.js will use cache)
    const model = await pipeline('automatic-speech-recognition', MODEL_NAME);
    (window as any).whisperModel = model;
    return model;
  }
  // Only call onDownloadStart if we actually need to download
  if (options && options.onDownloadStart) {
    options.onDownloadStart();
  }
  const model = await pipeline('automatic-speech-recognition', MODEL_NAME, {
    progress_callback: async (progress: any) => {
      if (progress.status === 'done') {
        await saveToIndexedDB(db, MODEL_NAME, { loaded: true });
      }
    }
  });
  (window as any).whisperModel = model;
  return model;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as any).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function getFromIndexedDB(db: IDBDatabase, key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function saveToIndexedDB(db: IDBDatabase, key: string, data: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
