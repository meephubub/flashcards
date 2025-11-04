export type NoteMeta = { id: string; title: string; folder_id: string | null; public_url?: string | null };
export type TaskMeta = { id: string; subject: string | null; due_date: string | null; done: boolean | null; priority: number | null };
export type DeckMeta = { id: number; name: string; description?: string | null };
export type FolderMeta = { id: string; name: string; parent_id: string | null };
export type NoteContent = { id: string; title: string; content: string; updated_at?: string | null };
export type CardLite = { id: number; front: string; back: string; front_img_url?: string | null; back_img_url?: string | null; updated_at?: string | null };

const DB_NAME = 'app-offline';
const STORE = 'kv';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function setItem<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value as any, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getItem<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) || null);
    req.onerror = () => reject(req.error);
  });
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export async function saveNotesMeta(userId: string, items: NoteMeta[]): Promise<void> {
  await setItem(`notes:${userId}`, items);
}

export async function loadNotesMeta(userId: string): Promise<NoteMeta[]> {
  const v = await getItem<NoteMeta[]>(`notes:${userId}`);
  return v || [];
}

export async function saveTasksMeta(userId: string, items: TaskMeta[]): Promise<void> {
  await setItem(`tasks:${userId}`, items);
}

export async function loadTasksMeta(userId: string): Promise<TaskMeta[]> {
  const v = await getItem<TaskMeta[]>(`tasks:${userId}`);
  return v || [];
}

export async function saveDecksMeta(userId: string, items: DeckMeta[]): Promise<void> {
  await setItem(`decks:${userId}`, items);
}

export async function loadDecksMeta(userId: string): Promise<DeckMeta[]> {
  const v = await getItem<DeckMeta[]>(`decks:${userId}`);
  return v || [];
}

export async function saveFoldersMeta(userId: string, items: FolderMeta[]): Promise<void> {
  await setItem(`folders:${userId}`, items);
}

export async function loadFoldersMeta(userId: string): Promise<FolderMeta[]> {
  const v = await getItem<FolderMeta[]>(`folders:${userId}`);
  return v || [];
}

export async function saveNoteContent(userId: string, note: NoteContent): Promise<void> {
  await setItem(`note:${userId}:${note.id}`, note);
}

export async function loadNoteContent(userId: string, noteId: string): Promise<NoteContent | null> {
  return await getItem<NoteContent>(`note:${userId}:${noteId}`);
}

export async function saveDeckCards(userId: string, deckId: number, cards: CardLite[]): Promise<void> {
  await setItem(`deck_cards:${userId}:${deckId}`, cards);
}

export async function loadDeckCards(userId: string, deckId: number): Promise<CardLite[]> {
  const v = await getItem<CardLite[]>(`deck_cards:${userId}:${deckId}`);
  return v || [];
}
