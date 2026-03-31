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

function getAuthHeaders() {
    const token = sessionStorage.getItem('maciel_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Faz fetch autenticado. Se receber 401 E o usuário já estiver logado,
 * tenta renovar o token silenciosamente e repete a requisição.
 * NÃO é chamado durante o próprio processo de login.
 */
async function fetchWithAuth(url, options = {}) {
    options.headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    let res = await fetch(url, options);

    // Só tenta renovar se o usuário já estava autenticado (token expirou)
    if (res.status === 401 && sessionStorage.getItem('maciel_auth') === 'true') {
        const cachedPass = sessionStorage.getItem('_maciel_session_key');

        if (cachedPass) {
            try {
                const loginRes = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: cachedPass })
                });

                if (loginRes.ok) {
                    const data = await loginRes.json();
                    sessionStorage.setItem('maciel_token', data.token || '');
                    sessionStorage.setItem('maciel_profile', data.profile || 'default');
                    console.log('[Auth] Token renovado automaticamente!');

                    // Repete a requisição original com novo token
                    options.headers = { ...getAuthHeaders(), ...(options.headers || {}) };
                    res = await fetch(url, options);
                }
            } catch (e) {
                console.error('[Auth] Falha ao renovar token:', e);
            }
        } else {
            // Sem senha em cache — força login novamente
            console.warn('[Auth] Token expirado, redirecionando para login...');
            sessionStorage.removeItem('maciel_auth');
            sessionStorage.removeItem('maciel_token');
            location.reload();
        }
    }

    return res;
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

        // Limpa cache antes de carregar
        this.cache = {
            crm_sales:     [],
            crm_customers: [],
            crm_samples:   [],
            crm_settings:  {},
            crm_reminders: []
        };
        this.isReady = false;

        try {
            const [salesRes, customersRes, samplesRes, settingsRes, remindersRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/sales?profile=${profile}`),
                fetchWithAuth(`${API_BASE_URL}/customers?profile=${profile}`),
                fetchWithAuth(`${API_BASE_URL}/samples?profile=${profile}`),
                fetchWithAuth(`${API_BASE_URL}/settings?profile=${profile}`),
                fetchWithAuth(`${API_BASE_URL}/reminders?profile=${profile}`)
            ]);

            if (salesRes.ok)    this.cache.crm_sales     = await salesRes.json();
            if (customersRes.ok) this.cache.crm_customers = await customersRes.json();
            if (samplesRes.ok)  this.cache.crm_samples    = await samplesRes.json();
            if (settingsRes.ok) this.cache.crm_settings   = await settingsRes.json();
            if (remindersRes.ok) this.cache.crm_reminders = await remindersRes.json();

            console.log(`[DataStore] Carregado: ${this.cache.crm_sales.length} vendas, ${this.cache.crm_customers.length} clientes`);

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
        if (key === STORAGE_KEYS.SETTINGS) {
            const profile = sessionStorage.getItem('maciel_profile') || 'default';
            try {
                await fetchWithAuth(`${API_BASE_URL}/settings?profile=${profile}`, {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            } catch (e) { console.error("API error", e); }
        }
    },

    async add(key, record) {
        if (!record.id) record.id = Date.now().toString() + Math.random().toString(36).substring(2, 5);

        const profile = sessionStorage.getItem('maciel_profile') || 'default';
        record.profile = profile;

        const now = new Date().toISOString();
        if (!record.createdAt) record.createdAt = now;
        if (!record.updatedAt) record.updatedAt = now;

        const endpoint = STORAGE_MAP[key];

        if (Array.isArray(this.cache[key])) {
            this.cache[key].push(record);
        }

        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
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

        if (Array.isArray(this.cache[key])) {
            const index = this.cache[key].findIndex(item => String(item.id) === String(id));
            if (index !== -1) {
                this.cache[key][index] = { ...this.cache[key][index], ...data };
            }
        }

        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/${endpoint}/${id}`, {
                method: 'PUT',
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

        if (Array.isArray(this.cache[key])) {
            this.cache[key] = this.cache[key].filter(item => String(item.id) !== String(id));
        }

        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/${endpoint}/${id}`, {
                method: 'DELETE'
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
            const res = await fetchWithAuth(`${API_BASE_URL}/settings`);
            if (!res.ok) throw new Error(`Erro ao buscar settings: ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("API Error getting settings:", error);
            return null;
        }
    },

    async saveSettings(data) {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/settings`, {
                method: 'POST',
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
window.fetchWithAuth = fetchWithAuth;
window.getAuthHeaders = getAuthHeaders;
