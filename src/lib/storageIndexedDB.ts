/**
 * IndexedDB storage engine for GLB binary models.
 * Ensures uploaded 3D files (rooms, avatars, items) persist across browser page reloads.
 */

const DB_NAME = '3d_social_creator_db';
const DB_VERSION = 1;
const STORE_NAME = 'glb_files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGlbFile(id: string, file: Blob | File): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(file, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save GLB in IndexedDB:', err);
  }
}

export async function getGlbFile(id: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get GLB from IndexedDB:', err);
    return null;
  }
}

export async function deleteGlbFile(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete GLB from IndexedDB:', err);
  }
}

export async function clearAllGlbFiles(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to clear GLBs from IndexedDB:', err);
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(dataUrlOrBase64: string, defaultMime = 'model/gltf-binary'): Blob {
  if (!dataUrlOrBase64.includes(',')) {
    const byteCharacters = atob(dataUrlOrBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: defaultMime });
  }
  const parts = dataUrlOrBase64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || defaultMime;
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export async function getAllGlbIds(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result || []).map(String));
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get GLB keys from IndexedDB:', err);
    return [];
  }
}

export async function exportAllGlbsAsBase64(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    const ids = await getAllGlbIds();
    for (const id of ids) {
      const blob = await getGlbFile(id);
      if (blob) {
        try {
          const b64 = await blobToBase64(blob);
          result[id] = b64;
        } catch (e) {
          console.warn(`Could not serialize GLB ${id} to base64:`, e);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to export all GLBs as base64:', err);
  }
  return result;
}

export async function importGlbsFromBase64(filesMap: Record<string, string>): Promise<void> {
  try {
    const entries = Object.entries(filesMap);
    for (const [id, b64] of entries) {
      try {
        const blob = base64ToBlob(b64);
        await saveGlbFile(id, blob);
      } catch (e) {
        console.warn(`Could not restore GLB ${id} from base64:`, e);
      }
    }
  } catch (err) {
    console.warn('Failed to import GLBs from base64:', err);
  }
}
