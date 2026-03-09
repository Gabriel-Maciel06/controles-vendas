/**
 * Data Management Module - Cloud Sync
 * Handles memory caching and API synchronization.
 */

const API_BASE_URL = "https://controles-vendas.onrender.com/api";

const STORAGE_MAP = {
    'crm_sales': 'sales',
    'crm_customers': 'customers',
    'crm_samples': 'samples',
    'crm_settings': 'settings',
    'crm_reminders': 'reminders'
};

const STORAGE_KEYS = {
    SALES: 'crm_sales',
    CUSTOMERS: 'crm_customers',
    SAMPLES: 'crm_samples',
    SETTINGS: 'crm_settings',
    REMINDERS: 'crm_reminders'
};

const DataStore = {
    // In-memory cache to keep synchronous gets fast
    cache: {
        crm_sales: [],
        crm_customers: [],
        crm_samples: [],
        crm_settings: {},
        crm_reminders: []
    },

    isReady: false,

    async init() {
        try {
            // Fetch everything in parallel
            const [salesRes, customersRes, samplesRes, settingsRes, remindersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/sales`),
                fetch(`${API_BASE_URL}/customers`),
                fetch(`${API_BASE_URL}/samples`),
                fetch(`${API_BASE_URL}/settings`),
                fetch(`${API_BASE_URL}/reminders`)
            ]);

            this.cache.crm_sales = await salesRes.json();
            this.cache.crm_customers = await customersRes.json();
            this.cache.crm_samples = await samplesRes.json();
            this.cache.crm_settings = await settingsRes.json();
            this.cache.crm_reminders = await remindersRes.json();

            this.isReady = true;
            console.log("DataStore: All data loaded from Cloud.");

            // Dispatch event so modules know they can render
            document.dispatchEvent(new Event('DataStoreReady'));
        } catch (error) {
            console.error("DataStore Init Error: Could not connect to API.", error);
            alert("Aviso: O Servidor Python Backend não está rodando. O sistema carregou vazio e offline. Por favor, inicie o backend na pasta /backend usando o terminal.");
            // Dispatch anyway so the app modules initialize (empty, but alive)
            document.dispatchEvent(new Event('DataStoreReady'));
        }
    },

    // Synchronous reads from cache
    get(key) {
        if (key === STORAGE_KEYS.SETTINGS) {
            return this.cache[key] || {};
        }
        return this.cache[key] || [];
    },

    // Specific set for settings (it overwrites everything)
    async set(key, data) {
        this.cache[key] = data;

        if (key === STORAGE_KEYS.SETTINGS) {
            try {
                await fetch(`${API_BASE_URL}/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } catch (e) { console.error("API error", e); }
        } else {
            // For other arrays, usually we don't 'set' entire arrays anymore, we use add/update/remove
            console.warn("DataStore.set() is deprecated for arrays in Cloud mode.");
        }
    },

    // Insert new record
    async add(key, record) {
        record.id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
        record.createdAt = new Date().toISOString();

        // Optimistic UI updates
        if (Array.isArray(this.cache[key])) {
            this.cache[key].push(record);
        }

        const endpoint = STORAGE_MAP[key];
        try {
            const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            const savedData = await res.json();

            // Update cache with real server data (might have updated IDs etc)
            const index = this.cache[key].findIndex(i => i.id === record.id);
            if (index !== -1) this.cache[key][index] = savedData;

            return savedData;
        } catch (error) {
            console.error("API Error adding:", error);
            // In a real app we would rollback the optimistic update here
            return record;
        }
    },

    // Update existing record
    async update(key, id, updatedFields) {
        const endpoint = STORAGE_MAP[key];
        const data = this.cache[key];
        const index = data.findIndex(item => item.id === id);

        if (index !== -1) {
            data[index] = { ...data[index], ...updatedFields, updatedAt: new Date().toISOString() };

            try {
                const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFields)
                });
                return await res.json();
            } catch (error) {
                console.error("API Error updating:", error);
            }
            return data[index];
        }
        return null;
    },

    // Delete record
    async remove(key, id) {
        const endpoint = STORAGE_MAP[key];
        const data = this.cache[key];
        const filtered = data.filter(item => item.id !== id);
        this.cache[key] = filtered; // Optimistic

        try {
            await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error("API Error deleting:", error);
        }
    }
};
