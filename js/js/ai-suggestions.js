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
        const system = "Você é um assistente de vendas especializado em Isapel CRM. Analise o cliente e dê uma sugestão curta.";
        const prompt = `Analise este cliente:
Nome: ${client.name}
Último contato: ${client.lastContactDate || 'desconhecido'}
Notas: ${client.notes || 'sem notas'}
Vendas: ${clientSales.length} compras.
Responda APENAS com JSON:
{"priority":"urgente|alta|media|normal|baixa","emoji":"emoji","title":"título","suggestion":"sugestão","action":"verbo"}`;

        try {
            const res = await fetch(`${API_BASE_URL}/ai/proxy`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    model: this.CLAUDE_MODEL,
                    max_tokens: 250,
                    system: system,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            if (!res.ok) throw new Error('Proxy error ' + res.status);
            const data = await res.json();
            const text = data.content[0]?.text || "{}";
            const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
            const badgeMap = { urgente: 'badge-danger', alta: 'badge-warn', media: 'badge-info', normal: 'badge-muted', baixa: 'badge-muted' };
            return { ...parsed, badge: badgeMap[parsed.priority] || 'badge-muted' };
        } catch (err) {
            console.warn("AI Proxy failed, using local rules:", err);
            return this.analyzeClientLocal(client, salesHistory);
        }
    },

    async analyze(client, salesHistory) {
        // Agora verificamos se o usuário quer usar IA ou se o servidor tem a chave
        // Por padrão, tentamos o Claude via Proxy. Se falhar, o fallback local entra.
        return this.analyzeClientClaude(client, salesHistory);
    },

    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, t=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
    }
};

window.AISuggestions = AISuggestions;
