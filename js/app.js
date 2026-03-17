/**
 * Global Utilities
 */
window.Utils = {
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
};

const AppModule = {
    init() {
        this.checkAuth();
        // Start cloud data sync
        DataStore.init();
    },

    onDataReady() {
        this.initNavigation();

        // Default Settings Setup
        if (Object.keys(DataStore.get(STORAGE_KEYS.SETTINGS)).length === 0) {
            DataStore.set(STORAGE_KEYS.SETTINGS, {
                google: 100,
                reativacao: 100,
                introducao: 25
            });
        }

        this.initTopbarFeatures();
        this.initMobileMenu();
    },

    checkAuth() {
        const overlay   = document.getElementById('login-overlay');
        const form      = document.getElementById('login-form');
        const passInput = document.getElementById('login-password');
        const errorMsg  = document.getElementById('login-error');
        const btnSubmit = form?.querySelector('button[type="submit"]');

        // Já autenticado nesta sessão
        if (sessionStorage.getItem('maciel_auth') === 'true') {
            overlay.style.display = 'none';
            this.applyProfileTheme();
            return;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pass = passInput.value;

            // UI: mostra loading
            if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = 'Verificando... <i class="bx bx-loader-alt bx-spin"></i>'; }
            errorMsg.style.display = 'none';

            try {
                const res = await fetch('https://controles-vendas.onrender.com/api/login', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ password: pass })
                });

                if (res.ok) {
                    const data = await res.json();
                    sessionStorage.setItem('maciel_auth',    'true');
                    sessionStorage.setItem('maciel_profile', data.profile || 'default');
                    sessionStorage.setItem('maciel_token',   data.token   || '');
                    overlay.style.display = 'none';
                    this.applyProfileTheme();
                } else {
                    // Senha errada
                    errorMsg.style.display = 'block';
                    passInput.value = '';
                    passInput.focus();
                }
            } catch (err) {
                // Backend offline — fallback local temporário para não travar o sistema
                console.warn('Backend offline, usando fallback local:', err.message);
                errorMsg.textContent = 'Servidor indisponível. Tente novamente em instantes.';
                errorMsg.style.display = 'block';
            } finally {
                if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = 'Entrar <i class="bx bx-right-arrow-alt"></i>'; }
            }
        });
    },

    applyProfileTheme() {
        const profile = sessionStorage.getItem('maciel_profile') || 'default';
        if (profile === 'mamae') {
            document.title = "Controle Vendas Mamãe";
            document.documentElement.style.setProperty('--primary', '#9d174d'); // Vinho/Bordô escuro
            document.documentElement.style.setProperty('--accent', '#db2777'); // Vinho rosa/claro para contraste
            document.documentElement.style.setProperty('--bg-sidebar', '#4c0519'); // Sidebar vinho super escuro
            
            const logoText = document.querySelector('.logo-text');
            if (logoText) {
                logoText.innerHTML = "Controle<br>Mamãe";
            }
            
            // Injetar CSS para esconder as opções de Google e Reativacao que não pertencem ao perfil
            const style = document.createElement('style');
            style.innerHTML = `
                /* Esconder opções no select de Venda */
                #sale-type option[value="Google"],
                #sale-type option[value="Reativacao"],
                #sale-type option[value="Introducao"] {
                    display: none !important;
                }
                
                /* Esconder painéis de KPI do topo */
                .kpi-card:has(#kpi-google-count),
                .kpi-card:has(#kpi-reativacao-count),
                .kpi-card:has(#kpi-introducao-count) {
                    display: none !important;
                }
                
                /* Esconder Data Prev. Faturamento */
                #sale-faturamento, label[for="sale-faturamento"] {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);

            // Mudar Labels e Remover Obrigatórios
            const boxesLabel = document.querySelector('label[for="sale-boxes"]');
            if (boxesLabel) boxesLabel.innerText = "Qtd. Vinhos";

            const valueLabel = document.querySelector('label[for="sale-value"]');
            if (valueLabel) valueLabel.innerText = "Valor Venda (R$)";

            const fatInput = document.getElementById('sale-faturamento');
            if (fatInput) fatInput.removeAttribute('required');

            // Mostrar campos novos
            document.getElementById('mamae-product-group')?.classList.remove('hidden');
            document.getElementById('mamae-cost-group')?.classList.remove('hidden');

            // Esconder campos irrelevantes para ela (Tipo e Caixas - vamos esconder o container row)
            const saleTypeSelect = document.getElementById('sale-type');
            const saleBoxesInput = document.getElementById('sale-boxes');
            
            if (saleTypeSelect) {
                saleTypeSelect.value = 'Normal';
                saleTypeSelect.removeAttribute('required');
                saleTypeSelect.closest('.form-group').style.display = 'none';
            }
            if (saleBoxesInput) {
                saleBoxesInput.value = '0';
                saleBoxesInput.closest('.form-group').style.display = 'none';
            }

            // Mudar texto de Comissão para Lucro nos KPIs
            const commTitle = document.querySelector('.kpi-card.highlight h3');
            if (commTitle) commTitle.innerText = "Lucro Total";
        } else {
            // RESET PARA PERFIL MACIEL (Default)
            document.title = "Controle Vendas Maciel";
            document.documentElement.style.removeProperty('--primary');
            document.documentElement.style.removeProperty('--accent');
            document.documentElement.style.removeProperty('--bg-sidebar');

            const logoText = document.querySelector('.logo-text');
            if (logoText) logoText.innerHTML = "Controle Vendas Maciel";

            // Garantir que campos da mamae fiquem ocultos
            document.getElementById('mamae-product-group')?.classList.add('hidden');
            document.getElementById('mamae-cost-group')?.classList.add('hidden');

            // Garantir que campos originais apareçam
            const saleTypeGroup = document.getElementById('sale-type')?.closest('.form-group');
            const saleBoxesGroup = document.getElementById('sale-boxes')?.closest('.form-group');
            if (saleTypeGroup) saleTypeGroup.style.display = 'block';
            if (saleBoxesGroup) saleBoxesGroup.style.display = 'block';

            // Restaurar labels
            const boxesLabel = document.querySelector('label[for="sale-boxes"]');
            if (boxesLabel) boxesLabel.innerText = "Caixas 20056 (Qtd)";

            const valueLabel = document.querySelector('label[for="sale-value"]');
            if (valueLabel) valueLabel.innerText = "Valor Faturado (R$)";

            const fatInput = document.getElementById('sale-faturamento');
            if (fatInput) fatInput.setAttribute('required', 'true');

            // Restaurar KPI
            const commTitle = document.querySelector('.kpi-card.highlight h3');
            if (commTitle) commTitle.innerText = "Comissão Total";
        }
    },

    initNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const viewSections = document.querySelectorAll('.view-section');
        const pageTitleEl = document.getElementById('current-page-title');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Get target view ID
                const targetId = item.getAttribute('data-target');

                // Update active state on nav items
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Update page title
                const titleText = item.querySelector('span').innerText;
                pageTitleEl.innerText = titleText;

                // Show target view, hide others
                viewSections.forEach(section => {
                    if (section.id === `view-${targetId}`) {
                        // Small delay to reset animation
                        section.classList.remove('hidden');
                        section.classList.add('active');
                        
                        // DASHBOARD AUTO-UPDATE on open
                        if (targetId === 'dashboard' && window.DashboardModule) {
                            window.DashboardModule.update();
                        }
                        // KANBAN RENDER on open
                        if (targetId === 'kanban' && window.KanbanModule) {
                            window.KanbanModule.render();
                        }
                    } else {
                        section.classList.remove('active');
                        section.classList.add('hidden');
                    }
                });
            });
        });
    },

    initTopbarFeatures() {
        const btnSettings = document.getElementById('btn-settings');
        const modalSettings = document.getElementById('settings-modal');
        const btnCloseSettings = document.getElementById('btn-close-settings');

        const btnNotif = document.getElementById('btn-notifications');
        const panelNotif = document.getElementById('notifications-panel');

        // Logout
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                sessionStorage.removeItem('maciel_auth');
                sessionStorage.removeItem('maciel_profile');
                location.reload(); // Recarrega tela inteira para resetar os state caches
            });
        }

        // Settings Modal
        if (btnSettings && modalSettings) {
            btnSettings.addEventListener('click', () => {
                const config = DataStore.get(STORAGE_KEYS.SETTINGS) || {};
                document.getElementById('setting-google').value = config.google || 100;
                document.getElementById('setting-reativacao').value = config.reativacao || 100;
                document.getElementById('setting-introducao').value = config.introducao || 25;
                modalSettings.classList.remove('hidden');
            });

            btnCloseSettings.addEventListener('click', () => {
                // Save settings on close
                const newSettings = {
                    google: parseFloat(document.getElementById('setting-google').value) || 0,
                    reativacao: parseFloat(document.getElementById('setting-reativacao').value) || 0,
                    introducao: parseFloat(document.getElementById('setting-introducao').value) || 0
                };
                DataStore.set(STORAGE_KEYS.SETTINGS, newSettings);
                modalSettings.classList.add('hidden');

                // Force Recalculation if SalesModule is active
                if (window.SalesModule) {
                    window.SalesModule.fixLegacyData();
                    window.SalesModule.loadSales();
                }
            });
        }

        // Data Management
        document.getElementById('btn-clear-data')?.addEventListener('click', () => {
            if (confirm("ATENÇÃO: Isso vai apagar todas as vendas e dados salvos no seu computador. Deseja continuar?")) {
                localStorage.clear();
                location.reload();
            }
        });

        document.getElementById('btn-export-data')?.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DataStore.cache));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `bkp_vendas_maciel_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });

        // Lógica de Importação Blindada
        const btnImport = document.getElementById('btn-import-data');
        const fileInput = document.getElementById('import-file');

        if (btnImport && fileInput) {
            btnImport.onclick = () => fileInput.click();

            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const importedData = JSON.parse(event.target.result);
                        if (confirm("Importar backup? Isso limpará os dados atuais do servidor e colocará os do arquivo.")) {
                            btnImport.innerText = "Sincronizando...";
                            btnImport.disabled = true;

                            const keys = ['crm_sales', 'crm_customers', 'crm_samples', 'crm_reminders'];
                            for (const key of keys) {
                                if (Array.isArray(importedData[key])) {
                                    for (const item of importedData[key]) {
                                        await DataStore.add(key, item);
                                    }
                                }
                            }
                            alert("Sucesso! O sistema será reiniciado.");
                            location.reload();
                        }
                    } catch (err) {
                        alert("Erro no arquivo de backup.");
                    } finally {
                        btnImport.innerText = "Importar Backup";
                        btnImport.disabled = false;
                    }
                };
                reader.readAsText(file);
            };
        }



        // Notifications
        if (btnNotif && panelNotif) {
            btnNotif.addEventListener('click', () => {
                panelNotif.classList.toggle('hidden');
                this.updateNotifications();
            });
            // Update dot on load
            setTimeout(() => this.updateNotifications(true), 500); // let data load first
        }
    },

    updateNotifications(dotOnly = false) {
        const sales = DataStore.get(STORAGE_KEYS.SALES) || [];
        const contacts = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        const reminders = DataStore.get(STORAGE_KEYS.REMINDERS) || [];

        let notifs = [];

        const today = new Date();
        // Reminders Due Today or Overdue
        let dueReminders = 0;
        reminders.forEach(r => {
            const rmdDate = new Date(`${r.dateLimit}T${r.timeLimit || '00:00'}:00`);
            if (rmdDate <= today) dueReminders++;
        });
        if (dueReminders > 0) {
            notifs.push(`<div class="notif-item" style="color:var(--warning)"><i class='bx bx-check-square'></i> Você tem ${dueReminders} lembrete(s) pendente(s) para hoje ou atrasados!</div>`);
        }

        // Example logic: Sales this month
        const now = new Date();
        const thisMonthSales = sales.filter(s => new Date((s.saleDate || '').split('T')[0] + 'T00:00:00').getMonth() === now.getMonth());
        if (thisMonthSales.length > 0) {
            notifs.push(`<div class="notif-item"><i class='bx bx-trending-up' style="color:var(--accent)"></i> Você tem ${thisMonthSales.length} vendas registradas este mês!</div>`);
        } else {
            notifs.push(`<div class="notif-item"><i class='bx bx-info-circle'></i> Nenhuma venda registrada este mês ainda.</div>`);
        }

        // Overdue followups
        let overdue = 0;
        contacts.forEach(c => {
            if (c.nextFollowUp && new Date(c.nextFollowUp + 'T00:00:00') < today) overdue++;
        });
        if (overdue > 0) {
            notifs.push(`<div class="notif-item" style="color:var(--danger)"><i class='bx bx-alarm-exclamation'></i> Você tem ${overdue} follow-ups atrasados no CRM!</div>`);
        }

        const dot = document.getElementById('notif-dot');
        if (dot) {
            if (overdue > 0 || thisMonthSales.length > 0 || dueReminders > 0) dot.style.display = 'block';
            else dot.style.display = 'none';
        }

        if (!dotOnly) {
            document.getElementById('notifications-list').innerHTML = notifs.join('');
        }
    },

    initMobileMenu() {
        const btnToggle = document.getElementById('btn-menu-toggle');
        const sidebar = document.getElementById('main-sidebar');
        if (!btnToggle || !sidebar) return;

        btnToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-active');
        });

        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !btnToggle.contains(e.target) && sidebar.classList.contains('mobile-active')) {
                sidebar.classList.remove('mobile-active');
            }
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 1100) {
                    sidebar.classList.remove('mobile-active');
                }
            });
        });
    }
};

window.AppModule = AppModule;

document.addEventListener('DOMContentLoaded', () => {
    AppModule.init();
});

document.addEventListener('DataStoreReady', () => {
    AppModule.onDataReady();
});
