/**
 * Dashboard (Resumo) Module
 */

const DashboardModule = {
    chartInstance: null,

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadGoal();
        // Não carrega os dados aqui, será chamado pelo App.js quando a aba for aberta
    },

    cacheDOM() {
        this.dom = {
            canvas: document.getElementById('salesChart'),
            categoryCanvas: document.getElementById('categoryChart'),
            categoryTitle: document.getElementById('category-chart-title'),
            
            // New KPI Stats
            avgTicket: document.getElementById('stat-avg-ticket'),
            avgTicketChange: document.getElementById('stat-avg-ticket-change'),
            growth: document.getElementById('stat-growth'),
            growthTrend: document.getElementById('stat-growth-trend'),
            forecast: document.getElementById('stat-forecast')
        };
    },

    bindEvents() {
        this.dom.btnSaveGoal.addEventListener('click', () => {
            const val = parseFloat(this.dom.goalInput.value) || 0;
            localStorage.setItem('crm_monthly_goal', val);
            alert('Meta do mês salva com sucesso!');
            this.update();
        });
    },

    loadGoal() {
        const savedGoal = localStorage.getItem('crm_monthly_goal');
        if (savedGoal) {
            this.dom.goalInput.value = savedGoal;
        }
    },

    update() {
        const sales = DataStore.get(STORAGE_KEYS.SALES) || [];
        
        // Obter mês atual e anterior
        const now = new Date();
        const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(now.getMonth() - 1);
        const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Calcular dados
        this.updateGoalProgress(sales, curMonthPrefix);
        this.updateAnalytics(sales, curMonthPrefix, lastMonthPrefix);
        this.updateRanking(sales);
        this.renderChart(sales);
        this.renderCategoryChart(sales, curMonthPrefix);
    },

    updateAnalytics(sales, curMonthPrefix, lastMonthPrefix) {
        const curSales = sales.filter(s => s.saleDate && s.saleDate.startsWith(curMonthPrefix));
        const lastSales = sales.filter(s => s.saleDate && s.saleDate.startsWith(lastMonthPrefix));

        const curTotal = curSales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
        const lastTotal = lastSales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);

        // 1. Ticket Médio
        const avgTicket = curSales.length > 0 ? curTotal / curSales.length : 0;
        this.dom.avgTicket.innerText = Utils.formatCurrency(avgTicket);
        
        // 2. Crescimento Mensal
        if (lastTotal > 0) {
            const growth = ((curTotal - lastTotal) / lastTotal) * 100;
            this.dom.growth.innerText = growth.toFixed(1) + '%';
            this.dom.growthTrend.innerText = growth >= 0 ? '↑ vs mês anterior' : '↓ vs mês anterior';
            this.dom.growthTrend.className = 'stat-change ' + (growth >= 0 ? 'stat-up' : 'stat-down');
        } else {
            this.dom.growth.innerText = '--';
            this.dom.growthTrend.innerText = 'Sem dados anteriores';
        }

        // 3. Previsão de Fechamento (Run Rate)
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDay = now.getDate();
        const forecast = (curTotal / currentDay) * daysInMonth;
        this.dom.forecast.innerText = Utils.formatCurrency(forecast);
    },

    updateGoalProgress(sales, currentMonthPrefix) {
        // Filtrar e somar as vendas apenas do mês vigente pelo saleDate
        const currentMonthSales = sales.filter(s => s.saleDate && s.saleDate.startsWith(currentMonthPrefix));
        const totalRealized = currentMonthSales.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
        
        const goal = parseFloat(this.dom.goalInput.value) || Number(localStorage.getItem('crm_monthly_goal')) || 0;
        
        // Atualizar textos
        this.dom.goalRealized.innerText = Utils.formatCurrency(totalRealized);
        
        if (goal > 0) {
            const remaining = Math.max(0, goal - totalRealized);
            this.dom.goalRemaining.innerText = Utils.formatCurrency(remaining);
            
            let percentage = Math.round((totalRealized / goal) * 100);
            const displayPercentage = percentage > 100 ? 100 : percentage;
            
            this.dom.goalProgressBar.style.width = displayPercentage + '%';
            this.dom.goalPercentage.innerText = percentage + '%';
            
            if (percentage >= 100) {
                this.dom.goalProgressBar.style.background = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'; // Verde de sucesso
            } else {
                this.dom.goalProgressBar.style.background = 'linear-gradient(90deg, var(--primary) 0%, #3b82f6 100%)';
            }
        } else {
            this.dom.goalRemaining.innerText = "Defina a meta";
            this.dom.goalProgressBar.style.width = '0%';
            this.dom.goalPercentage.innerText = '0%';
        }
    },

    updateRanking(sales) {
        // Agrupar todas as vendas por cliente sumulando o total geral
        const clientTotals = {};
        sales.forEach(sale => {
            if (!sale.client) return;
            const val = parseFloat(sale.value) || 0;
            if(!clientTotals[sale.client]) clientTotals[sale.client] = 0;
            clientTotals[sale.client] += val;
        });

        // Converter em array, ordenar e pegar o Top 10
        const sortedClients = Object.keys(clientTotals).map(client => {
            return { name: client, total: clientTotals[client] };
        }).sort((a, b) => b.total - a.total).slice(0, 10);

        // Renderizar tabela de ranking
        this.dom.rankingBody.innerHTML = '';
        if (sortedClients.length === 0) {
            this.dom.rankingBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma venda registrada ainda.</td></tr>`;
            return;
        }

        sortedClients.forEach((item, index) => {
            let medal = `#${index + 1}`;
            if(index === 0) medal = `🥇`;
            if(index === 1) medal = `🥈`;
            if(index === 2) medal = `🥉`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold; color: ${index < 3 ? 'var(--warning)' : 'var(--text-muted)'};">${medal}</td>
                <td><strong>${item.name}</strong></td>
                <td>${Utils.formatCurrency(item.total)}</td>
            `;
            this.dom.rankingBody.appendChild(tr);
        });
    },

    renderChart(sales) {
        if (!this.dom.canvas) return;
        
        // Agrupar vendas por mês (YYYY-MM)
        const monthlyData = {};
        
        sales.forEach(s => {
            if (!s.saleDate) return;
            const monthKey = s.saleDate.substring(0, 7); // Ex: "2023-10"
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { vendas: 0, comissao: 0 };
            }
            monthlyData[monthKey].vendas += parseFloat(s.value) || 0;
            monthlyData[monthKey].comissao += parseFloat(s.commission) || 0;
        });

        // Ordenar as chaves (meses mais antigos primeiro)
        const sortedMonths = Object.keys(monthlyData).sort();
        
        // Se houver mais de 6 meses, pegamos apenas os últimos 6 para não ficar poluído
        const lastMonths = sortedMonths.slice(-6);
        
        const labels = lastMonths.map(m => {
            const [year, month] = m.split('-');
            const monthName = new Date(year, parseInt(month)-1).toLocaleString('pt-BR', { month: 'short' });
            return `${monthName}/${year.substring(2)}`;
        });
        
        const dataVendas = lastMonths.map(m => monthlyData[m].vendas);
        const dataComissao = lastMonths.map(m => monthlyData[m].comissao);

        // Se o gráfico já existir, destruímos ele antes de renderizar um novo para não bugar o hover
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const ctx = this.dom.canvas.getContext('2d');
        
        // Pegar a cor primária do CSS roots
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#3b82f6';
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#10b981';

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Sem dados'],
                datasets: [
                    {
                        label: 'Vendas Brutas (R$)',
                        data: dataVendas.length ? dataVendas : [0],
                        borderColor: primaryColor,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        tension: 0.3,
                        pointBackgroundColor: primaryColor,
                        yAxisID: 'y'
                    },
                    {
                        label: profile === 'mamae' ? 'Lucro Acumulado (R$)' : 'Comissão Acumulada (R$)',
                        data: dataComissao.length ? dataComissao : [0],
                        borderColor: accentColor,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        pointBackgroundColor: accentColor,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        labels: { color: '#94a3b8' }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { 
                            color: '#94a3b8',
                            callback: function(value) { return 'R$ ' + (value >= 1000 ? (value/1000).toFixed(1) + 'k' : value); }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false }, // don't draw grid lines for secondary axis
                        ticks: { color: accentColor }
                    }
                }
            }
        });
    },

    renderCategoryChart(sales, curMonthPrefix) {
        if (!this.dom.categoryCanvas) return;
        
        const profile = sessionStorage.getItem('maciel_profile');
        const curMonthSales = sales.filter(s => s.saleDate && s.saleDate.startsWith(curMonthPrefix));
        
        const dataMap = {};
        
        if (profile === 'mamae') {
            this.dom.categoryTitle.innerText = "Lucro por Vinho (Este Mês)";
            curMonthSales.forEach(s => {
                const label = s.productName || "Outros";
                dataMap[label] = (dataMap[label] || 0) + (parseFloat(s.commission) || 0);
            });
        } else {
            this.dom.categoryTitle.innerText = "Performance por Canal (Este Mês)";
            curMonthSales.forEach(s => {
                const label = s.type || "Normal";
                dataMap[label] = (dataMap[label] || 0) + (parseFloat(s.value) || 0);
            });
        }

        const labels = Object.keys(dataMap);
        const values = Object.values(dataMap);

        if (this.categoryChartInstance) this.categoryChartInstance.destroy();

        const ctx = this.dom.categoryCanvas.getContext('2d');
        this.categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['Sem dados'],
                datasets: [{
                    data: values.length ? values : [1],
                    backgroundColor: [
                        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20 } }
                },
                cutout: '70%'
            }
        });
    }
};

window.DashboardModule = DashboardModule;

document.addEventListener('DataStoreReady', () => {
    DashboardModule.init();
});
