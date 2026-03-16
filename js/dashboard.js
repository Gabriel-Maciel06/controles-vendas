/**
 * Dashboard (Resumo) Module — v3.0
 */

const DashboardModule = {
    chartInstance: null,
    categoryChartInstance: null,

    fmt(val) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadGoal();
        this.update();
    },

    cacheDOM() {
        this.dom = {
            goalInput:       document.getElementById('goal-input'),
            btnSaveGoal:     document.getElementById('btn-save-goal'),
            goalRealized:    document.getElementById('goal-realized'),
            goalRemaining:   document.getElementById('goal-remaining'),
            goalProgressBar: document.getElementById('goal-progress-bar'),
            goalPercentage:  document.getElementById('goal-percentage'),
            avgTicket:       document.getElementById('stat-avg-ticket'),
            avgTicketChange: document.getElementById('stat-avg-ticket-change'),
            growth:          document.getElementById('stat-growth'),
            growthTrend:     document.getElementById('stat-growth-trend'),
            forecast:        document.getElementById('stat-forecast'),
            canvas:          document.getElementById('salesChart'),
            categoryCanvas:  document.getElementById('categoryChart'),
            categoryTitle:   document.getElementById('category-chart-title'),
            rankingBody:     document.getElementById('ranking-table-body'),
            crmCard:         document.getElementById('dash-crm-card'),
            samplesCard:     document.getElementById('dash-samples-card'),
            remindersCard:   document.getElementById('dash-reminders-card'),
            activitiesBody:  document.getElementById('dash-activities-body'),
        };
    },

    bindEvents() {
        this.dom.btnSaveGoal?.addEventListener('click', () => {
            const val = parseFloat(this.dom.goalInput?.value) || 0;
            localStorage.setItem('crm_monthly_goal', val);
            alert('Meta do mês salva com sucesso!');
            this.update();
        });
    },

    loadGoal() {
        const saved = localStorage.getItem('crm_monthly_goal');
        if (saved && this.dom.goalInput) this.dom.goalInput.value = saved;
    },

    update() {
        const sales     = DataStore.get(STORAGE_KEYS.SALES)     || [];
        const customers = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        const samples   = DataStore.get(STORAGE_KEYS.SAMPLES)   || [];
        const reminders = DataStore.get(STORAGE_KEYS.REMINDERS) || [];

        const now           = new Date();
        const curPrefix     = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const lastPrefix    = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,'0')}`;

        this.updateGoalProgress(sales, curPrefix);
        this.updateAnalytics(sales, curPrefix, lastPrefix);
        this.updateCRMCard(customers);
        this.updateSamplesCard(samples);
        this.updateRemindersCard(reminders);
        this.updateActivities(customers, samples, reminders);
        this.updateRanking(sales);
        this.renderChart(sales);
        this.renderCategoryChart(sales, curPrefix);
    },

    updateGoalProgress(sales, curPrefix) {
        const curSales  = sales.filter(s => s.saleDate?.startsWith(curPrefix));
        const totalReal = curSales.reduce((s,v) => s+(parseFloat(v.value)||0), 0);
        const goal      = parseFloat(this.dom.goalInput?.value) || parseFloat(localStorage.getItem('crm_monthly_goal')) || 0;

        if (this.dom.goalRealized) this.dom.goalRealized.innerText = this.fmt(totalReal);

        if (goal > 0) {
            const pct        = Math.round((totalReal / goal) * 100);
            const displayPct = Math.min(pct, 100);
            if (this.dom.goalRemaining)   this.dom.goalRemaining.innerText   = this.fmt(Math.max(0, goal - totalReal));
            if (this.dom.goalProgressBar) {
                this.dom.goalProgressBar.style.width      = displayPct + '%';
                this.dom.goalProgressBar.style.background = pct >= 100
                    ? 'linear-gradient(90deg,#10b981 0%,#34d399 100%)'
                    : 'linear-gradient(90deg,var(--primary) 0%,#3b82f6 100%)';
            }
            if (this.dom.goalPercentage) this.dom.goalPercentage.innerText = pct + '%';
        } else {
            if (this.dom.goalRemaining)   this.dom.goalRemaining.innerText   = 'Defina a meta';
            if (this.dom.goalProgressBar) this.dom.goalProgressBar.style.width = '0%';
            if (this.dom.goalPercentage)  this.dom.goalPercentage.innerText  = '0%';
        }
    },

    updateAnalytics(sales, curPrefix, lastPrefix) {
        const curSales  = sales.filter(s => s.saleDate?.startsWith(curPrefix));
        const lastSales = sales.filter(s => s.saleDate?.startsWith(lastPrefix));
        const curTotal  = curSales.reduce((s,v) => s+(parseFloat(v.value)||0), 0);
        const lastTotal = lastSales.reduce((s,v) => s+(parseFloat(v.value)||0), 0);

        const avg = curSales.length > 0 ? curTotal / curSales.length : 0;
        if (this.dom.avgTicket) this.dom.avgTicket.innerText = this.fmt(avg);
        if (this.dom.avgTicketChange) {
            if (lastSales.length > 0) {
                const diff = avg - (lastTotal / lastSales.length);
                this.dom.avgTicketChange.innerText = (diff >= 0 ? '↑ ' : '↓ ') + this.fmt(Math.abs(diff)) + ' vs mês ant.';
                this.dom.avgTicketChange.className = 'stat-change ' + (diff >= 0 ? 'stat-up' : 'stat-down');
            } else {
                this.dom.avgTicketChange.innerText = 'Primeiro mês';
            }
        }

        if (this.dom.growth) {
            if (lastTotal > 0) {
                const growth = ((curTotal - lastTotal) / lastTotal) * 100;
                this.dom.growth.innerText = growth.toFixed(1) + '%';
                if (this.dom.growthTrend) {
                    this.dom.growthTrend.innerText = (growth >= 0 ? '↑' : '↓') + ' vs mês anterior';
                    this.dom.growthTrend.className = 'stat-change ' + (growth >= 0 ? 'stat-up' : 'stat-down');
                }
            } else {
                this.dom.growth.innerText = '--';
                if (this.dom.growthTrend) this.dom.growthTrend.innerText = 'Sem dados anteriores';
            }
        }

        if (this.dom.forecast) {
            const now      = new Date();
            const forecast = (curTotal / now.getDate()) * new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
            this.dom.forecast.innerText = this.fmt(isFinite(forecast) ? forecast : 0);
        }
    },

    updateCRMCard(customers) {
        if (!this.dom.crmCard) return;
        const today  = new Date().toISOString().split('T')[0];
        const latest = {};
        customers.forEach(c => {
            const name = c.name || c.client;
            const date = c.lastContactDate || '';
            if (!latest[name] || date > (latest[name].lastContactDate || '')) latest[name] = c;
        });
        const unique   = Object.values(latest);
        const overdue  = unique.filter(c => c.nextFollowUp && c.nextFollowUp < today).length;
        const dueToday = unique.filter(c => c.nextFollowUp === today).length;

        this.dom.crmCard.innerHTML = `
            <div style="font-size:0.85rem;font-weight:600;color:var(--text-main);margin-bottom:0.8rem;">👥 CRM / Follow-ups</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;text-align:center;">
                <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--text-main);">${unique.length}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Clientes</div>
                </div>
                <div style="background:rgba(239,159,39,0.12);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:#EF9F27;">${dueToday}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Hoje</div>
                </div>
                <div style="background:rgba(226,75,74,0.12);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:#E24B4A;">${overdue}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Atrasados</div>
                </div>
            </div>`;
    },

    updateSamplesCard(samples) {
        if (!this.dom.samplesCard) return;
        const pending  = samples.filter(s => s.status === 'Enviada' || s.status === 'Pendente').length;
        const returned = samples.filter(s => s.status === 'Devolvida').length;

        this.dom.samplesCard.innerHTML = `
            <div style="font-size:0.85rem;font-weight:600;color:var(--text-main);margin-bottom:0.8rem;">📦 Amostras</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;text-align:center;">
                <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--text-main);">${samples.length}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Total</div>
                </div>
                <div style="background:rgba(83,74,183,0.12);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:#9b94e8;">${pending}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Pendentes</div>
                </div>
                <div style="background:rgba(29,158,117,0.12);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:#1D9E75;">${returned}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Devolvidas</div>
                </div>
            </div>`;
    },

    updateRemindersCard(reminders) {
        if (!this.dom.remindersCard) return;
        const today   = new Date().toISOString().split('T')[0];
        const pending = reminders.filter(r => r.status !== 'Concluido' && r.status !== 'Concluído');
        const overdue = pending.filter(r => r.dateLimit < today).length;
        const alta    = pending.filter(r => r.priority === 'Alta').length;

        this.dom.remindersCard.innerHTML = `
            <div style="font-size:0.85rem;font-weight:600;color:var(--text-main);margin-bottom:0.8rem;">✅ Lembretes</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;text-align:center;">
                <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--text-main);">${pending.length}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Pendentes</div>
                </div>
                <div style="background:rgba(226,75,74,0.12);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:#E24B4A;">${alta}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Alta prior.</div>
                </div>
                <div style="background:rgba(239,159,39,0.12);border-radius:8px;padding:0.6rem 0.3rem;">
                    <div style="font-size:1.5rem;font-weight:700;color:#EF9F27;">${overdue}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Atrasados</div>
                </div>
            </div>`;
    },

    updateActivities(customers, samples, reminders) {
        if (!this.dom.activitiesBody) return;
        const today  = new Date().toISOString().split('T')[0];
        const events = [];

        customers.slice(-6).forEach(c => {
            if (c.lastContactDate) events.push({
                date: c.lastContactDate, icon: '📞',
                text: `Contato com <strong>${c.name || c.client}</strong>`,
                sub: c.notes ? c.notes.substring(0,55) + (c.notes.length>55?'...':'') : ''
            });
        });

        samples.slice(-4).forEach(s => {
            events.push({
                date: s.sendDate || s.createdAt?.split('T')[0] || '', icon: '📦',
                text: `Amostra <strong>${s.product}</strong> → ${s.client}`,
                sub: `Status: ${s.status}`
            });
        });

        reminders
            .filter(r => r.status !== 'Concluido' && r.status !== 'Concluído' && r.dateLimit >= today)
            .sort((a,b) => a.dateLimit.localeCompare(b.dateLimit))
            .slice(0,3)
            .forEach(r => events.push({
                date: r.dateLimit,
                icon: r.priority === 'Alta' ? '🔴' : '🟡',
                text: r.title, sub: `Lembrete · ${r.priority}`
            }));

        events.sort((a,b) => (b.date||'').localeCompare(a.date||''));
        const recent = events.slice(0, 8);

        if (!recent.length) {
            this.dom.activitiesBody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.85rem;">Nenhuma atividade registrada ainda.</td></tr>`;
            return;
        }

        this.dom.activitiesBody.innerHTML = recent.map(ev => {
            const d = ev.date ? ev.date.split('-').reverse().join('/') : '-';
            const isToday = ev.date === today;
            return `<tr>
                <td style="font-size:1rem;text-align:center;padding:0.5rem 0.3rem;">${ev.icon}</td>
                <td style="padding:0.5rem 0.3rem;">
                    <div style="font-size:0.84rem;color:var(--text-main);">${ev.text}</div>
                    ${ev.sub ? `<div style="font-size:0.74rem;color:var(--text-muted);">${ev.sub}</div>` : ''}
                </td>
                <td style="font-size:0.77rem;color:${isToday?'#EF9F27':'var(--text-muted)'};white-space:nowrap;padding:0.5rem 0.3rem;">
                    ${isToday ? '🔔 Hoje' : d}
                </td>
            </tr>`;
        }).join('');
    },

    updateRanking(sales) {
        if (!this.dom.rankingBody) return;
        const totals = {};
        sales.forEach(s => {
            if (!s.client) return;
            totals[s.client] = (totals[s.client]||0) + (parseFloat(s.value)||0);
        });
        const sorted = Object.entries(totals).map(([name,total]) => ({name,total}))
            .sort((a,b) => b.total - a.total).slice(0,10);

        if (!sorted.length) {
            this.dom.rankingBody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhuma venda registrada ainda.</td></tr>`;
            return;
        }
        this.dom.rankingBody.innerHTML = sorted.map((item,i) => {
            const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;
            return `<tr>
                <td style="font-weight:bold;color:${i<3?'var(--warning)':'var(--text-muted)'};">${medal}</td>
                <td><strong>${item.name}</strong></td>
                <td>${this.fmt(item.total)}</td>
            </tr>`;
        }).join('');
    },

    renderChart(sales) {
        if (!this.dom.canvas) return;
        const monthly = {};
        sales.forEach(s => {
            if (!s.saleDate) return;
            const k = s.saleDate.substring(0,7);
            if (!monthly[k]) monthly[k] = {vendas:0,comissao:0};
            monthly[k].vendas   += parseFloat(s.value)||0;
            monthly[k].comissao += parseFloat(s.commission)||0;
        });
        const keys   = Object.keys(monthly).sort().slice(-6);
        const labels = keys.map(m => {
            const [y,mo] = m.split('-');
            return new Date(y,parseInt(mo)-1).toLocaleString('pt-BR',{month:'short'})+'/'+y.slice(2);
        });
        if (this.chartInstance) this.chartInstance.destroy();
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()||'#6366f1';
        const accent  = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() ||'#10b981';
        this.chartInstance = new Chart(this.dom.canvas.getContext('2d'), {
            type:'line',
            data:{
                labels: labels.length?labels:['Sem dados'],
                datasets:[
                    {label:'Vendas (R$)',data:keys.length?keys.map(k=>monthly[k].vendas):[0],
                     borderColor:primary,backgroundColor:'transparent',borderWidth:3,tension:0.3,pointBackgroundColor:primary,yAxisID:'y'},
                    {label:'Comissão (R$)',data:keys.length?keys.map(k=>monthly[k].comissao):[0],
                     borderColor:accent,backgroundColor:'transparent',borderWidth:2,borderDash:[5,5],tension:0.3,pointBackgroundColor:accent,yAxisID:'y1'}
                ]
            },
            options:{
                responsive:true,maintainAspectRatio:false,
                interaction:{mode:'index',intersect:false},
                plugins:{
                    tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+this.fmt(ctx.parsed.y)}},
                    legend:{labels:{color:'#94a3b8'}}
                },
                scales:{
                    x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#94a3b8'}},
                    y:{type:'linear',position:'left',grid:{color:'rgba(255,255,255,0.05)'},
                       ticks:{color:'#94a3b8',callback:v=>'R$ '+(v>=1000?(v/1000).toFixed(1)+'k':v)}},
                    y1:{type:'linear',position:'right',grid:{drawOnChartArea:false},ticks:{color:accent}}
                }
            }
        });
    },

    renderCategoryChart(sales, curPrefix) {
        if (!this.dom.categoryCanvas) return;
        const curSales = sales.filter(s => s.saleDate?.startsWith(curPrefix));
        const profile = sessionStorage.getItem('maciel_profile');
        const dataMap  = {};

        if (profile === 'mamae') {
            if (this.dom.categoryTitle) this.dom.categoryTitle.innerText = 'Lucro por Vinho (Este Mês)';
            curSales.forEach(s => {
                const label = s.productName || 'Outros';
                dataMap[label] = (dataMap[label] || 0) + (parseFloat(s.commission) || 0);
            });
        } else {
            if (this.dom.categoryTitle) this.dom.categoryTitle.innerText = 'Performance por Canal (Este Mês)';
            curSales.forEach(s => {
                const label = s.type || 'Normal';
                dataMap[label] = (dataMap[label] || 0) + (parseFloat(s.value) || 0);
            });
        }

        const labels = Object.keys(dataMap);
        const values = Object.values(dataMap);
        if (this.categoryChartInstance) this.categoryChartInstance.destroy();
        this.categoryChartInstance = new Chart(this.dom.categoryCanvas.getContext('2d'), {
            type:'doughnut',
            data:{
                labels:labels.length?labels:['Sem dados'],
                datasets:[{data:values.length?values:[1],
                    backgroundColor:['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'],borderWidth:0}]
            },
            options:{responsive:true,maintainAspectRatio:false,
                plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',padding:20}}},cutout:'70%'}
        });
    }
};

window.DashboardModule = DashboardModule;

document.addEventListener('DataStoreReady', () => {
    DashboardModule.init();
});
