/**
 * AI Suggestions Module — Análise inteligente de clientes
 * Funciona 100% local (sem API externa) usando regras inteligentes
 * Ou com a API do Claude (opcional, baixo custo)
 */

const AISuggestions = {

    USE_CLAUDE_API: false,
    CLAUDE_API_KEY: '',
    CLAUDE_MODEL: 'claude-haiku-4-5-20251001',

    analyzeClientLocal(client, salesHistory) {
        const today = new Date();
        const lastContact = client.lastContactDate
            ? new Date(client.lastContactDate + 'T00:00:00') : null;
        const daysSinceContact = lastContact
            ? Math.floor((today - lastContact) / (1000*60*60*24)) : 999;

        const clientSales = salesHistory.filter(s =>
            (s.client||'').toLowerCase() === (client.name||'').toLowerCase()
        );
        const totalSalesValue = clientSales.reduce((s,v) => s+(parseFloat(v.value)||0), 0);
        const salesCount = clientSales.length;

        const lastSale = clientSales.sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate))[0];
        const daysSinceLastSale = lastSale
            ? Math.floor((today - new Date(lastSale.saleDate+'T00:00:00')) / (1000*60*60*24)) : 999;

        const notes = (client.notes||'').toLowerCase();
        const isHot  = ['interesse','quente','quer','adorou','gostou','pedido','fechar','comprar','confirmar'].some(k => notes.includes(k));
        const isCold = ['não quer','sem interesse','cancelou','desistiu','caro','concorrente'].some(k => notes.includes(k));

        if (isCold) return { priority:'baixa', emoji:'❄️', badge:'badge-muted', title:'Cliente frio', suggestion:'Última anotação indica baixo interesse. Aguarde ou tente abordagem diferente.', action:'Aguardar' };
        if (isHot && daysSinceContact <= 7)  return { priority:'urgente', emoji:'🔥', badge:'badge-danger', title:'Fechar agora!', suggestion:`Cliente demonstrou interesse e foi contatado há ${daysSinceContact} dias. Momento ideal para fechar.`, action:'Ligar hoje' };
        if (isHot && daysSinceContact > 7)   return { priority:'alta', emoji:'⚡', badge:'badge-warn', title:'Urgente — estava quente', suggestion:`Última anotação positiva, mas já faz ${daysSinceContact} dias. Risco de perder o interesse.`, action:'Contato urgente' };
        if (salesCount >= 3 && daysSinceLastSale > 60) return { priority:'alta', emoji:'🔄', badge:'badge-warn', title:'Reativar cliente fiel', suggestion:`Cliente com ${salesCount} compras (R$${totalSalesValue.toFixed(0)}) sem comprar há ${daysSinceLastSale} dias.`, action:'Reativação' };
        if (salesCount === 0 && daysSinceContact > 30) return { priority:'media', emoji:'👋', badge:'badge-info', title:'Prospect parado', suggestion:`Nunca comprou e faz ${daysSinceContact} dias do último contato. Tente oferta ou amostra grátis.`, action:'Nova abordagem' };
        if (daysSinceContact > 45) return { priority:'media', emoji:'⏰', badge:'badge-info', title:'Muito tempo sem contato', suggestion:`Faz ${daysSinceContact} dias sem contato. Verifique se ainda é cliente ativo.`, action:'Verificar' };
        if (daysSinceContact > 20) return { priority:'normal', emoji:'📅', badge:'badge-muted', title:'Follow-up programado', suggestion:`Contato há ${daysSinceContact} dias. Bom momento para check-in rápido.`, action:'Check-in' };
        return { priority:'normal', emoji:'✅', badge:'badge-success', title:'Em dia', suggestion:`Último contato há ${daysSinceContact} dias. Próximo follow-up conforme programado.`, action:'Aguardar' };
    },

    async analyzeClientClaude(client, salesHistory) {
        const clientSales = salesHistory.filter(s =>
            (s.client||'').toLowerCase() === (client.name||'').toLowerCase()
        );
        const prompt = `Você é um assistente de vendas. Analise este cliente e dê UMA sugestão curta de ação.
Cliente: ${client.name}
Último contato: ${client.lastContactDate||'desconhecido'}
Próximo follow-up: ${client.nextFollowUp||'não definido'}
Anotações: ${client.notes||'sem anotações'}
Vendas: ${clientSales.length} venda(s) — R$${clientSales.reduce((s,v)=>s+(parseFloat(v.value)||0),0).toFixed(2)}
Responda APENAS com JSON (sem markdown):
{"priority":"urgente|alta|media|normal|baixa","emoji":"emoji","title":"título curto","suggestion":"sugestão 1-2 frases","action":"verbo 1-2 palavras"}`;
        try {
            const res  = await fetch('https://api.anthropic.com/v1/messages', {
                method:'POST', headers:{'Content-Type':'application/json','x-api-key':this.CLAUDE_API_KEY,'anthropic-version':'2023-06-01'},
                body: JSON.stringify({ model:this.CLAUDE_MODEL, max_tokens:200, messages:[{role:'user',content:prompt}] })
            });
            if (!res.ok) throw new Error('API '+res.status);
            const data   = await res.json();
            const parsed = JSON.parse(data.content[0]?.text.replace(/```json|```/g,'').trim());
            const badgeMap = {urgente:'badge-danger',alta:'badge-warn',media:'badge-info',normal:'badge-muted',baixa:'badge-muted'};
            return {...parsed, badge: badgeMap[parsed.priority]||'badge-muted'};
        } catch(err) {
            return this.analyzeClientLocal(client, salesHistory);
        }
    },

    async analyze(client, salesHistory) {
        if (this.USE_CLAUDE_API && this.CLAUDE_API_KEY) return this.analyzeClientClaude(client, salesHistory);
        return this.analyzeClientLocal(client, salesHistory);
    },

    async renderSuggestionsPanel() {
        const panel = document.getElementById('ai-suggestions-panel');
        if (!panel) return;
        const customers = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        const sales     = DataStore.get(STORAGE_KEYS.SALES)     || [];
        if (!customers.length) { panel.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1rem;">Nenhum cliente cadastrado ainda.</p>`; return; }

        const clientMap = {};
        customers.forEach(c => {
            const name = c.name||c.client;
            const date = c.lastContactDate||c.contactDate||'';
            if (!clientMap[name] || date > (clientMap[name].lastContactDate||'')) clientMap[name] = c;
        });

        panel.innerHTML = `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
            <span style="font-size:1.2rem;">🤖</span>
            <span style="font-weight:500;color:var(--text-main);">Análise IA — Prioridade de contato</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;">${this.USE_CLAUDE_API?'Claude API':'Análise local'}</span>
        </div><div id="ai-cards-container" style="display:flex;flex-direction:column;gap:0.75rem;"></div>`;

        const container = document.getElementById('ai-cards-container');
        const priorityOrder = {urgente:0,alta:1,media:2,normal:3,baixa:4};
        const results = [];
        for (const client of Object.values(clientMap)) {
            results.push({ client, suggestion: await this.analyze(client, sales) });
        }
        // Ordena: maior urgência primeiro. Empate → mais dias sem contato primeiro
        results.sort((a,b) => {
            const pa = priorityOrder[a.suggestion.priority] ?? 5;
            const pb = priorityOrder[b.suggestion.priority] ?? 5;
            if (pa !== pb) return pa - pb;
            // desempate: quem está há mais tempo sem contato aparece antes
            const da = a.client.lastContactDate || a.client.contactDate || '9999';
            const db = b.client.lastContactDate || b.client.contactDate || '9999';
            return da.localeCompare(db); // data menor (mais antiga) = mais urgente
        });

        const bgMap = {urgente:'rgba(220,53,69,0.15)',alta:'rgba(255,152,0,0.12)',media:'rgba(33,150,243,0.10)',normal:'rgba(255,255,255,0.03)',baixa:'rgba(255,255,255,0.02)'};
        results.forEach(({client, suggestion}) => {
            const name = client.name||client.client;
            const card = document.createElement('div');
            card.style.cssText = `background:${bgMap[suggestion.priority]||'rgba(255,255,255,0.03)'};border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:0.85rem 1rem;display:flex;align-items:flex-start;gap:0.75rem;`;
            card.innerHTML = `
                <div style="font-size:1.4rem;line-height:1;margin-top:2px;">${suggestion.emoji}</div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;flex-wrap:wrap;">
                        <strong style="color:var(--text-main);font-size:0.9rem;">${this.escapeHTML(name)}</strong>
                        <span class="badge ${suggestion.badge}" style="font-size:0.7rem;">${suggestion.title}</span>
                    </div>
                    <p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 0.4rem;line-height:1.4;">${suggestion.suggestion}</p>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" onclick="CRMModule.quickContact('${this.escapeHTML(name)}')" style="font-size:0.75rem;padding:0.2rem 0.6rem;">📞 ${suggestion.action}</button>
                        <button class="btn btn-sm btn-outline" onclick="CRMModule.viewHistory('${this.escapeHTML(name)}')" style="font-size:0.75rem;padding:0.2rem 0.6rem;">Histórico</button>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    },

    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, t=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
    }
};

window.AISuggestions = AISuggestions;
