/**
 * Data Management Module - Cloud Sync
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
            document.dispatchEvent(new Event('DataStoreReady'));
        } catch (error) {
            console.error("DataStore Init Error", error);
            // Mesmo com erro, libera a interface para importação
            document.dispatchEvent(new Event('DataStoreReady'));
        }
    },

    get(key) { return this.cache[key] || (key === STORAGE_KEYS.SETTINGS ? {} : []); },

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
        }
    },

    async add(key, record) {
        if (!record.id) record.id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
        const endpoint = STORAGE_MAP[key];
        try {
            const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            return await res.json();
        } catch (error) {
            console.error("API Error adding:", error);
            return record;
        }
    }
};
window.DataStore = DataStore;
window.STORAGE_KEYS = STORAGE_KEYS;
window.STORAGE_MAP = STORAGE_MAP;
