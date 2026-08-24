/**
 * Data Management Module - Cloud Sync
 */
const API_BASE_URL = (() => {
    if (typeof window === 'undefined' || !window.location) return '/api';
    const port = window.location.port;
    const hostname = window.location.hostname || 'localhost';
    // Se estiver rodando no próprio FastAPI (porta 8000) ou em produção (Vercel/Render/sem porta)
    if (port === '8000' || !port || port === '80' || port === '443') {
        return '/api';
    }
    // Servidor de desenvolvimento estático (8080, 5500, 3000, etc.)
    return `http://${hostname}:8000/api`;
})();
window.API_BASE_URL = API_BASE_URL;

window.getActiveProfile = function() {
    const token = sessionStorage.getItem('maciel_token') || localStorage.getItem('maciel_token') || '';
    if (token && token.includes('.') && token !== 'local_fallback_token' && token !== 'local_session_token') {
        try {
            const payload = JSON.parse(atob(token.split('.')[0] + '=='));
            if (payload && payload.profile) return String(payload.profile).toLowerCase().trim();
        } catch(e) {}
    }
    const p = sessionStorage.getItem('maciel_profile') || localStorage.getItem('maciel_profile');
    if (p && p !== 'null' && p !== 'undefined') return String(p).toLowerCase().trim();
    return 'default';
};

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
    const token = sessionStorage.getItem('maciel_token') || localStorage.getItem('maciel_token') || 'local_session_token';
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Faz fetch autenticado seguro sem causar destruição em cadeia de tokens em caso de 401 temporário.
 */
