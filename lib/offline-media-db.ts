// lib/offline-media-db.ts
const DB_NAME = 'irib_isfahan_offline_media_v1';
const STORE_NAME = 'video_blobs';

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineVideoBlob(
  itemId: string,
  file: Blob,
  versionNumber?: number
): Promise<string> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Save latest pointer under itemId and version-specific snapshot under itemId_vX
      store.put(file, itemId);
      if (versionNumber !== undefined) {
        store.put(file, `${itemId}_v${versionNumber}`);
      }
      tx.oncomplete = () => resolve(URL.createObjectURL(file));
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return URL.createObjectURL(file);
  }
}

export async function loadOfflineVideoBlobUrl(
  itemId: string,
  versionNumber?: number
): Promise<string | null> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const lookupKey =
        versionNumber !== undefined ? `${itemId}_v${versionNumber}` : itemId;
      const req = store.get(lookupKey);
      req.onsuccess = () => {
        if (req.result instanceof Blob) {
          resolve(URL.createObjectURL(req.result));
        } else if (versionNumber !== undefined) {
          // Fallback to base itemId
          const fallbackReq = store.get(itemId);
          fallbackReq.onsuccess = () => {
            if (fallbackReq.result instanceof Blob) {
              resolve(URL.createObjectURL(fallbackReq.result));
            } else {
              resolve(null);
            }
          };
          fallbackReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
