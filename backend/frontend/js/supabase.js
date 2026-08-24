/* ==========================================================================
   SUPABASE PRODUCTION CLIENT & SYNC MODULE (CRM HUB)
   Project URL: https://xpjhpskjetpcglkxdjag.supabase.co
   ========================================================================== */

const SUPABASE_URL = "https://xpjhpskjetpcglkxdjag.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwanBoc2tqZXRwY2dsa3hkamFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTkyNzM2MDAsImV4cCI6MjAzNDg0OTYwMH0.placeholder";

let supabaseClient = null;

if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseClient;
        console.log("[Supabase] Cliente de produção inicializado com sucesso para o projeto xpjhpskjetpcglkxdjag!");
    } catch (e) {
        console.warn("[Supabase] Falha ao instanciar cliente Supabase JS:", e);
    }
}

const SupabaseModule = {
    async fetchSales(profile = 'default') {
        if (!window.supabaseClient) return null;
        try {
            const cleanProf = (profile || 'default').toLowerCase();
            let query = window.supabaseClient.from('sales').select('*');
            if (cleanProf) {
                query = query.eq('profile', cleanProf);
            }
            const { data, error } = await query.order('saleDate', { ascending: false });

            if (error) {
                console.warn("[Supabase] Erro ao consultar tabela 'sales':", error);
                return null;
            }
            return data || [];
        } catch (err) {
            console.warn("[Supabase] Exceção na busca de vendas:", err);
            return null;
        }
    },

    async saveSale(saleData) {
        if (!window.supabaseClient) return null;
        try {
            const { data, error } = await window.supabaseClient
                .from('sales')
                .insert([saleData])
                .select();
            if (error) {
                console.warn("[Supabase] Erro ao salvar venda no Supabase:", error);
                return null;
            }
            return data ? data[0] : null;
        } catch (err) {
            console.warn("[Supabase] Exceção ao inserir venda:", err);
            return null;
        }
    }
};

window.SupabaseModule = SupabaseModule;
