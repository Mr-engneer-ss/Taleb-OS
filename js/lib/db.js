// IndexedDB: ملفات المكتبة + النسخ الاحتياطية الداخلية.
// كل الدوال تعيد Promise وترمي أخطاء عربية مفهومة عند الفشل.

const DB_NAME = 'studentos';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('قاعدة البيانات المحلية (IndexedDB) غير مدعومة في هذا المتصفح.'));
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(new Error('تعذّر فتح التخزين المحلي للملفات.'));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(new Error('تعذّر فتح التخزين المحلي للملفات.'));
    req.onblocked = () => reject(new Error('التخزين المحلي مشغول بتبويب آخر. أغلق التبويبات الأخرى وأعد المحاولة.'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function run(storeName, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    let req;
    let tx;
    try {
      tx = db.transaction(storeName, mode);
      req = fn(tx.objectStore(storeName));
    } catch (e) {
      reject(new Error('فشلت عملية التخزين المحلي.'));
      return;
    }
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onabort = () => {
      const err = tx.error;
      if (err && err.name === 'QuotaExceededError') reject(new Error('مساحة التخزين ممتلئة.'));
      else reject(new Error('فشلت عملية التخزين المحلي.'));
    };
    tx.onerror = () => { /* يعالجها onabort */ };
  }));
}

function makeStore(name) {
  return {
    put: (rec) => run(name, 'readwrite', (s) => s.put(rec)),
    get: (id) => run(name, 'readonly', (s) => s.get(id)),
    all: () => run(name, 'readonly', (s) => s.getAll()),
    remove: (id) => run(name, 'readwrite', (s) => s.delete(id)),
    clear: () => run(name, 'readwrite', (s) => s.clear()),
  };
}

export const filesDB = makeStore('files');
export const backupsDB = makeStore('backups');
