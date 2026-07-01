const ImportModule = {
    SELLERS_MAP: {
        "MACIEL": "default",
        "CAIO": "caio",
        "KARINE": "karine",
        "FERNANDA": "fernanda"
    },

    // A URL agora é derivada de API_BASE_URL
    get API_URL() { return `${API_BASE_URL}/import/facilita`; },

    log(msg, color = "var(--text-muted)") {
        const container = document.getElementById("import-progress-container");
        const logEl = document.getElementById("import-log");
        if (container) container.style.display = "block";
        if (logEl) {
            logEl.innerHTML += `<div style="color:${color}; margin-bottom:4px;">${msg}</div>`;
            logEl.scrollTop = logEl.scrollHeight;
        }
    },

    parseDateValue(val) {
        if (!val) return null;
        // Excel date value (number of days since 1900-01-01)
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date;
        }
        if (typeof val === 'string') {
            try {
                if (val.includes('-')) return new Date(val.split(' ')[0]);
                if (val.includes('/')) {
                    const parts = val.split(' ')[0].split('/');
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
                }
            } catch (e) { return null; }
        }
        return null;
    },

    async processFile() {
        const currentProfile = sessionStorage.getItem('maciel_profile') || 'default';
        if (currentProfile !== "default") {
            return alert("Apenas o perfil Maciel (default) pode fazer importação da base Facilita.");
        }

        const fileInput = document.getElementById("facilita-file");
        const btn = document.getElementById("btn-process-facilita");
        
        if (!fileInput.files || fileInput.files.length === 0) {
            return alert("Por favor, selecione um arquivo Excel (.xlsx).");
        }

        const selectedSellers = Array.from(document.querySelectorAll(".import-seller-cb:checked")).map(cb => cb.value);
        if (selectedSellers.length === 0) {
            return alert("Selecione ao menos um vendedor para importar.");
        }

        const file = fileInput.files[0];
        btn.disabled = true;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processando Arquivo, aguarde...";
        document.getElementById("import-log").innerHTML = "";
        
        this.log(`Iniciando leitura de ${file.name}... (Isso pode levar alguns minutos em planilhas grandes)`);

        try {
            // Lendo com SheetJS no Frontend Web Worker (simulado como async aqui via promise blocking min)
            // Em arquivos muito densos, isso pode travar a aba do browser por alguns segundos.
            const data = await file.arrayBuffer();
            this.log("Arquivo carregado na memória. Extraindo planilhas...", "#fbbf24");
            
            // Pausa rápida para a UI respirar e desenhar o log
            await new Promise(r => setTimeout(r, 100));

            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            
            const sheetName = workbook.SheetNames.includes("BASE FACILITA") ? "BASE FACILITA" : workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            this.log(`Planilha "${sheetName}" encontrada. Convertendo para JSON...`);
            await new Promise(r => setTimeout(r, 100));

            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            this.log(`${rows.length} linhas lidas no total. Iniciando deduplicação...`, "#fbbf24");
            await new Promise(r => setTimeout(r, 100));

            const limitDateStr = (date) => {
                if (!date || isNaN(date.getTime())) return "";
                return date.toISOString().split('T')[0];
            };

            const dateBR = (date) => {
                if (!date || isNaN(date.getTime())) return "Desconhecida";
                return date.toLocaleDateString('pt-BR');
            };

            const agrupados = {};
            selectedSellers.forEach(s => agrupados[s] = {});

            let count=0;
            for (const row of rows) {
                count++;
                if (count % 50000 === 0) this.log(`🔍 Vasculhando linha ${count}...`);

                // Normalizando chaves pois dependendo da planilha, os espaços mudam
                const getCol = (possibleNames) => {
                    const keys = Object.keys(row);
                    for (const n of possibleNames) {
                        const found = keys.find(k => k.trim().toUpperCase() === n.trim().toUpperCase());
                        if (found) return row[found];
                    }
                    return "";
                };

                const vendedorName = String(getCol(["VENDEDOR"])).trim().toUpperCase();
                if (!selectedSellers.includes(vendedorName)) continue;

                const cod_c = String(getCol(["CÓD.C", "CÓD", "COD"])).trim();
                if (!cod_c || cod_c === 'undefined' || cod_c === "") continue;

                const dataPedidoVal = getCol(["DATA PEDIDO", "DATA"]);
                const dataPedido = this.parseDateValue(dataPedidoVal);

                if (!agrupados[vendedorName][cod_c]) {
                    agrupados[vendedorName][cod_c] = {
                        COD: cod_c,
                        CLIENTE: String(getCol(["CLIENTE/FORNEC.", "CLIENTE", "NOME"])).trim(),
                        VALOR_TOTAL: 0.0,
                        DATA_MAIS_RECENTE: dataPedido,
                        SITUACAO: String(getCol(["SITUAÇÃO", "SITUACAO"])).trim().toUpperCase() || "ATIVO",
                        REGIAO: String(getCol(["REGIÃO", "REGIAO"])).trim(),
                        CIDADE: String(getCol(["CIDADE"])).trim(),
                        FREQ_DIAS: String(getCol(["FREQUENCIA COMPRA DIAS", "FREQ"])).trim(),
                        MEDIA_COMPRAS: String(getCol(["MÉDIA POR COMPRAS", "MEDIA"])).trim()
                    };
                }

                const rec = agrupados[vendedorName][cod_c];
                
                // Atualiza pra mais recente
                if (dataPedido) {
                    if (!rec.DATA_MAIS_RECENTE || dataPedido > rec.DATA_MAIS_RECENTE) {
                        rec.DATA_MAIS_RECENTE = dataPedido;
                        rec.FREQ_DIAS = String(getCol(["FREQUENCIA COMPRA DIAS", "FREQ"])).trim();
                        rec.MEDIA_COMPRAS = String(getCol(["MÉDIA POR COMPRAS", "MEDIA"])).trim();
                    }
                }

                // Soma o ticket
                try {
                    let valRaw = String(getCol(["VALOR NOTA", "VALOR", "TOTAL"]));
                    if (valRaw && valRaw.trim()) {
                        let parsed = parseFloat(valRaw.replace('R$', '').replace('.','').replace(',','.').trim());
                        if (!isNaN(parsed)) rec.VALOR_TOTAL += parsed;
                    }
                } catch(e) {}
            }

            this.log("Deduplicação concluída! Enviando para o Servidor via API...", "#10B981");

            // Preparar payload e fazer Post em lotes de 100
            for (const vendedor of selectedSellers) {
                const clientesVendedor = Object.values(agrupados[vendedor]);
                const totalVendedor = clientesVendedor.length;

                if (totalVendedor === 0) {
                    this.log(`⚠️ Nenhum cliente encontrado para ${vendedor}.`);
                    continue;
                }

                this.log(`<br><b>== Iniciando Envio: ${vendedor} (${totalVendedor} clientes) ==</b>`, "#f3f4f6");

                const payloadCustomers = [];
                const payloadProspects = [];

                clientesVendedor.forEach(c => {
                    const situacao = (c.SITUACAO || "").toUpperCase();
                    const isProspec = situacao.includes("PROSPEC");
                    const isAtivo = situacao === "ATIVO";

                    const dtStr = limitDateStr(c.DATA_MAIS_RECENTE);
                    let nextFollow = "";
                    if (c.DATA_MAIS_RECENTE && !isNaN(c.DATA_MAIS_RECENTE.getTime())) {
                        const next = new Date(c.DATA_MAIS_RECENTE);
                        next.setDate(next.getDate() + 7);
                        nextFollow = limitDateStr(next);
                    }

                    const notas = `Base Facilita | Freq: ${c.FREQ_DIAS ? c.FREQ_DIAS+'d' : '--'} | Ticket médio: ${c.MEDIA_COMPRAS || '--'} | Última compra: ${dateBR(c.DATA_MAIS_RECENTE)} | Valor Histórico: R$ ${c.VALOR_TOTAL.toFixed(2)}`;

                    if (isProspec) {
                        payloadProspects.push({
                            id: `facil_pros_${c.COD}_${vendedor}`,
                            profile: this.SELLERS_MAP[vendedor],
                            razaoSocial: c.CLIENTE ? c.CLIENTE.substring(0, 100).toUpperCase() : "SEM NOME",
                            phone: c.CELULAR || "Sem Telefone", // Tenta pegar celular ou telefone se disponível
                            city: c.CIDADE,
                            region: c.REGIAO,
                            porte: "Geral", // Valor padrão pois a base Facilita não costuma ter porte explicitamente
                            notes: notas,
                            status: "Novo",
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        // Cliente Normal (Ativo ou Inativo)
                        const origin = "Inativo"; 
                        const temp = isAtivo ? "Pós venda" : "Primeiro contato";
                        const stat = isAtivo ? "Pós venda" : "Primeiro contato";

                        payloadCustomers.push({
                            id: `facilita_${c.COD}_${vendedor}`,
                            profile: this.SELLERS_MAP[vendedor],
                            name: c.CLIENTE ? c.CLIENTE.substring(0, 100).toUpperCase() : "SEM NOME",
                            source: c.SITUACAO || "ATIVO",
                            origin: origin,
                            temperature: temp,
                            status: stat,
                            region: c.REGIAO,
                            city: c.CIDADE,
                            lastContactDate: dtStr,
                            nextFollowUp: nextFollow,
                            notes: notas,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    }
                });

                // Batching para não estourar o limite de Vercel/Render
                const BATCH_SIZE = 100;
                let tot_criados = 0, tot_ignorados = 0, tot_erros = 0;

                // Enviar em lotes (Misturando ou separando, API agora aceita ambos no mesmo req)
                // Vamos enviar de 100 em 100 clientes ou prospectos do vendedor atual
                const allVendedorRecords = [
                    ...payloadCustomers.map(x => ({ type: 'cust', data: x })),
                    ...payloadProspects.map(x => ({ type: 'pros', data: x }))
                ];

                for (let i = 0; i < allVendedorRecords.length; i += BATCH_SIZE) {
                    const loteMix = allVendedorRecords.slice(i, i + BATCH_SIZE);
                    const currentBatch = {
                        customers: loteMix.filter(x => x.type === 'cust').map(x => x.data),
                        prospects: loteMix.filter(x => x.type === 'pros').map(x => x.data),
                        profile: "default"
                    };

                    this.log(`-> Enviando lote ${Math.floor(i/BATCH_SIZE)+1} (${loteMix.length} registros)...`);
                    
                    try {
                        const res = await fetch(this.API_URL, {
                            method: "POST",
                            headers: getAuthHeaders(),
                            body: JSON.stringify(currentBatch)
                        });

                        if (res.ok) {
                            const data = await res.json();
                            tot_criados += data.criados || 0;
                            tot_ignorados += data.ignorados || 0;
                            tot_erros += data.erros || 0;
                        } else {
                            this.log(`Erro da API: HTTP ${res.status} - Lote falhou.`, "#ef4444");
                        }
                    } catch (e) {
                         this.log(`Falha de conexão: ${e.message}`, "#ef4444");
                    }
                }

                this.log(`✅ <b>${vendedor} Concluído:</b> ${tot_criados} importados, ${tot_ignorados} já existiam (pulados). Erros: ${tot_erros}`, "#10B981");
                await new Promise(r => setTimeout(r, 100));
            }

            this.log("<br>🎉 <b>Upload Finalizado com Sucesso!</b>", "#10B981");
            alert("A importação foi concluída com sucesso. Verifique o log abaixo para os detalhes. O cache do sistema será atualizado quando os vendedores recarregarem a página.");

        } catch (err) {
            console.error(err);
            this.log(`💥 ERRO FATAL: ${err.message}`, "#ef4444");
            alert("Houve um erro no processamento: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = "<i class='bx bx-cloud-upload'></i> Processar e Importar Novamente";
        }
    }
};
