/**
 * Reactivations Control System - Isapel
 */

const ReactivationsModule = {
    activeSeller: "",
    inactiveClientsList: [], // Lista local de inativos do vendedor selecionado
    activeTab: "inativos",
    currentFilter: "todos", // todos, Novo, Antigo

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.restoreSession();
    },

    cacheDOM() {
        this.dom = {
            sellerSelect: document.getElementById("active-seller"),
            navItems: document.querySelectorAll(".nav-item"),
            tabs: document.querySelectorAll(".tab-content"),
            
            // Tab Inativos
            inativosTableBody: document.getElementById("inativos-table-body"),
            searchInativos: document.getElementById("search-inativos"),
            filterButtons: document.querySelectorAll(".filter-btn"),
            
            // Tab Registrar
            reactForm: document.getElementById("reactivation-form"),
            reactClientName: document.getElementById("react-client-name"),
            reactAutocompleteDropdown: document.getElementById("react-autocomplete-dropdown"),
            clientValidationFeedback: document.getElementById("client-validation-feedback"),
            reactValue: document.getElementById("react-value"),
            reactSaleDate: document.getElementById("react-sale-date"),
            reactFatDate: document.getElementById("react-fat-date"),
            
            // Tab Checklist
            checklistTableBody: document.getElementById("checklist-table-body"),
            checklistAlertBadge: document.getElementById("checklist-alert-badge"),
            lateMondayBanner: document.getElementById("late-monday-banner"),
            
            // Tab Histórico
            historicoTableBody: document.getElementById("historico-table-body"),
            
            // Tab Upload
            excelFileInput: document.getElementById("excel-file-input"),
            btnBrowseExcel: document.getElementById("btn-browse-excel"),
            excelDropZone: document.getElementById("excel-drop-zone"),
            uploadProgressCard: document.getElementById("upload-progress-card"),
            progressBarFill: document.getElementById("progress-bar-fill"),
            progressPercent: document.getElementById("progress-percent"),
            logConsole: document.getElementById("log-console"),
            fileNameLabel: document.getElementById("file-name-label"),
            importStats: document.getElementById("import-stats"),
            statNovos: document.getElementById("stat-novos"),
            statMantidos: document.getElementById("stat-mantidos"),
            statRemovidos: document.getElementById("stat-removidos")
        };
    },

    bindEvents() {
        // Tab switching
        this.dom.navItems.forEach(item => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                const tabId = item.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Seller selection changed
        this.dom.sellerSelect.addEventListener("change", (e) => {
            this.activeSeller = e.target.value;
            localStorage.setItem("react_vendedor_profile", this.activeSeller);
            this.onSellerChanged();
        });

        // Search & Filters on Inactives Tab
        if (this.dom.searchInativos) {
            this.dom.searchInativos.addEventListener("input", () => this.renderInativosTable());
        }

        this.dom.filterButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                this.dom.filterButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.currentFilter = btn.dataset.filter;
                this.renderInativosTable();
            });
        });

        // Autocomplete & Validation
        if (this.dom.reactClientName) {
            this.dom.reactClientName.addEventListener("input", (e) => this.handleClientNameInput(e.target.value));
            
            // Close autocomplete when clicking outside
            document.addEventListener("click", (e) => {
                if (!this.dom.reactClientName.contains(e.target) && !this.dom.reactAutocompleteDropdown.contains(e.target)) {
                    this.dom.reactAutocompleteDropdown.style.display = "none";
                }
            });
        }

        // Form Submit
        if (this.dom.reactForm) {
            this.dom.reactForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.submitReactivation();
            });
        }

        // Upload Area Events
        if (this.dom.excelDropZone) {
            this.dom.btnBrowseExcel.addEventListener("click", () => this.dom.excelFileInput.click());
            this.dom.excelFileInput.addEventListener("change", (e) => this.handleExcelSelected(e.target.files[0]));

            this.dom.excelDropZone.addEventListener("dragover", (e) => {
                e.preventDefault();
                this.dom.excelDropZone.classList.add("drag-over");
            });

            this.dom.excelDropZone.addEventListener("dragleave", () => {
                this.dom.excelDropZone.classList.remove("drag-over");
            });

            this.dom.excelDropZone.addEventListener("drop", (e) => {
                e.preventDefault();
                this.dom.excelDropZone.classList.remove("drag-over");
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.handleExcelSelected(e.dataTransfer.files[0]);
                }
            });
        }
    },

    restoreSession() {
        const savedSeller = localStorage.getItem("react_vendedor_profile");
        if (savedSeller) {
            this.dom.sellerSelect.value = savedSeller;
            this.activeSeller = savedSeller;
            this.onSellerChanged();
        }

        // Default dates in Form (Local Time Safe)
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        
        if (this.dom.reactSaleDate) this.dom.reactSaleDate.value = todayStr;
        if (this.dom.reactFatDate) this.dom.reactFatDate.value = todayStr;
    },

    switchTab(tabId) {
        this.activeTab = tabId;
        this.dom.navItems.forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        this.dom.tabs.forEach(tab => {
            if (tab.id === `tab-${tabId}`) {
                tab.classList.add("active");
            } else {
                tab.classList.remove("active");
            }
        });

        // Trigger updates when entering tabs
        if (tabId === "inativos") this.loadInativos();
        if (tabId === "checklist") this.loadChecklist();
        if (tabId === "historico") this.loadHistorico();
    },

    onSellerChanged() {
        // Toggle view permissions
        const navUpload = document.getElementById("nav-upload");
        if (navUpload) {
            // Apenas administradores/gerentes MATEUS e MACIEL podem fazer upload da planilha
            if (["MATEUS", "MACIEL"].includes(this.activeSeller)) {
                navUpload.style.display = "flex";
            } else {
                navUpload.style.display = "none";
                if (this.activeTab === "upload") this.switchTab("inativos");
            }
        }

        // Carregar dados
        this.loadInativos();
        this.loadChecklist();
        this.loadHistorico();
    },

    async loadInativos() {
        if (!this.activeSeller) return;

        try {
            const res = await fetch(`/api/reativacoes/inativos?vendedor=${this.activeSeller}`);
            if (res.ok) {
                this.inactiveClientsList = await res.json();
                this.renderInativosTable();
            }
        } catch (e) {
            console.error("Erro ao carregar inativos", e);
        }
    },

    renderInativosTable() {
        this.dom.inativosTableBody.innerHTML = "";
        
        if (!this.activeSeller) {
            this.dom.inativosTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Selecione seu perfil de vendedor acima.</td></tr>`;
            return;
        }

        const query = this.dom.searchInativos.value.toLowerCase().trim();
        let filtered = this.inactiveClientsList;

        // Filtro por tipo (Novo/Antigo)
        if (this.currentFilter !== "todos") {
            filtered = filtered.filter(c => c.status === this.currentFilter);
        }

        // Filtro por busca de texto
        if (query) {
            filtered = filtered.filter(c => 
                c.nome_cliente.toLowerCase().includes(query) || 
                c.codigo_cliente.toLowerCase().includes(query)
            );
        }

        if (filtered.length === 0) {
            this.dom.inativosTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhum cliente inativo localizado.</td></tr>`;
            return;
        }

        filtered.forEach(c => {
            const tr = document.createElement("tr");
            const statusBadge = c.status === "Novo" 
                ? `<span class="badge badge-new">Novo Inativo</span>` 
                : `<span class="badge badge-old">Antigo Inativo</span>`;

            tr.innerHTML = `
                <td><strong>#${c.codigo_cliente}</strong></td>
                <td>${c.nome_cliente}</td>
                <td>${c.cidade || "—"} / ${c.regiao || "—"}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="ReactivationsModule.prefillReactivation('${c.nome_cliente.replace(/'/g, "\\'")}')">
                        Reativar
                    </button>
                </td>
            `;
            this.dom.inativosTableBody.appendChild(tr);
        });
    },

    prefillReactivation(clientName) {
        this.switchTab("registrar");
        this.dom.reactClientName.value = clientName;
        this.handleClientNameInput(clientName);
        this.dom.reactValue.focus();
    },

    handleClientNameInput(val) {
        const query = val.toUpperCase().trim();
        this.dom.reactAutocompleteDropdown.innerHTML = "";
        this.dom.clientValidationFeedback.className = "validation-feedback";
        this.dom.clientValidationFeedback.style.display = "none";

        if (!query) {
            this.dom.reactAutocompleteDropdown.style.display = "none";
            return;
        }

        // Buscar correspondências na lista local de inativos
        const matches = this.inactiveClientsList.filter(c => 
            c.nome_cliente.includes(query) || c.codigo_cliente.includes(query)
        ).slice(0, 5);

        if (matches.length > 0) {
            this.dom.reactAutocompleteDropdown.style.display = "block";
            matches.forEach(c => {
                const item = document.createElement("div");
                item.className = "autocomplete-item";
                item.innerHTML = `
                    <div><strong>#${c.codigo_cliente}</strong> - ${c.nome_cliente}</div>
                    <span>${c.status}</span>
                `;
                item.addEventListener("click", () => {
                    this.dom.reactClientName.value = c.nome_cliente;
                    this.dom.reactAutocompleteDropdown.style.display = "none";
                    this.showValidationFeedback(true, `✔ Cliente inativo oficial da sua carteira (Código: #${c.codigo_cliente})`);
                });
                this.dom.reactAutocompleteDropdown.appendChild(item);
            });
        } else {
            this.dom.reactAutocompleteDropdown.style.display = "none";
        }

        // Validar se o nome digitado exatamente bate com algum inativo
        const exactMatch = this.inactiveClientsList.find(c => c.nome_cliente === query);
        if (exactMatch) {
            this.showValidationFeedback(true, `✔ Cliente inativo oficial da sua carteira (Código: #${exactMatch.codigo_cliente})`);
        } else {
            this.showValidationFeedback(false, "✖ Atenção: Cliente não encontrado na sua lista de inativos oficiais!");
        }
    },

    showValidationFeedback(isValid, msg) {
        const el = this.dom.clientValidationFeedback;
        el.innerText = msg;
        el.className = `validation-feedback ${isValid ? 'valid' : 'invalid'}`;
        el.style.display = "block";
    },

    async submitReactivation() {
        if (!this.activeSeller) {
            alert("Por favor, selecione seu perfil de vendedor acima primeiro.");
            return;
        }

        const clientName = this.dom.reactClientName.value.trim().toUpperCase();
        const value = parseFloat(this.dom.reactValue.value);
        const saleDate = this.dom.reactSaleDate.value;
        const fatDate = this.dom.reactFatDate.value;

        const btn = document.getElementById("btn-submit-react");
        btn.disabled = true;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Lançando e Validando...";

        try {
            const res = await fetch("/api/reativacoes/registrar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vendedor: this.activeSeller,
                    cliente_nome: clientName,
                    valor_venda: value,
                    data_venda: saleDate,
                    data_faturamento: fatDate
                })
            });

            if (res.ok) {
                const data = await res.json();
                
                // Mostrar alerta bonito do status da reativação
                if (data.status_validacao === "Valida") {
                    alert(`✅ Reativação Válida!\nO cliente foi validado na sua carteira de inativos.\n\nUm lembrete de checklist foi criado para segunda-feira (${data.data_limite_check}).`);
                } else {
                    alert(`⚠️ Reativação Inválida!\nAtenção: O cliente informado não consta como inativo na sua carteira. A reativação foi gravada mas foi marcada como INVÁLIDA.`);
                }

                // Reset do form
                this.dom.reactForm.reset();
                this.restoreSession(); // restaura vendedor e datas
                this.dom.clientValidationFeedback.style.display = "none";
                
                // Ir para a aba de checklist
                this.switchTab("checklist");
            } else {
                alert("Erro ao registrar a reativação.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro na conexão com o servidor.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "<i class='bx bx-check-double'></i> Registrar e Validar Reativação";
        }
    },

    async loadChecklist() {
        if (!this.activeSeller) return;

        try {
            const res = await fetch(`/api/reativacoes/checklist?vendedor=${this.activeSeller}`);
            if (res.ok) {
                const list = await res.json();
                this.renderChecklistTable(list);
            }
        } catch (e) {
            console.error("Erro ao carregar checklist", e);
        }
    },

    renderChecklistTable(items) {
        this.dom.checklistTableBody.innerHTML = "";
        
        // Controlar Badges de alerta no menu e no topo
        let hasLate = false;
        let count = 0;

        if (!this.activeSeller) {
            this.dom.checklistTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Selecione seu perfil de vendedor acima.</td></tr>`;
            return;
        }

        items.forEach(item => {
            count++;
            if (item.alerta_atraso === 1) hasLate = true;

            const tr = document.createElement("tr");
            
            // Formatando datas
            const fatDateFmt = item.data_faturamento.split("-").reverse().join("/");
            const limitDateFmt = item.data_limite_check.split("-").reverse().join("/");
            
            const badgeVal = item.status_validacao === "Valida" 
                ? `<span class="badge badge-success">Válida</span>` 
                : `<span class="badge badge-danger">Inválida</span>`;

            const rowStyle = item.alerta_atraso === 1 ? 'style="background-color: var(--danger-light);"' : '';

            tr.innerHTML = `
                <td ${rowStyle}><strong>${item.cliente_nome}</strong></td>
                <td ${rowStyle}>R$ ${item.valor_venda.toFixed(2)}</td>
                <td ${rowStyle}>${fatDateFmt}</td>
                <td ${rowStyle}>${badgeVal}</td>
                <td ${rowStyle} style="color: ${item.alerta_atraso === 1 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">
                    ${item.alerta_atraso === 1 ? '⚠️ ' : ''}${limitDateFmt}
                </td>
                <td ${rowStyle}>
                    <button class="btn btn-primary btn-sm" style="background-color: var(--success)" onclick="ReactivationsModule.darVisto('${item.id}')">
                        <i class='bx bx-check'></i> Dar Visto
                    </button>
                </td>
            `;
            this.dom.checklistTableBody.appendChild(tr);
        });

        if (count === 0) {
            this.dom.checklistTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Parabéns! Nenhum checklist pendente para verificação.</td></tr>`;
        }

        // Toggle do banner de alerta
        if (hasLate) {
            this.dom.lateMondayBanner.classList.remove("hidden");
            this.dom.checklistAlertBadge.classList.remove("hidden");
        } else {
            this.dom.lateMondayBanner.classList.add("hidden");
            this.dom.checklistAlertBadge.classList.add("hidden");
        }
    },

    async darVisto(reactId) {
        if (!confirm("Deseja confirmar que o pedido já consta faturado no sistema oficial?")) return;

        try {
            const res = await fetch(`/api/reativacoes/${reactId}/visto`, { method: "POST" });
            if (res.ok) {
                this.loadChecklist();
                this.loadHistorico();
            } else {
                alert("Erro ao confirmar o visto.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        }
    },

    async loadHistorico() {
        if (!this.activeSeller) return;

        try {
            const res = await fetch(`/api/reativacoes/lista?vendedor=${this.activeSeller}`);
            if (res.ok) {
                const list = await res.json();
                this.renderHistoricoTable(list);
            }
        } catch (e) {
            console.error(e);
        }
    },

    renderHistoricoTable(items) {
        this.dom.historicoTableBody.innerHTML = "";

        if (!this.activeSeller) {
            this.dom.historicoTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Selecione seu perfil de vendedor acima.</td></tr>`;
            return;
        }

        if (items.length === 0) {
            this.dom.historicoTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhum registro de reativação no seu histórico.</td></tr>`;
            return;
        }

        items.forEach(item => {
            const tr = document.createElement("tr");
            
            const regDateFmt = new Date(item.createdAt).toLocaleDateString('pt-BR');
            const badgeVal = item.status_validacao === "Valida" 
                ? `<span class="badge badge-success">Válida</span>` 
                : `<span class="badge badge-danger">Inválida</span>`;
                
            const badgeVisto = item.visto_segunda === 1 
                ? `<span class="badge badge-success"><i class='bx bx-check-square'></i> Confirmado</span>`
                : `<span class="badge badge-new"><i class='bx bx-time'></i> Pendente</span>`;

            tr.innerHTML = `
                <td>${regDateFmt}</td>
                <td><strong>${item.cliente_nome}</strong></td>
                <td>R$ ${item.valor_venda.toFixed(2)}</td>
                <td>${badgeVal}</td>
                <td>${badgeVisto}</td>
            `;
            this.dom.historicoTableBody.appendChild(tr);
        });
    },

    handleExcelSelected(file) {
        if (!file) return;
        if (!file.name.endsWith(".xlsx")) {
            alert("Por favor, selecione apenas arquivos Excel do tipo .xlsx!");
            return;
        }

        this.dom.fileNameLabel.innerText = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        this.uploadExcel(file);
    },

    async uploadExcel(file) {
        this.dom.uploadProgressCard.classList.remove("hidden");
        this.dom.progressBarFill.style.width = "0%";
        this.dom.progressPercent.innerText = "0%";
        this.dom.logConsole.innerHTML = "Iniciando upload e processamento da planilha...\nAguarde, isso pode levar alguns segundos devido ao tamanho do lote...\n";
        this.dom.importStats.style.display = "none";

        const formData = new FormData();
        formData.append("file", file);

        // Simulando animação de progresso
        let progressVal = 10;
        this.dom.progressBarFill.style.width = `${progressVal}%`;
        this.dom.progressPercent.innerText = `${progressVal}%`;
        
        const progressTimer = setInterval(() => {
            if (progressVal < 90) {
                progressVal += Math.floor(Math.random() * 8) + 2;
                this.dom.progressBarFill.style.width = `${progressVal}%`;
                this.dom.progressPercent.innerText = `${progressVal}%`;
            }
        }, 300);

        try {
            const res = await fetch("/api/reativacoes/upload", {
                method: "POST",
                body: formData
            });

            clearInterval(progressTimer);

            if (res.ok) {
                const data = await res.json();
                
                this.dom.progressBarFill.style.width = "100%";
                this.dom.progressPercent.innerText = "100%";
                
                // Mostrar Estatísticas
                this.dom.statNovos.innerText = data.novos_inativos;
                this.dom.statMantidos.innerText = data.inativos_mantidos;
                this.dom.statRemovidos.innerText = data.inativos_removidos;
                this.dom.importStats.style.display = "grid";

                this.dom.logConsole.innerHTML += `\n[SUCESSO] Processamento do lote finalizado!\n`;
                this.dom.logConsole.innerHTML += `- Sessão ID: ${data.session_id}\n`;
                this.dom.logConsole.innerHTML += `- Clientes inativos novos adicionados: ${data.novos_inativos}\n`;
                this.dom.logConsole.innerHTML += `- Clientes inativos mantidos (antigos): ${data.inativos_mantidos}\n`;
                this.dom.logConsole.innerHTML += `- Clientes removidos da inatividade (ativados): ${data.inativos_removidos}\n`;
                
                this.dom.logConsole.scrollTop = this.dom.logConsole.scrollHeight;

                alert("Base Facilita processada com sucesso no servidor!");
                
                // Recarregar os inativos
                this.loadInativos();
            } else {
                const errData = await res.json();
                this.dom.logConsole.innerHTML += `\n[ERRO] Ocorreu um erro no processamento: ${errData.detail || "Erro desconhecido"}\n`;
                alert(`Erro ao processar: ${errData.detail || "Consulte o console"}`);
            }
        } catch (e) {
            clearInterval(progressTimer);
            console.error(e);
            this.dom.logConsole.innerHTML += `\n[ERRO] Falha de comunicação com a rede.\n`;
            alert("Falha na conexão de rede com o servidor.");
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    ReactivationsModule.init();
});
