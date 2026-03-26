/**
 * Data Management Module - Cloud Sync
 */
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? "http://localhost:8000/api"
    : "https://controles-vendas.onrender.com/api";

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

function getAuthHeaders() {
    const token = sessionStorage.getItem('maciel_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

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
        const profile = sessionStorage.getItem('maciel_profile') || 'default';

        // Limpa cache antes de carregar — garante que dados do perfil anterior não apareçam
        this.cache = {
            crm_sales:     [],
            crm_customers: [],
            crm_samples:   [],
            crm_settings:  {},
            crm_reminders: []
        };
        this.isReady = false;

        try {
            const headers = getAuthHeaders();
            const [salesRes, customersRes, samplesRes, settingsRes, remindersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/sales?profile=${profile}`, { headers }),
                fetch(`${API_BASE_URL}/customers?profile=${profile}`, { headers }),
                fetch(`${API_BASE_URL}/samples?profile=${profile}`, { headers }),
                fetch(`${API_BASE_URL}/settings?profile=${profile}`, { headers }),
                fetch(`${API_BASE_URL}/reminders?profile=${profile}`, { headers })
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
            document.dispatchEvent(new Event('DataStoreReady'));
        }
    },

    get(key) { return this.cache[key] || (key === STORAGE_KEYS.SETTINGS ? {} : []); },

    async set(key, data) {
        this.cache[key] = data;
        // Só dispara API se for as configurações
        if (key === STORAGE_KEYS.SETTINGS) {
            const profile = sessionStorage.getItem('maciel_profile') || 'default';
            try {
                await fetch(`${API_BASE_URL}/settings?profile=${profile}`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });
            } catch (e) { console.error("API error", e); }
        }
    },

    async add(key, record) {
        if (!record.id) record.id = Date.now().toString() + Math.random().toString(36).substring(2, 5);

        const profile = sessionStorage.getItem('maciel_profile') || 'default';
        record.profile = profile;

        // Injetar timestamps exigidos pelo Backend
        const now = new Date().toISOString();
        if (!record.createdAt) record.createdAt = now;
        if (!record.updatedAt) record.updatedAt = now;

        const endpoint = STORAGE_MAP[key];

        // Atualizar cache local primeiro (Otimista)
        if (Array.isArray(this.cache[key])) {
            this.cache[key].push(record);
        }

        try {
            const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(record)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error("Server error:", errorData);
                throw new Error(`Erro no servidor: ${res.status}`);
            }

            return await res.json();
        } catch (error) {
            console.error("API Error adding:", error);
            alert("⚠️ ERRO DE SINCRONIZAÇÃO: O dado foi registrado localmente mas NÃO foi salvo no servidor. Verifique sua conexão ou se o backend está online. Erro: " + error.message);
            return record;
        }
    },

    async update(key, id, data) {
        const endpoint = STORAGE_MAP[key];
        const now = new Date().toISOString();
        data.updatedAt = now;
        data.profile = sessionStorage.getItem('maciel_profile') || 'default';

        // Atualizar cache local
        if (Array.isArray(this.cache[key])) {
            const index = this.cache[key].findIndex(item => String(item.id) === String(id));
            if (index !== -1) {
                this.cache[key][index] = { ...this.cache[key][index], ...data };
            }
        }

        try {
            const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });

            if (!res.ok) throw new Error(`Erro no servidor: ${res.status}`);

            return await res.json();
        } catch (error) {
            console.error("API Error updating:", error);
            alert("⚠️ ERRO AO ATUALIZAR: As mudanças podem ser perdidas ao atualizar a página.");
            return data;
        }
    },

    async remove(key, id) {
        const endpoint = STORAGE_MAP[key];

        // Remover do cache local primeiro
        if (Array.isArray(this.cache[key])) {
            this.cache[key] = this.cache[key].filter(item => String(item.id) !== String(id));
        }

        try {
            const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error(`Erro no servidor: ${res.status}`);
            return true;
        } catch (error) {
            console.error("API Error removing:", error);
            alert("⚠️ ERRO AO EXCLUIR: O item pode reaparecer ao atualizar a página.");
            return false;
        }
    },

    async getSettings() {
        try {
            const res = await fetch(`${API_BASE_URL}/settings`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error(`Erro ao buscar settings: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("API Error getting settings:", error);
            return null;
        }
    },

    async saveSettings(data) {
        try {
            const res = await fetch(`${API_BASE_URL}/settings`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`Erro ao salvar settings: ${res.status}`);
            return true;
        } catch (error) {
            console.error("API Error saving settings:", error);
            return false;
        }
    }
};

window.DataStore = DataStore;
window.STORAGE_KEYS = STORAGE_KEYS;
window.STORAGE_MAP = STORAGE_MAP;
