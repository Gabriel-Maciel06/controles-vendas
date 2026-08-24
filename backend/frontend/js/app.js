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
        this.initChangePassword();
        // DataStore.init() é chamado dentro do checkAuth() após autenticação bem-sucedida
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
        this.applyProfileTheme();

        // Notifications
        this.updateNotifications(true);

        // Auto-render whichever view is currently active when DataStore initializes
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            const targetId = activeNav.getAttribute('data-target');
            this.renderView(targetId);
        } else {
            this.renderView('sales');
        }
    },

    /**
     * Re-renderiza completamente a app com o perfil atual do DataStore.
     * Chamado após login ou troca de conta.
     */
    reloadForProfile() {
        this.applyProfileTheme();
        this.updateNotifications(true);
        // Força re-render do módulo ativo atual
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            const targetId = activeNav.getAttribute('data-target');
            this.renderView(targetId);
        } else {
            this.renderView('sales');
        }
    },

    checkAuth() {
        const overlay       = document.getElementById('login-overlay');
        const form          = document.getElementById('login-form');
        const usernameInput = document.getElementById('login-username');
        const passInput     = document.getElementById('login-password');
        const errorMsg      = document.getElementById('login-error');
        const btnSubmit     = form?.querySelector('button[type="submit"]');

        // Check if user is already authenticated in sessionStorage or localStorage
        const isAuth = sessionStorage.getItem('maciel_auth') === 'true' || localStorage.getItem('maciel_auth') === 'true';
        if (isAuth) {
            const activeProfile = window.getActiveProfile ? window.getActiveProfile() : (localStorage.getItem('maciel_profile') || 'default');
            const activeUser = localStorage.getItem('maciel_username') || sessionStorage.getItem('maciel_username') || 'Maciel';
            const activeToken = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || 'local_session_token';

            sessionStorage.setItem('maciel_auth', 'true');
            sessionStorage.setItem('maciel_profile', activeProfile);
            sessionStorage.setItem('maciel_username', activeUser);
            sessionStorage.setItem('maciel_token', activeToken);

            localStorage.setItem('maciel_auth', 'true');
            localStorage.setItem('maciel_profile', activeProfile);
            localStorage.setItem('maciel_username', activeUser);
            localStorage.setItem('maciel_token', activeToken);

            if (overlay) {
                overlay.style.setProperty('display', 'none', 'important');
                overlay.classList.add('hidden');
            }
            this.applyProfileTheme();
            DataStore.init();
            return;
        }

        // Usuário não autenticado — remove estilo de bypass e exibe modal de login
        const bypassStyle = document.getElementById('auth-bypass-style');
        if (bypassStyle) bypassStyle.remove();

        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
        }

        if (!form) return;

        form.onsubmit = async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();

            const userVal = usernameInput ? usernameInput.value.trim() : '';
            const passVal = passInput ? passInput.value.trim() : '';

            if (!passVal) {
                if (errorMsg) {
                    errorMsg.textContent = 'Por favor, insira sua senha de acesso.';
                    errorMsg.style.display = 'block';
                }
                return false;
            }

            // UI: mostra loading
            if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = 'Autenticando... <i class="bx bx-loader-alt bx-spin"></i>'; }
            if (errorMsg) errorMsg.style.display = 'none';

            try {
                let authSuccess = false;
                let userProfile = 'default';
                let username = userVal || 'Maciel';
                let token = '';

                try {
                    const res = await fetch(`${API_BASE_URL}/login`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ username: userVal, password: passVal })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        authSuccess = true;
                        token = data.token || '';
                        userProfile = data.profile || 'default';
                        username = data.username || userVal || 'Maciel';
                    }
                } catch (apiErr) {
                    console.warn('[Login] API backend offline, validando localmente:', apiErr);
                }

                // Se API não respondeu ou erro 401/rede, mapeia o profile pelo nome inserido
                if (!authSuccess) {
                    const cleanUser = (userVal || '').trim().toLowerCase();
                    const profileMap = {
                        'maciel': 'default',
                        'default': 'default',
                        'albert': 'albert',
                        'almeida': 'almeida',
                        'hugo': 'hugo',
                        'igor': 'igor',
                        'mateus': 'mateus',
                        'gabriel': 'gabriel',
                        'fernanda': 'fernanda',
                        'caio': 'caio',
                        'karine': 'karine'
                    };
                    userProfile = profileMap[cleanUser] || 'default';
                    username = userVal || 'Maciel';
                    token = 'local_fallback_token';
                    authSuccess = true;
                }

                if (authSuccess) {
                    // Gravação SÍNCRONA imediata em ambos os storages para persistência no 1º clique
                    sessionStorage.setItem('maciel_auth',        'true');
                    sessionStorage.setItem('maciel_profile',     userProfile);
                    sessionStorage.setItem('maciel_username',    username);
                    sessionStorage.setItem('maciel_token',       token || 'local_session_token');
                    sessionStorage.setItem('_maciel_session_key', passVal);

                    localStorage.setItem('maciel_auth',        'true');
                    localStorage.setItem('maciel_profile',     userProfile);
                    localStorage.setItem('maciel_username',    username);
                    localStorage.setItem('maciel_token',       token || 'local_session_token');
                    localStorage.setItem('_maciel_session_key', passVal);

                    // Oculta o overlay de login IMEDIATAMENTE no primeiro clique
                    if (overlay) {
                        overlay.style.display = 'none';
                        overlay.classList.add('hidden');
                    }
                    this.applyProfileTheme();

                    // Recarrega a página para garantir que todos os scripts são carregados frescos
                    // e que nenhum dado do perfil anterior fique em memória
                    window.location.reload();
                    return false;
                }
            } catch (err) {
                console.warn('Erro ao processar login:', err.message);
                if (errorMsg) {
                    errorMsg.textContent = 'Erro ao processar acesso. Tente novamente.';
                    errorMsg.style.display = 'block';
                }
            } finally {
                if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = 'Entrar <i class="bx bx-right-arrow-alt"></i>'; }
            }
            return false;
        };
    },

    initChangePassword() {
        const btnChange   = document.getElementById('btn-change-password');
        const modal       = document.getElementById('change-password-modal');
        const closeBtn    = document.getElementById('close-change-password');
        const form        = document.getElementById('change-password-form');
        const currentPass = document.getElementById('cp-current-password');
        const newPass     = document.getElementById('cp-new-password');
        const confirmPass = document.getElementById('cp-confirm-password');
        const errorMsg    = document.getElementById('cp-error');
        const successMsg  = document.getElementById('cp-success');

        if (btnChange && modal) {
            btnChange.onclick = (e) => {
                e.preventDefault();
                if (currentPass) currentPass.value = '';
                if (newPass) newPass.value = '';
                if (confirmPass) confirmPass.value = '';
                if (errorMsg) errorMsg.style.display = 'none';
                if (successMsg) successMsg.style.display = 'none';
                modal.classList.remove('hidden');
            };
        }

        if (closeBtn && modal) {
            closeBtn.onclick = (e) => {
                e.preventDefault();
                modal.classList.add('hidden');
            };
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                errorMsg.style.display = 'none';
                successMsg.style.display = 'none';

                const curVal  = currentPass.value;
                const newVal  = newPass.value;
                const confVal = confirmPass.value;

                if (newVal !== confVal) {
                    errorMsg.textContent = 'As novas senhas não coincidem.';
                    errorMsg.style.display = 'block';
                    return;
                }

                if (newVal.length < 4) {
                    errorMsg.textContent = 'A nova senha deve ter pelo menos 4 caracteres.';
                    errorMsg.style.display = 'block';
                    return;
                }

                const token = sessionStorage.getItem('maciel_token');
                try {
                    const btnSave = form.querySelector('button[type="submit"]');
                    if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Salvando...'; }

                    const res = await fetch(`${API_BASE_URL}/change-password`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            currentPassword: curVal,
                            newPassword: newVal
                        })
                    });

                    if (res.ok) {
                        successMsg.textContent = 'Senha alterada com sucesso!';
                        successMsg.style.display = 'block';
                        sessionStorage.setItem('_maciel_session_key', newVal);
                        setTimeout(() => {
                            modal.classList.add('hidden');
                        }, 1500);
                    } else {
                        const errData = await res.json();
                        errorMsg.textContent = errData.detail || 'Erro ao alterar a senha.';
                        errorMsg.style.display = 'block';
                    }
                } catch (err) {
                    errorMsg.textContent = 'Erro de conexão com o servidor.';
                    errorMsg.style.display = 'block';
                } finally {
                    const btnSave = form.querySelector('button[type="submit"]');
                    if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Salvar Nova Senha'; }
                }
            };
        }
    },

    applyProfileTheme() {
        const profile = sessionStorage.getItem('maciel_profile') || localStorage.getItem('maciel_profile') || 'default';
        let username = sessionStorage.getItem('maciel_username') || localStorage.getItem('maciel_username') || 'Maciel';
        if (username === 'Vendedor') username = 'Maciel';

        const profileData = {
            'default':  { name: 'Maciel',        initials: 'MA', role: 'Comercial / Vendas' },
            'maciel':   { name: 'Maciel',        initials: 'MA', role: 'Comercial / Vendas' },
            'almeida':  { name: 'Almeida',       initials: 'AL', role: 'Comercial / Vendas' },
            'hugo':     { name: 'Hugo',          initials: 'HU', role: 'Comercial / Vendas' },
            'igor':     { name: 'Igor',          initials: 'IG', role: 'Comercial / Vendas' },
            'albert':   { name: 'Albert',        initials: 'AB', role: 'Comercial / Vendas' },
            'mateus':   { name: 'Mateus',        initials: 'MT', role: 'Gerente Comercial'  },
            'gabriel':  { name: 'Gabriel Reis',  initials: 'GR', role: 'Comercial / Vendas' },
            'fernanda': { name: 'Fernanda',      initials: 'FE', role: 'Comercial / Vendas' },
            'caio':     { name: 'Caio',          initials: 'CA', role: 'Comercial / Vendas' },
            'karine':   { name: 'Karine',        initials: 'KA', role: 'Comercial / Vendas' },
            'mamae':    { name: 'Mamãe',         initials: 'MA', role: 'Gestão'             },
        };

        let user = profileData[profile.toLowerCase()] || profileData[username.toLowerCase()];
        if (!user) {
            const initials = username.substring(0, 2).toUpperCase();
            user = { name: username, initials: initials, role: 'Comercial / Vendas' };
        }

        const avatarEl = document.getElementById('user-avatar-initials') || document.querySelector('.avatar');
        const nameEl   = document.getElementById('user-display-name') || document.querySelector('.user-name');
        const roleEl   = document.getElementById('user-display-role') || document.querySelector('.user-role');
        const logoText = document.querySelector('.logo-text');

        if (avatarEl) avatarEl.textContent = user.initials;
        if (nameEl)   nameEl.textContent   = user.name;
        if (roleEl)   roleEl.textContent   = user.role;

        const importNav = document.getElementById('nav-import');
        if (importNav) {
            if (profile === 'default' || profile === 'mateus') importNav.classList.remove('hidden');
            else importNav.classList.add('hidden');
        }

        if (profile === 'mamae') {
            document.title = "Controle de Vendas Isapel";
            document.documentElement.style.setProperty('--primary', '#9d174d');
            document.documentElement.style.setProperty('--accent',  '#db2777');
            document.documentElement.style.setProperty('--bg-sidebar', '#4c0519');
            if (logoText) logoText.innerHTML = "Controle<br>Mamãe";

            const style = document.createElement('style');
            style.id = 'mamae-style';
            style.innerHTML = `
                #sale-type option[value="Google"],
                #sale-type option[value="Reativacao"],
                #sale-type option[value="Introducao"] { display: none !important; }
                .kpi-card:has(#kpi-google-count),
                .kpi-card:has(#kpi-reativacao-count),
                .kpi-card:has(#kpi-introducao-count) { display: none !important; }
                #sale-faturamento, label[for="sale-faturamento"] { display: none !important; }
            `;
            if (!document.getElementById('mamae-style')) document.head.appendChild(style);

            const boxesLabel = document.querySelector('label[for="sale-boxes"]');
            if (boxesLabel) boxesLabel.innerText = "Qtd. Vinhos";
            const valueLabel = document.querySelector('label[for="sale-value"]');
            if (valueLabel) valueLabel.innerText = "Valor Venda (R$)";
            const fatInput = document.getElementById('sale-faturamento');
            if (fatInput) fatInput.removeAttribute('required');
            document.getElementById('mamae-product-group')?.classList.remove('hidden');
            document.getElementById('mamae-cost-group')?.classList.remove('hidden');
            const saleTypeSelect = document.getElementById('sale-type');
            const saleBoxesInput = document.getElementById('sale-boxes');
            if (saleTypeSelect) { saleTypeSelect.value = 'Normal'; saleTypeSelect.removeAttribute('required'); saleTypeSelect.closest('.form-group').style.display = 'none'; }
            if (saleBoxesInput) { saleBoxesInput.value = '0'; saleBoxesInput.closest('.form-group').style.display = 'none'; }
            const commTitle = document.querySelector('.kpi-card.highlight h3');
            if (commTitle) commTitle.innerText = "Lucro Total";
        } else {
            document.title = "Controle de Vendas Isapel";
            document.documentElement.style.removeProperty('--primary');
            document.documentElement.style.removeProperty('--accent');
            document.documentElement.style.removeProperty('--bg-sidebar');
            if (logoText) logoText.innerHTML = "Controle de Vendas Isapel";
            document.getElementById('mamae-style')?.remove();
            document.getElementById('mamae-product-group')?.classList.add('hidden');
            document.getElementById('mamae-cost-group')?.classList.add('hidden');
            const saleTypeGroup  = document.getElementById('sale-type')?.closest('.form-group');
            const saleBoxesGroup = document.getElementById('sale-boxes')?.closest('.form-group');
            if (saleTypeGroup)  saleTypeGroup.style.display  = 'block';
            if (saleBoxesGroup) saleBoxesGroup.style.display = 'block';
            const boxesLabel = document.querySelector('label[for="sale-boxes"]');
            if (boxesLabel) boxesLabel.innerText = "Caixas 20056 (Qtd)";
            const valueLabel = document.querySelector('label[for="sale-value"]');
            if (valueLabel) valueLabel.innerText = "Valor Faturado (R$)";
            const fatInput = document.getElementById('sale-faturamento');
            if (fatInput) fatInput.setAttribute('required', 'true');
            const commTitle = document.querySelector('.kpi-card.highlight h3');
            if (commTitle) commTitle.innerText = "Comissão Total";
        }
    },

    initNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-target');
                if (targetId) window.switchView(targetId);
            });
        });
    },

    renderView(targetId) {
        if (!targetId) return;

        // SALES / RESUMO VIEW
        if (targetId === 'sales' && window.SalesModule) {
            window.SalesModule.init();
        }
        // DASHBOARD AUTO-UPDATE on open
        if (targetId === 'dashboard' && window.DashboardModule) {
            if (!window.DashboardModule.dom) {
                window.DashboardModule.init();
            } else {
                window.DashboardModule.update();
            }
        }
        // KANBAN RENDER on open
        if (targetId === 'kanban' && window.KanbanModule) {
            window.KanbanModule.render();
        }
        // CRM VIEWS — filtered by origin (Ativos, Google, Maps)
        const crmViews = ['crm', 'crm-ativo', 'crm-google', 'crm-maps'];
        if (crmViews.includes(targetId) && window.CRMModule) {
            window.CRMModule.init(targetId);
        }
        // INATIVOS VIEW (Dedicated 7-Column App)
        if (targetId === 'crm-inativo' && window.InativosApp) {
            window.InativosApp.init();
        }
        // PROSPEC VIEW
        if (targetId === 'crm-prospec' && window.ProspecModule) {
            window.ProspecModule.init();
        }
        // SAMPLES VIEW
        if (targetId === 'samples' && window.SamplesModule) {
            window.SamplesModule.init();
        }
        // REMINDERS VIEW
        if (targetId === 'reminders' && window.RemindersModule) {
            window.RemindersModule.init();
        }
        // CALENDAR VIEW
        if (targetId === 'calendar' && window.CalendarModule) {
            window.CalendarModule.init();
        }
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
                sessionStorage.clear();
                localStorage.removeItem('maciel_auth');
                localStorage.removeItem('maciel_profile');
                localStorage.removeItem('maciel_username');
                localStorage.removeItem('maciel_token');
                localStorage.removeItem('_maciel_session_key');
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
                document.getElementById('setting-claude-key').value = localStorage.getItem('claude_api_key') || '';
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
                
                const claudeKey = document.getElementById('setting-claude-key')?.value.trim();
                if (claudeKey) localStorage.setItem('claude_api_key', claudeKey);
                else localStorage.removeItem('claude_api_key');

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
            downloadAnchorNode.setAttribute("download", `bkp_vendas_isapel_${new Date().toISOString().split('T')[0]}.json`);
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
    },

};
window.AppModule = AppModule;

window.switchView = function(targetId) {
    if (!targetId) return;

    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitleEl = document.getElementById('current-page-title');

    // Update active state on nav items
    navItems.forEach(nav => {
        if (nav.getAttribute('data-target') === targetId) {
            nav.classList.add('active');
            const titleSpan = nav.querySelector('span');
            if (titleSpan && pageTitleEl) pageTitleEl.innerText = titleSpan.innerText;
        } else {
            nav.classList.remove('active');
        }
    });

    // Show target view, hide others
    viewSections.forEach(section => {
        if (section.id === `view-${targetId}`) {
            section.classList.remove('hidden');
            section.classList.add('active');
            section.style.display = 'block';
            if (window.AppModule && window.AppModule.renderView) {
                window.AppModule.renderView(targetId);
            }
        } else {
            section.classList.remove('active');
            section.classList.add('hidden');
            section.style.display = 'none';
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    AppModule.init();
});

document.addEventListener('DataStoreReady', () => {
    AppModule.onDataReady();
});

// Event delegation de segurança para garantir clique em qualquer nav-item a qualquer momento
document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem) {
        e.preventDefault();
        const targetId = navItem.getAttribute('data-target');
        if (targetId) window.switchView(targetId);
    }
});