async function fetchWithAuth(url, options = {}) {
    options.headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    let res;
    try {
        res = await fetch(url, options);
    } catch (err) {
        console.warn(`[fetchWithAuth] Erro de conexão em ${url}:`, err.message);
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Tenta renovar o token automaticamente se a requisição retornar 401
    if (res.status === 401) {
        const cachedPass = sessionStorage.getItem('_maciel_session_key') || localStorage.getItem('_maciel_session_key');
        const username = sessionStorage.getItem('maciel_username') || localStorage.getItem('maciel_username') || 'Maciel';

        if (cachedPass) {
            try {
                const loginRes = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username, password: cachedPass })
                });

                if (loginRes.ok) {
                    const data = await loginRes.json();
                    const newToken = data.token || 'local_token_session';
                    sessionStorage.setItem('maciel_token', newToken);
                    sessionStorage.setItem('maciel_profile', data.profile || 'default');
                    sessionStorage.setItem('maciel_auth', 'true');
                    localStorage.setItem('maciel_token', newToken);
                    localStorage.setItem('maciel_profile', data.profile || 'default');
                    localStorage.setItem('maciel_auth', 'true');
                    console.log('[Auth] Token renovado automaticamente via /login!');

                    options.headers = { ...getAuthHeaders(), ...(options.headers || {}) };
                    res = await fetch(url, options);
                }
            } catch (e) {
                console.error('[Auth] Falha na renovação automática do token:', e);
            }
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
        const activeProfile = window.getActiveProfile();
        const token = sessionStorage.getItem('maciel_token') || localStorage.getItem('maciel_token') || '';

        console.group('%c[DEBUG 0 - DATASTORE.INIT START]', 'background:#1e293b;color:#38bdf8;font-weight:bold;padding:2px 6px;border-radius:3px');
        console.log('perfil ativo validado (activeProfile):', activeProfile);
        console.log('token:', token ? token.substring(0, 40) + '...' : 'VAZIO');
        console.log('maciel_auth:', sessionStorage.getItem('maciel_auth') || localStorage.getItem('maciel_auth'));
        console.log('API_BASE_URL:', API_BASE_URL);
        console.groupEnd();

        // Limpa cache antes de carregar — garante que não haja resíduos do perfil anterior
        this.cache = {
            crm_sales:     [],
            crm_customers: [],
            crm_samples:   [],
            crm_settings:  {},
            crm_reminders: []
        };

        // Tier 0: Tenta consulta direta ao Supabase de Produção se o cliente estiver ativo
        if (typeof window !== 'undefined' && window.SupabaseModule) {
            try {
                const supaSales = await window.SupabaseModule.fetchSales(activeProfile);
                if (Array.isArray(supaSales) && supaSales.length > 0) {
                    this.cache.crm_sales = supaSales.filter(s => (s.profile || 'default').toLowerCase() === activeProfile);
                    console.log(`[DataStore] Supabase Produção carregou ${this.cache.crm_sales.length} vendas.`);
                }
            } catch (e) {
                console.warn('[DEBUG T0 - SUPABASE ERRO]', e);
            }
        }

        // Tier 1: Tenta buscar da API Backend FastAPI
        try {
            const [salesRes, customersRes, samplesRes, settingsRes, remindersRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/sales?profile=${activeProfile}`),
                fetchWithAuth(`${API_BASE_URL}/customers?profile=${activeProfile}`),
                fetchWithAuth(`${API_BASE_URL}/samples?profile=${activeProfile}`),
                fetchWithAuth(`${API_BASE_URL}/settings?profile=${activeProfile}`),
                fetchWithAuth(`${API_BASE_URL}/reminders?profile=${activeProfile}`)
            ]);

            if (salesRes && salesRes.ok) {
                const sData = await salesRes.json().catch(() => []);
                if (Array.isArray(sData) && sData.length > 0) {
                    this.cache.crm_sales = sData.filter(s => (s.profile || 'default').toLowerCase() === activeProfile);
                }
            }
            if (customersRes && customersRes.ok) {
                const cData = await customersRes.json().catch(() => []);
                if (Array.isArray(cData) && cData.length > 0) {
                    this.cache.crm_customers = cData.filter(c => (c.profile || 'default').toLowerCase() === activeProfile);
                }
            }
            if (samplesRes && samplesRes.ok) {
                const smData = await samplesRes.json().catch(() => []);
                if (Array.isArray(smData) && smData.length > 0) {
                    this.cache.crm_samples = smData.filter(sm => (sm.profile || 'default').toLowerCase() === activeProfile);
                }
            }
            if (settingsRes && settingsRes.ok) {
                const stData = await settingsRes.json().catch(() => ({}));
                if (stData && typeof stData === 'object' && Object.keys(stData).length > 0) this.cache.crm_settings = stData;
            }
            if (remindersRes && remindersRes.ok) {
                const rData = await remindersRes.json().catch(() => []);
                if (Array.isArray(rData) && rData.length > 0) {
                    this.cache.crm_reminders = rData.filter(r => (r.profile || 'default').toLowerCase() === activeProfile);
                }
            }

            console.log(`[DataStore] FastAPI carregou: ${this.cache.crm_sales.length} vendas para perfil [${activeProfile}]`);
        } catch (error) {
            console.warn('[DEBUG T1 - FASTAPI ERRO CRÍTICO]', error);
        }

        // Tier 2: Fallback para datasets embutidos na window (window.SALES_DATASET, window.CUSTOMERS_DATASET)
        if (this.cache.crm_sales.length === 0 && typeof window !== 'undefined' && Array.isArray(window.SALES_DATASET) && window.SALES_DATASET.length > 0) {
            const filteredSales = window.SALES_DATASET.filter(s => {
                const sProf = (s.profile || 'default').toLowerCase();
                return sProf === activeProfile;
            });
            this.cache.crm_sales = filteredSales;
            console.log(`[DataStore] Fallback SALES_DATASET embutido carregou ${this.cache.crm_sales.length} vendas para o perfil [${activeProfile}].`);
        }

        if (this.cache.crm_customers.length === 0 && typeof window !== 'undefined' && Array.isArray(window.CUSTOMERS_DATASET) && window.CUSTOMERS_DATASET.length > 0) {
            const filteredCust = window.CUSTOMERS_DATASET.filter(c => {
                const cProf = (c.profile || 'default').toLowerCase();
                return cProf === activeProfile;
            });
            this.cache.crm_customers = filteredCust;
            console.log(`[DataStore] Fallback CUSTOMERS_DATASET embutido carregou ${this.cache.crm_customers.length} clientes para o perfil [${activeProfile}].`);
        }

        // Tier 3: Fallback para arquivos JSON estáticos em data/
        if (this.cache.crm_sales.length === 0) {
            const candidatePaths = ['data/sales.json', './data/sales.json', '/data/sales.json', 'app/data/sales.json'];
            for (const path of candidatePaths) {
                try {
                    const localSalesRes = await fetch(path);
                    if (localSalesRes.ok) {
                        const lSales = await localSalesRes.json();
                        if (Array.isArray(lSales) && lSales.length > 0) {
                            const filtered = lSales.filter(s => (s.profile || 'default').toLowerCase() === activeProfile);
                            this.cache.crm_sales = filtered;
                            console.log(`[DataStore] Fallback JSON local (${path}) carregou ${filtered.length} vendas para o perfil [${activeProfile}].`);
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        if (this.cache.crm_customers.length === 0) {
            const candidatePaths = ['data/customers.json', './data/customers.json', '/data/customers.json', 'app/data/customers.json'];
            for (const path of candidatePaths) {
                try {
                    const localCustRes = await fetch(path);
                    if (localCustRes.ok) {
                        const lCust = await localCustRes.json();
                        if (Array.isArray(lCust) && lCust.length > 0) {
                            const filtered = lCust.filter(c => (c.profile || 'default').toLowerCase() === activeProfile);
                            this.cache.crm_customers = filtered;
                            console.log(`[DataStore] Fallback JSON local (${path}) carregou ${filtered.length} clientes para o perfil [${activeProfile}].`);
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        console.group('%c[DEBUG 4 - DATASTORE FINAL]', 'background:#1e293b;color:#f59e0b;font-weight:bold;padding:2px 6px;border-radius:3px');
        console.log('crm_sales no cache:', this.cache.crm_sales.length, 'registros');
        console.log('crm_customers no cache:', this.cache.crm_customers.length, 'registros');
        console.log('Primeiras 3 vendas no cache:', this.cache.crm_sales.slice(0, 3));
        console.groupEnd();

        this.isReady = true;
        document.dispatchEvent(new Event('DataStoreReady'));
    },

    get(key) {
        let result = this.cache[key] || (key === STORAGE_KEYS.SETTINGS ? {} : []);
        const activeProfile = window.getActiveProfile ? window.getActiveProfile() : 'default';

        if (key === STORAGE_KEYS.SALES && Array.isArray(result)) {
            return result.filter(s => (s.profile || 'default').toLowerCase() === activeProfile);
        }
        if (key === STORAGE_KEYS.CUSTOMERS && Array.isArray(result)) {
            return result.filter(c => (c.profile || 'default').toLowerCase() === activeProfile);
        }
        if (key === STORAGE_KEYS.SAMPLES && Array.isArray(result)) {
            return result.filter(sm => (sm.profile || 'default').toLowerCase() === activeProfile);
        }
        if (key === STORAGE_KEYS.REMINDERS && Array.isArray(result)) {
            return result.filter(r => (r.profile || 'default').toLowerCase() === activeProfile);
        }
        return result;
    },

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
            // Reverter a adição local se falhou no servidor
            if (Array.isArray(this.cache[key])) {
                this.cache[key] = this.cache[key].filter(item => String(item.id) !== String(record.id));
            }
            alert("⚠️ ERRO DE SINCRONIZAÇÃO: O dado NÃO foi salvo no servidor devido a um erro. Por favor, tente novamente. Erro: " + error.message);
            throw error; // Lançar erro para o chamador saber que falhou
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
