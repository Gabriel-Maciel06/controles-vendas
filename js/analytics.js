/**
 * Analytics Module — v1.0
 * Inteligência de Vendas e Saúde do Funil
 */

const AnalyticsModule = {
    period: { start: '', end: '' },
    charts: { origin: null, temp: null },

    init() {
        this.setDefaultPeriod();
        this.bindEvents();
        // Não renderiza no init, espera DataStore ou abertura da view
    },

    setDefaultPeriod() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        this.period.start = firstDay.toISOString().split('T')[0];
        this.period.end = now.toISOString().split('T')[0];
        
        const startEl = document.getElementById('analytics-start');
        const endEl = document.getElementById('analytics-end');
        if (startEl) startEl.value = this.period.start;
        if (endEl) endEl.value = this.period.end;
    },

    bindEvents() {
        // Escuta mudanças no DataStore para atualizar se a view estiver ativa
        document.addEventListener('DataStoreReady', () => {
            const view = document.getElementById('view-analytics');
            if (view && !view.classList.contains('hidden')) {
                this.render();
            }
        });
    },

    setPeriod(type) {
        const now = new Date();
        let start = new Date();
        
        if (type === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (type === 'last30') {
            start.setDate(now.getDate() - 30);
        } else if (type === 'quarter') {
            start.setMonth(now.getMonth() - 3);
        } else if (type === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
        }

        this.period.start = start.toISOString().split('T')[0];
        this.period.end = now.toISOString().split('T')[0];
        
        const startEl = document.getElementById('analytics-start');
        const endEl = document.getElementById('analytics-end');
        if (startEl) startEl.value = this.period.start;
        if (endEl) endEl.value = this.period.end;
        
        this.applyFilters();
    },

    applyFilters() {
        const startEl = document.getElementById('analytics-start');
        const endEl = document.getElementById('analytics-end');
        if (startEl) this.period.start = startEl.value;
        if (endEl) this.period.end = endEl.value;
        this.render();
    },

    render() {
        if (typeof DataStore === 'undefined') return;

        const profile = sessionStorage.getItem('maciel_profile') || 'default';
        const customers = (DataStore.get(STORAGE_KEYS.CUSTOMERS) || []).filter(c => c.profile === profile);
        const sales = (DataStore.get(STORAGE_KEYS.SALES) || []).filter(s => s.profile === profile);
        const samples = (DataStore.get(STORAGE_KEYS.SAMPLES) || []).filter(s => s.profile === profile);
        const prospects = (DataStore.get(STORAGE_KEYS.PROSPECTS) || []).filter(p => p.profile === profile);

        this.renderFunnel(customers);
        this.renderCharts(customers);
        this.renderSamples(samples);
        this.renderReactivation(customers);
        this.renderActivity(customers, samples, prospects);
    },

    // --- SEÇÃO 1: FUNIL ---
    renderFunnel(customers) {
        const container = document.getElementById('analytics-funnel-container');
        const originSelect = document.getElementById('analytics-funnel-origin');
        if (!container || !originSelect) return;

        const originFilter = originSelect.value;
        let filtered = customers;
        if (originFilter !== 'all') {
            filtered = customers.filter(c => c.origin === originFilter);
        }

        const ETAPAS = [
            { label: 'Primeiro contato', key: 'Primeiro contato' },
            { label: 'Qualificação', key: 'Qualificação' },
            { label: 'Primeira Oferta', key: 'Primeira Oferta' },
            { label: 'Maturação', key: 'Maturação' },
            { label: 'Fechamento', key: 'Fechamento' },
            { label: 'Pós venda', key: 'Pós venda' }
        ];

        // Lógica de acúmulo: quem está em 'Fechamento' também passou por 'Qualificação'
        const counts = ETAPAS.map((etapa, idx) => {
            const reached = filtered.filter(c => {
                const currentEtapa = c.temperature || 'Frio';
                const colIdx = ETAPAS.findIndex(e => e.key === currentEtapa);
                return colIdx >= idx;
            }).length;
            return { label: etapa.label, count: reached };
        });

        const total = counts[0].count || 1;
        let html = '';
        let rates = [];

        counts.forEach((c, i) => {
            const pct = Math.round((c.count / total) * 100);
            const prevCount = i > 0 ? counts[i - 1].count : total;
            const dropRate = i > 0 ? Math.round(((prevCount - c.count) / (prevCount || 1)) * 100) : 0;
            if (i > 0) rates.push({ from: counts[i-1].label, to: c.label, drop: dropRate, lost: prevCount - c.count });

            html += `
                <div style="margin-bottom:0.8rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.3rem;">
                        <span style="color:var(--text-main);font-weight:500;">${c.label}</span>
                        <span style="color:var(--text-muted);">${c.count} clientes (${pct}%)</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.8rem;">
                        <div style="flex:1;height:12px;background:rgba(255,255,255,0.05);border-radius:6px;overflow:hidden;">
                            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, #6366f1, #818cf8);box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);"></div>
                        </div>
                        ${i > 0 ? `<span style="font-size:0.75rem;color:${dropRate > 25 ? '#f87171' : 'var(--text-muted)'};min-width:45px;text-align:right;">▼ ${dropRate}%</span>` : '<span style="min-width:45px;"></span>'}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Gargalos
        const bottleneck = rates.find(r => r.drop > 25);
        const alertEl = document.getElementById('analytics-bottleneck-alert');
        if (alertEl) {
            if (bottleneck) {
                alertEl.style.display = 'block';
                alertEl.innerHTML = `
                    <div style="display:flex;gap:0.8rem;align-items:flex-start;">
                        <span style="font-size:1.2rem;">⚠️</span>
                        <div>
                            <div style="font-weight:600;color:#EF9F27;font-size:0.85rem;">GARGALO DETECTADO: ${bottleneck.from} → ${bottleneck.to}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">
                                ${bottleneck.lost} clientes não avançaram nessa etapa (${bottleneck.drop}% de perda).
                                Considere reforçar o follow-up ou revisar a proposta comercial.
                            </div>
                        </div>
                    </div>
                `;
            } else {
                alertEl.style.display = 'none';
            }
        }
    },

    // --- SEÇÃO 2: GRÁFICOS ---
    renderCharts(customers) {
        // 1. Origem
        const origins = ['Google', 'Inativo', 'Prospec', 'Maps'];
        const originData = origins.map(o => customers.filter(c => c.origin === o).length);
        const originColors = ['#818cf8', '#10B981', '#EF9F27', '#4b5563'];

        this.drawDoughnut('chart-analytics-origin', origins, originData, originColors, 'analytics-origin-legend');

        // 2. Temperatura
        const temps = ['Frio', 'Morno', 'Quente', 'Fechando'];
        const tempData = temps.map(t => customers.filter(c => (c.temperature||'Frio') === t).length);
        const tempColors = ['#94a3b8', '#EF9F27', '#f87171', '#10B981'];

        this.drawDoughnut('chart-analytics-temp', temps, tempData, tempColors, 'analytics-temp-legend');
    },

    drawDoughnut(canvasId, labels, data, colors, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const chartKey = canvasId.includes('origin') ? 'origin' : 'temp';

        if (this.charts[chartKey]) this.charts[chartKey].destroy();

        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        this.charts[chartKey] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    hoverOffset: 10,
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });

        // Legenda customizada
        const legend = document.getElementById(legendId);
        if (legend) {
            const total = data.reduce((a, b) => a + b, 0) || 1;
            legend.innerHTML = labels.map((l, i) => {
                const pct = Math.round((data[i] / total) * 100);
                return `
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                        <div style="width:8px;height:8px;border-radius:2px;background:${colors[i]};"></div>
                        <span style="color:var(--text-muted);">${l}:</span>
                        <strong style="color:var(--text-main);">${data[i]} (${pct}%)</strong>
                    </div>
                `;
            }).join('');
        }
    },

    // --- SEÇÃO 3: AMOSTRAS ---
    renderSamples(samples) {
        const inPeriod = samples.filter(s => {
            const date = s.sendDate || s.createdAt?.split('T')[0];
            return date >= this.period.start && date <= this.period.end;
        });

        const stats = {
            'Enviadas': inPeriod.length,
            'Entregues': inPeriod.filter(s => ['Entregue', 'Convertida', 'Rejeitada'].includes(s.status)).length,
            'Convertidas': inPeriod.filter(s => s.status === 'Convertida').length,
            'Rejeitadas': inPeriod.filter(s => s.status === 'Rejeitada').length
        };

        const container = document.getElementById('analytics-samples-stats');
        if (container) {
            container.innerHTML = Object.entries(stats).map(([label, val]) => `
                <div style="background:rgba(255,255,255,0.03);padding:0.8rem;border-radius:10px;">
                    <div style="font-size:1.2rem;font-weight:700;color:var(--text-main);">${val}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">${label}</div>
                </div>
            `).join('');
        }

        // Atrasadas
        const hoje = new Date().toISOString().split('T')[0];
        const late = samples.filter(s => 
            s.status !== 'Entregue' && 
            s.status !== 'Convertida' && 
            s.status !== 'Rejeitada' && 
            s.estimatedReturn && s.estimatedReturn < hoje
        ).sort((a,b) => (a.estimatedReturn||'').localeCompare(b.estimatedReturn||'')).slice(0, 5);

        const lateContainer = document.getElementById('analytics-samples-late');
        if (lateContainer) {
            if (!late.length) {
                lateContainer.innerHTML = '<div style="color:var(--text-muted);font-style:italic;">Nenhuma amostra atrasada no momento.</div>';
            } else {
                lateContainer.innerHTML = late.map(s => {
                    const dias = Math.ceil((new Date(hoje) - new Date(s.estimatedReturn)) / 86400000);
                    return `
                        <div style="display:flex;justify-content:space-between;padding:0.4rem;background:rgba(248,113,113,0.05);border-radius:6px;margin-bottom:0.4rem;">
                            <span>📦 ${s.client} <small style="color:var(--text-muted);">(${s.product})</small></span>
                            <span style="color:#f87171;font-weight:500;">⚠️ ${dias}d atraso</span>
                        </div>
                    `;
                }).join('');
            }
        }
    },

    // --- SEÇÃO 4: REATIVAÇÃO ---
    renderReactivation(customers) {
        const inativos = customers.filter(c => c.origin === 'Inativo');
        const listEl = document.getElementById('analytics-reactivation-list');
        if (!listEl) return;
        
        const getTicket = (notes) => {
            const match = (notes||'').match(/Ticket médio: R\$\s?([\d.,]+)/i);
            return match ? parseFloat(match[1].replace(/\./g,'').replace(',','.')) : 0;
        };

        const today = new Date();
        const top5 = inativos
            .filter(c => !c.temperature || c.temperature === 'Frio')
            .map(c => ({
                ...c,
                ticket: getTicket(c.notes),
                dias: c.lastContactDate ? Math.ceil((today - new Date(c.lastContactDate)) / 86400000) : 999
            }))
            .sort((a, b) => b.ticket - a.ticket)
            .slice(0, 5);

        if (!top5.length) {
            listEl.innerHTML = '<div style="padding:1rem;color:var(--text-muted);text-align:center;">Nenhum inativo para reativar.</div>';
            return;
        }

        listEl.innerHTML = top5.map((c, i) => `
            <div style="display:flex;align-items:center;padding:0.8rem;border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="width:24px;font-weight:700;color:var(--primary);">${i+1}</div>
                <div style="flex:1;">
                    <div style="font-size:0.85rem;font-weight:600;">${c.client || c.name}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">Inativo há ${c.dias} dias</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.85rem;color:#10B981;font-weight:600;">R$ ${c.ticket.toLocaleString('pt-BR')}</div>
                    <button class="btn btn-outline" style="font-size:0.65rem;padding:0.2rem 0.5rem;margin-top:0.3rem;" onclick="CRMModule.editContact('${c.id}')">Contatar</button>
                </div>
            </div>
        `).join('');
    },

    // --- SEÇÃO 5: ATIVIDADE ---
    renderActivity(customers, samples, prospects) {
        const novos = customers.filter(c => c.createdAt >= this.period.start && c.createdAt <= this.period.end);
        const cadenceEl = document.getElementById('analytics-cadence-container');
        if (!cadenceEl) return;
        
        // Agrupar por semana (simplificado)
        const weeks = [0, 0, 0, 0]; // Últimas 4 semanas
        const now = new Date();
        novos.forEach(c => {
            const diff = Math.floor((now - new Date(c.createdAt)) / (86400000 * 7));
            if (diff >= 0 && diff < 4) weeks[3 - diff]++;
        });

        const max = Math.max(...weeks) || 1;
        cadenceEl.innerHTML = [...weeks].reverse().map((count, i) => {
            const pct = (count / max) * 100;
            return `
                <div style="display:flex;align-items:center;gap:0.8rem;margin-bottom:0.6rem;">
                    <span style="font-size:0.75rem;color:var(--text-muted);width:55px;">Semana ${4-i}</span>
                    <div style="flex:1;height:10px;background:rgba(255,255,255,0.05);border-radius:5px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:#10B981;opacity:${0.4 + (pct/100)*0.6};"></div>
                    </div>
                    <span style="font-size:0.75rem;color:var(--text-main);width:20px;text-align:right;">${count}</span>
                </div>
            `;
        }).join('');

        const avg = (weeks.reduce((a,b)=>a+b, 0) / 4).toFixed(1);
        const summaryEl = document.getElementById('analytics-activity-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                📊 Média de <strong>${avg}</strong> novos contatos por semana.<br>
                🎯 <strong>${prospects.filter(p => p.createdAt >= this.period.start).length}</strong> novas prospecções mineradas.
            `;
        }
    }
};

window.AnalyticsModule = AnalyticsModule;

document.addEventListener('DOMContentLoaded', () => {
    AnalyticsModule.init();
});
