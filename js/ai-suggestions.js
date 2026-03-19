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

        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        const templates = {
            cold: [
                `Última anotação indica baixo interesse. Aguarde ou mude de estratégia.`,
                `Cliente parece resistente (frio). Focar esforço em contas mais quentes por ora.`,
                `Detecção de recusa nas notas. Dar um tempo e tentar um contato reverso depois.`
            ],
            hot_urgent: [
                `Interesse confirmado e contato recente (${daysSinceContact} dias). Ligue agora para não esfriar!`,
                `Sinal de fechamento claro detectado na última interação. Momento exato para faturar.`,
                `A temperatura está fervendo. Tudo caminha para a compra, faça o touch base final.`
            ],
            hot_warning: [
                `Atenção: Anotação positiva, mas já passaram ${daysSinceContact} dias. Risco enorme de o negócio esfriar.`,
                `Cliente estava quente, porém não há conversas há semanas. Retome o contato agora!`,
                `O momento ideal de compra está se encerrando. Mande uma mensagem urgente para reaquecer.`
            ],
            loyal_inactive: [
                `Cliente fiel com ${salesCount} compras (R$${totalSalesValue.toFixed(0)}), inativo há ${daysSinceLastSale} dias. Risco de churn.`,
                `Temos um ótimo histórico de R$${totalSalesValue.toFixed(0)}, mas sumiu. Faça uma ligação de parceria hoje!`,
                `Já comprou ${salesCount} vezes antes. Oportunidade perdida por falta de toque recente. Ofereça reposição.`
            ],
            prospect_inactive: [
                `Nunca comprou e o último contato fez ${daysSinceContact} dias. Envie um case para reativar.`,
                `Prospect estagnado. Que tal oferecer uma amostra grátis para fisgá-lo finalmente?`,
                `Faz um tempo (${daysSinceContact} dias) e zero vendas. Mude a abordagem ou arquive.`
            ],
            forgotten: [
                `Faz ${daysSinceContact} dias de silêncio. Um "Oi, como estão as coisas?" rápido pode trazer novidades.`,
                `Completamente esquecido na base. É um bom dia para desenterrar e limpar o pipeline ou reativar.`,
                `Mais de 45 dias sem qualquer registro. Confirme se o WhatsApp ainda é o mesmo ou quem é o comprador.`
            ],
            followup: [
                `Contato feito há ${daysSinceContact} dias. Intervalo perfeito para um check-in de qualidade.`,
                `Follow-up natural. Consulte as notas anteriores e puxe assunto sobre os pontos já discutidos.`,
                `Tempo ideal para voltar a acionar (${daysSinceContact} dias corridos). Cobre uma atualização dele.`
            ],
            ok: [
                `Tudo sob controle. Contato extremamente recente (${daysSinceContact} dias). Siga o fluxo programado.`,
                `Nenhuma ação extra imediata. A negociação está circulando conforme previsto.`,
                `Aguarde o desenrolar da última ação que foi feita há apenas ${daysSinceContact} dias.`
            ]
        };

        if (isCold) return { priority:'baixa', emoji:'❄️', badge:'badge-muted', title:'Frio ou resistente', suggestion:pick(templates.cold), action:'Pausar' };
        if (isHot && daysSinceContact <= 7) return { priority:'urgente', emoji:'🔥', badge:'badge-danger', title:'Feche agora!', suggestion:pick(templates.hot_urgent), action:'Ligar agora' };
        if (isHot && daysSinceContact > 7) return { priority:'alta', emoji:'⚡', badge:'badge-warn', title:'Urgente — Resfriando', suggestion:pick(templates.hot_warning), action:'Retomar rápido' };
        if (salesCount >= 3 && daysSinceLastSale > 60) return { priority:'alta', emoji:'🔄', badge:'badge-warn', title:'Reativar cliente', suggestion:pick(templates.loyal_inactive), action:'Parceria' };
        if (salesCount === 0 && daysSinceContact > 30) return { priority:'media', emoji:'👋', badge:'badge-info', title:'Prospect parado', suggestion:pick(templates.prospect_inactive), action:'Abordagem nova' };
        if (daysSinceContact > 45) return { priority:'media', emoji:'⏰', badge:'badge-info', title:'Esquecido', suggestion:pick(templates.forgotten), action:'Checar status' };
        if (daysSinceContact > 15) return { priority:'normal', emoji:'📅', badge:'badge-muted', title:'Follow-up pendente', suggestion:pick(templates.followup), action:'Check-in' };
        return { priority:'normal', emoji:'✅', badge:'badge-success', title:'No prazo', suggestion:pick(templates.ok), action:'Aguardar' };
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

    async renderSuggestionsPanel(filteredList = null) {
        const panel = document.getElementById('ai-suggestions-panel');
        if (!panel) return;
        
        let customers = filteredList;
        if (!customers) {
            customers = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        }
        
        const sales     = DataStore.get(STORAGE_KEYS.SALES)     || [];
        if (!customers.length) { panel.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1rem;">Nenhum cliente a analisar no momento.</p>`; return; }

        const clientMap = {};
        customers.forEach(c => {
            const name = c.name||c.client;
            const date = c.lastContactDate||c.contactDate||'';
            if (!clientMap[name] || date > (clientMap[name].lastContactDate||'')) clientMap[name] = c;
        });

        panel.innerHTML = `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
            <span style="font-size:1.2rem;">🤖</span>
            <span style="font-weight:500;color:var(--text-main);">IA — Top 5 Prioridades</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;">${this.USE_CLAUDE_API?'Claude API':'Análise local'}</span>
        </div><div id="ai-cards-container" style="display:flex;flex-direction:column;gap:0.75rem;max-height:450px;overflow-y:auto;padding-right:4px;"></div>`;

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

        const top5 = results.slice(0, 5);

        const bgMap = {urgente:'rgba(220,53,69,0.15)',alta:'rgba(255,152,0,0.12)',media:'rgba(33,150,243,0.10)',normal:'rgba(255,255,255,0.03)',baixa:'rgba(255,255,255,0.02)'};
        top5.forEach(({client, suggestion}) => {
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
