
// Utility per gestire IndexedDB (più capiente di localStorage per i listini METEL)
const DB_NAME = 'ScanOrderDB';
const DB_VERSION = 1;
const STORE_BATCHES = 'batches';
const STORE_CART = 'cart';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BATCHES)) {
        db.createObjectStore(STORE_BATCHES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CART)) {
        // Cart is a single object containing the array of items
        db.createObjectStore(STORE_CART);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const dbService = {
  async saveBatches(batches: any[]) {
    const db = await openDB();
    const tx = db.transaction(STORE_BATCHES, 'readwrite');
    const store = tx.objectStore(STORE_BATCHES);
    
    // Clear old and add new (simple strategy for now, can be optimized)
    await new Promise<void>((resolve, reject) => {
        const clearReq = store.clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => reject();
    });

    // Add all batches
    for (const batch of batches) {
        store.put(batch);
    }
    
    return tx.oncomplete;
  },

  async getBatches(): Promise<any[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_BATCHES, 'readonly');
    const store = tx.objectStore(STORE_BATCHES);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async saveCart(cartItems: any[]) {
    const db = await openDB();
    const tx = db.transaction(STORE_CART, 'readwrite');
    const store = tx.objectStore(STORE_CART);
    store.put(cartItems, 'current_cart');
    return tx.oncomplete;
  },

  async getCart(): Promise<any[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_CART, 'readonly');
    const store = tx.objectStore(STORE_CART);
    const request = store.get('current_cart');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  
  async addBatch(batch: any) {
    const db = await openDB();
    const tx = db.transaction(STORE_BATCHES, 'readwrite');
    const store = tx.objectStore(STORE_BATCHES);
    store.put(batch);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
  },

  async deleteBatch(id: string) {
    const db = await openDB();
    const tx = db.transaction(STORE_BATCHES, 'readwrite');
    const store = tx.objectStore(STORE_BATCHES);
    store.delete(id);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
  }
};
