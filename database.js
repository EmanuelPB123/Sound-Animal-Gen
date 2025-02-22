export class DatabaseManager {
  constructor() {
    this.dbName = 'animalSoundsDB';
    this.storeName = 'animals';
    this.db = null;
    this.fallbackStorage = new Map(); // Fallback when IndexedDB is not available
    this.usesFallback = false;
    this.init();
  }

  async init() {
    try {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          this.usesFallback = true;
          console.warn('IndexedDB not available, using fallback storage');
          resolve();
          return;
        }

        const request = indexedDB.open(this.dbName, 1);

        request.onerror = (event) => {
          console.warn('IndexedDB access denied, using fallback storage');
          this.usesFallback = true;
          resolve();
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          try {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              const store = db.createObjectStore(this.storeName, {
                keyPath: 'id',
                autoIncrement: true
              });
              
              store.createIndex('name', 'name', { unique: false });
              store.createIndex('category', 'category', { unique: false });
            }
          } catch (error) {
            console.warn('Error during database upgrade:', error);
            this.usesFallback = true;
          }
        };
      });
    } catch (error) {
      console.warn('Error initializing database:', error);
      this.usesFallback = true;
    }
  }

  async addAnimal(animalData) {
    await this.ensureConnection();
    
    if (this.usesFallback) {
      const id = this.fallbackStorage.size + 1;
      this.fallbackStorage.set(id, { ...animalData, id });
      return id;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add(animalData);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('Error adding animal to IndexedDB, using fallback');
          const id = this.fallbackStorage.size + 1;
          this.fallbackStorage.set(id, { ...animalData, id });
          resolve(id);
        };
      } catch (error) {
        console.warn('Error in addAnimal transaction:', error);
        const id = this.fallbackStorage.size + 1;
        this.fallbackStorage.set(id, { ...animalData, id });
        resolve(id);
      }
    });
  }

  async getAllAnimals() {
    await this.ensureConnection();
    
    if (this.usesFallback) {
      return Array.from(this.fallbackStorage.values());
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('Error getting animals from IndexedDB, using fallback');
          resolve(Array.from(this.fallbackStorage.values()));
        };
      } catch (error) {
        console.warn('Error in getAllAnimals transaction:', error);
        resolve(Array.from(this.fallbackStorage.values()));
      }
    });
  }

  async getAnimal(id) {
    await this.ensureConnection();
    
    if (this.usesFallback) {
      return this.fallbackStorage.get(id);
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('Error getting animal from IndexedDB, using fallback');
          resolve(this.fallbackStorage.get(id));
        };
      } catch (error) {
        console.warn('Error in getAnimal transaction:', error);
        resolve(this.fallbackStorage.get(id));
      }
    });
  }

  async updateAnimal(animalData) {
    await this.ensureConnection();
    
    if (this.usesFallback) {
      this.fallbackStorage.set(animalData.id, animalData);
      return animalData.id;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(animalData);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('Error updating animal in IndexedDB, using fallback');
          this.fallbackStorage.set(animalData.id, animalData);
          resolve(animalData.id);
        };
      } catch (error) {
        console.warn('Error in updateAnimal transaction:', error);
        this.fallbackStorage.set(animalData.id, animalData);
        resolve(animalData.id);
      }
    });
  }

  async deleteAnimal(id) {
    await this.ensureConnection();
    
    if (this.usesFallback) {
      this.fallbackStorage.delete(id);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn('Error deleting animal from IndexedDB, using fallback');
          this.fallbackStorage.delete(id);
          resolve();
        };
      } catch (error) {
        console.warn('Error in deleteAnimal transaction:', error);
        this.fallbackStorage.delete(id);
        resolve();
      }
    });
  }

  async ensureConnection() {
    if (!this.db && !this.usesFallback) {
      await this.init();
    }
  }
}