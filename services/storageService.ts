
const DB_NAME = 'PacdoraLiteDB';
const STORE_NAME = 'custom_models';
const DB_VERSION = 1;

export interface StoredModel {
  id: string;
  name: string;
  file: Blob;
  date: number;
}

export interface ModelMetadata {
  id: string;
  name: string;
  date: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

export const saveModelToLibrary = async (file: File): Promise<ModelMetadata> => {
  const db = await openDB();
  const id = crypto.randomUUID();
  const model: StoredModel = {
    id,
    name: file.name,
    file: file,
    date: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(model);

    request.onsuccess = () => {
      resolve({ id: model.id, name: model.name, date: model.date });
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const getModelLibrary = async (): Promise<ModelMetadata[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as StoredModel[];
      // Return lightweight metadata only (exclude the heavy Blob)
      const metadata = results.map(r => ({ id: r.id, name: r.name, date: r.date })).sort((a,b) => b.date - a.date);
      resolve(metadata);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const getModelBlob = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as StoredModel;
      resolve(result ? result.file : null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const deleteModelFromLibrary = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};
