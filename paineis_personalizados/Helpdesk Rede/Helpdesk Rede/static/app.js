"use strict";

let chamados = [];
let chamadoSelecionado = null;
let carregando = false;
let ultimoIdConhecido = 0;
let notificacaoInicializada = false;
let pollingNotificacao = null;
let audioContextNotificacao = null;
let sessaoUsuario = null;
let usuariosCache = [];

function obterMaiorIdChamado(lista) {
    return lista.reduce((maior, chamado) => {
        const id = Number(chamado.id || 0);
        return id > maior ? id : maior;
    }, 0);
}

function tocarSomNovoChamado() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioContextNotificacao) {
            audioContextNotificacao = new AudioCtx();
        }

        if (audioContextNotificacao.state === "suspended") {
            audioContextNotificacao.resume();
        }

        const agora = audioContextNotificacao.currentTime;
        const osc = audioContextNotificacao.createOscillator();
        const ganho = audioContextNotificacao.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(880, agora);
        osc.frequency.setValueAtTime(1174.66, agora + 0.10);

        ganho.gain.setValueAtTime(0.0001, agora);
        ganho.gain.exponentialRampToValueAtTime(0.16, agora + 0.02);
        ganho.gain.exponentialRampToValueAtTime(0.0001, agora + 0.55);

        osc.connect(ganho);
        ganho.connect(audioContextNotificacao.destination);
        osc.start(agora);
        osc.stop(agora + 0.58);
    } catch (_) {
        // Alguns navegadores bloqueiam áudio até existir interação do usuário.
    }
}

function mostrarNotificacaoChamado(chamado) {
    const toast = $("notificacaoChamado");
    const texto = $("notificacaoTexto");
    if (!toast || !texto) return;

    texto.textContent =
        `#${chamado.numero || chamado.id} • ${chamado.setor || "Sem setor"} • ${chamado.prioridade || "Normal"}`;

    // Reinicia a animação para que notificações consecutivas apareçam na tela.
    toast.classList.remove("hidden", "notification-hide", "notification-show");
    void toast.offsetWidth;
    toast.classList.add("notification-show");

    tocarSomNovoChamado();

    if ("Notification" in window && Notification.permission === "granted") {
        try {
            const n = new Notification("Novo chamado - Helpdesk TI", {
                body: `#${chamado.numero || chamado.id} • ${chamado.setor || "Sem setor"}\n${chamado.nome || "Usuário"}`,
                tag: `helpdesk-${chamado.id}`,
                icon: "/static/favicon.ico"
            });

            n.onclick = () => {
                window.focus();
                n.close();
            };
        } catch (_) {}
    }

    window.clearTimeout(window.__timerNotificacaoHelpdesk);
    window.__timerNotificacaoHelpdesk = window.setTimeout(() => {
        esconderNotificacaoChamado();
    }, 8000);
}

function esconderNotificacaoChamado() {
    const toast = $("notificacaoChamado");
    if (!toast) return;

    toast.classList.remove("notification-show");
    toast.classList.add("notification-hide");

    window.setTimeout(() => {
        toast.classList.add("hidden");
        toast.classList.remove("notification-hide");
    }, 250);
}

async function solicitarPermissaoNotificacao() {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
        try {
            await Notification.requestPermission();
        } catch (_) {}
    }
}

async function verificarNovosChamados() {
    if (!document.body || document.hidden && !document.hasFocus()) {
        // Mesmo com a aba em segundo plano, a verificação continua abaixo.
    }

    try {
        const resposta = await api(
            `/api/chamados/novos?ultimo_id=${encodeURIComponent(ultimoIdConhecido)}`
        );

        const novos = resposta.chamados || [];

        if (!notificacaoInicializada) {
            if (novos.length) {
                ultimoIdConhecido = Math.max(
                    ultimoIdConhecido,
                    obterMaiorIdChamado(novos)
                );
            }
            notificacaoInicializada = true;
            return;
        }

        for (const chamado of novos) {
            if (Number(chamado.id) > ultimoIdConhecido) {
                ultimoIdConhecido = Number(chamado.id);
                mostrarNotificacaoChamado(chamado);
            }
        }

        if (novos.length) {
            await carregarPainel();
        }
    } catch (_) {
        // Se o servidor estiver temporariamente indisponível, tenta novamente no próximo ciclo.
    }
}

function iniciarMonitoramentoNovosChamados() {
    if (pollingNotificacao) {
        clearInterval(pollingNotificacao);
    }

    verificarNovosChamados();
    pollingNotificacao = setInterval(verificarNovosChamados, 3000);
}


let relatorioAtual = null;

const $ = (id) => document.getElementById(id);

function escapeHTML(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function removerAcentos(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function classeLoja(loja) {
    return loja === "Filial" ? "filial" : "matriz";
}

function classePrioridade(prioridade) {
    return removerAcentos(String(prioridade).toLowerCase());
}

function classeStatus(status) {
    if (status === "Aberto") return "aberto";
    if (status === "Em atendimento") return "atendimento";
    if (status === "Aguardando usuário") return "aguardando";
    if (status === "Resolvido") return "resolvido";
    return "encerrado";
}

async function api(url, options = {}) {
    const resposta = await fetch(url, {
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let dados = {};
    try {
        dados = await resposta.json();
    } catch (_) {}

    if (!resposta.ok) {
        const erro = new Error(dados.mensagem || `Erro HTTP ${resposta.status}`);
        erro.status = resposta.status;
        throw erro;
    }

    return dados;
}

/* ================= NAVEGAÇÃO ================= */

function mostrarLogin() {
    if (pollingNotificacao) {
        clearInterval(pollingNotificacao);
        pollingNotificacao = null;
    }
    notificacaoInicializada = false;
    $("loginSection").classList.remove("hidden");
    $("usuarioSection").classList.add("hidden");
    $("adminSection").classList.add("hidden");
    $("btnAdmin").classList.add("hidden");
    $("loginErro").textContent = "";
    window.setTimeout(() => $("loginUsuario")?.focus(), 50);
}

function mostrarUsuario() {
    $("loginSection").classList.add("hidden");
    $("adminSection").classList.add("hidden");
    $("usuarioSection").classList.remove("hidden");
    $("btnAdmin").classList.add("hidden");
    $("loginErro").textContent = "";
}

$("btnAdmin").addEventListener("click", mostrarLogin);
$("btnVoltarLogin").addEventListener("click", mostrarLogin);

$("btnLogoutOperador").addEventListener("click", async () => {
    try {
        await api("/logout", { method: "POST" });
    } finally {
        sessaoUsuario = null;
        $("operadorNome").textContent = "Usuário";
        $("operadorLoja").textContent = "Unidade";
        mostrarLogin();
    }
});

/* ================= LOGIN ================= */

$("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const usuario = $("loginUsuario").value.trim();
    const senha = $("loginSenha").value;

    $("loginErro").textContent = "Entrando...";

    try {
        const sessao = await api("/login", {
            method: "POST",
            body: JSON.stringify({ usuario, senha })
        });

        sessaoUsuario = sessao;
        aplicarPermissoesInterface();
        atualizarBotaoExcluirChamado();
        if ($("rustdeskIdChamado")) $("rustdeskIdChamado").value = sessao.rustdesk_id || "";
        if ($("nome")) $("nome").value = sessao.nome || sessao.usuario || "";
        if ($("equipamento")) $("equipamento").value = sessao.computador || "";
        $("loginForm").reset();
        $("loginErro").textContent = "";

        if (sessao.perfil === "admin") {
            $("loginSection").classList.add("hidden");
            $("usuarioSection").classList.add("hidden");
            $("adminSection").classList.remove("hidden");
            await carregarPainel();
            iniciarMonitoramentoNovosChamados();
        } else {
            // Operador entra diretamente na página de abertura de chamados.
            $("loginSection").classList.add("hidden");
            $("adminSection").classList.add("hidden");
            $("usuarioSection").classList.remove("hidden");
            $("operadorNome").textContent = sessao.nome || sessao.usuario || "Usuário";
            $("operadorLoja").textContent = sessao.loja || "Unidade";
            $("nome").value = sessao.nome || sessao.usuario || "";
            $("equipamento").value = sessao.computador || "";
            $("rustdeskIdChamado").value = sessao.rustdesk_id || "";
            $("loja").value = sessao.loja || "Matriz";
            $("loja").disabled = true;
            $("btnAdmin").classList.add("hidden");
        }
    } catch (erro) {
        $("loginErro").textContent = erro.message;
    }
});

$("btnLogout").addEventListener("click", async () => {
    try {
        await api("/logout", { method: "POST" });
    } finally {
        sessaoUsuario = null;
        $("adminSection").classList.add("hidden");
        mostrarLogin();
    }
});

/* ================= ALTERAR SENHA ================= */

function abrirModalSenha() {
    $("senhaMensagem").textContent = "";
    $("formAlterarSenha").reset();
    $("senhaModal").classList.remove("hidden");
    $("senhaAtual").focus();
}

function fecharModalSenha() {
    $("senhaModal").classList.add("hidden");
    $("senhaMensagem").textContent = "";
}

$("btnAlterarSenha").addEventListener("click", abrirModalSenha);
$("btnFecharSenhaModal").addEventListener("click", fecharModalSenha);
$("btnCancelarSenha").addEventListener("click", fecharModalSenha);

$("senhaModal").addEventListener("click", (event) => {
    if (event.target === $("senhaModal")) fecharModalSenha();
});

$("formAlterarSenha").addEventListener("submit", async (event) => {
    event.preventDefault();

    const botao = $("btnSalvarSenha");
    const senhaAtual = $("senhaAtual").value;
    const novaSenha = $("novaSenha").value;
    const confirmarSenha = $("confirmarNovaSenha").value;

    if (novaSenha.length < 6) {
        $("senhaMensagem").textContent = "A nova senha deve ter pelo menos 6 caracteres.";
        return;
    }

    if (novaSenha !== confirmarSenha) {
        $("senhaMensagem").textContent = "A confirmação da nova senha não confere.";
        return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";
    $("senhaMensagem").textContent = "";

    try {
        const resposta = await api("/api/admin/senha", {
            method: "PUT",
            body: JSON.stringify({
                senha_atual: senhaAtual,
                nova_senha: novaSenha,
                confirmar_senha: confirmarSenha
            })
        });

        alert(resposta.mensagem);
        fecharModalSenha();
    } catch (erro) {
        $("senhaMensagem").textContent = erro.message;
    } finally {
        botao.disabled = false;
        botao.textContent = "💾 Alterar senha";
    }
});

/* ================= UNIDADE VIA LINK ================= */
(function configurarUnidadePorLink() {
    const params = new URLSearchParams(window.location.search);
    const unidade = params.get("loja");
    const select = $("loja");
    if (!select || !unidade) return;

    const normalizada = unidade.toLowerCase() === "filial" ? "Filial" :
        unidade.toLowerCase() === "matriz" ? "Matriz" : "";

    if (normalizada) {
        select.value = normalizada;
        // O link da filial pode abrir diretamente já selecionado como Filial.
        select.dataset.preselecionado = "1";
    }
})();

/* ================= ABRIR CHAMADO ================= */

$("formChamado").addEventListener("submit", async (event) => {
    event.preventDefault();

    const botao = event.submitter;
    botao.disabled = true;
    botao.textContent = "Enviando...";

    const dados = {
        nome: $("nome").value.trim(),
        loja: $("loja").value,
        setor: $("setor").value,
        equipamento: $("equipamento").value.trim(),
        rustdesk_id: $("rustdeskIdChamado")?.value.trim() || "",
        categoria: $("categoria").value,
        prioridade: $("prioridade").value,
        descricao: $("descricao").value.trim()
    };

    try {
        const resposta = await api("/api/chamados", {
            method: "POST",
            body: JSON.stringify(dados)
        });

        $("resultadoChamado").innerHTML = `
            <div class="success-box">
                <strong>✅ Chamado aberto com sucesso!</strong>
                <div class="ticket-number">#${escapeHTML(resposta.numero)}</div>
                <p>Guarde esse número para consultar o andamento do atendimento.</p>
            </div>
        `;

        $("formChamado").reset();
        $("prioridade").value = "Normal";
        if (sessaoUsuario) {
            $("nome").value = sessaoUsuario.nome || sessaoUsuario.usuario || "";
            $("equipamento").value = sessaoUsuario.computador || "";
            $("loja").value = sessaoUsuario.loja || "Matriz";
            $("loja").disabled = sessaoUsuario.perfil !== "admin";
            if ($("rustdeskIdChamado")) $("rustdeskIdChamado").value = sessaoUsuario.rustdesk_id || "";
            if ($("nome")) $("nome").value = sessaoUsuario.nome || sessaoUsuario.usuario || "";
            if ($("equipamento")) $("equipamento").value = sessaoUsuario.computador || "";
        }
    } catch (erro) {
        $("resultadoChamado").innerHTML = `
            <div class="success-box" style="background:#fef2f2;border-color:#ef4444;color:#991b1b;">
                ❌ ${escapeHTML(erro.message)}
            </div>
        `;
    } finally {
        botao.disabled = false;
        botao.textContent = "🚀 Abrir Chamado";
    }
});

/* ================= CONSULTA ================= */

$("btnConsultar").addEventListener("click", consultarChamado);

$("consultaNumero").addEventListener("keydown", (event) => {
    if (event.key === "Enter") consultarChamado();
});

async function consultarChamado() {
    const numero = $("consultaNumero").value.trim().replace(/^#/, "");

    if (!numero) {
        $("resultadoConsulta").innerHTML = `
            <div class="lookup-result">Digite o número do chamado.</div>
        `;
        return;
    }

    try {
        const resposta = await api(`/api/chamados/consultar/${encodeURIComponent(numero)}`);
        const chamado = resposta.chamado;

        $("resultadoConsulta").innerHTML = `
            <div class="lookup-result">
                <h4>Chamado #${escapeHTML(chamado.numero || "")}</h4>
                <p><strong>Solicitante:</strong> ${escapeHTML(chamado.nome)}</p>
                <p><strong>Setor:</strong> ${escapeHTML(chamado.setor)}</p>
                <p><strong>Categoria:</strong> ${escapeHTML(chamado.categoria)}</p>
                <p><strong>Data:</strong> ${escapeHTML(chamado.data_criacao)}</p>
                <p><strong>Status:</strong>
                    <span class="badge status-${classeStatus(chamado.status)}">
                        ${escapeHTML(chamado.status)}
                    </span>
                </p>
                <p><strong>Descrição:</strong> ${escapeHTML(chamado.descricao)}</p>
                ${
                    chamado.observacao
                        ? `<p><strong>Última observação:</strong> ${escapeHTML(chamado.observacao)}</p>`
                        : ""
                }
            </div>
        `;
    } catch (erro) {
        $("resultadoConsulta").innerHTML = `
            <div class="lookup-result">
                ❌ ${escapeHTML(erro.message)}
            </div>
        `;
    }
}

function aplicarPermissoesInterface() {
    if (!sessaoUsuario) return;

    const ehMatriz = sessaoUsuario.loja === "Matriz";
    const ehAdmin = sessaoUsuario.perfil === "admin";
    const podeGerenciar = Boolean(sessaoUsuario.pode_gerenciar_usuarios);

    if ($("loja")) {
        $("loja").disabled = !ehAdmin;
        $("loja").value = sessaoUsuario.loja || "Matriz";
    }
    const filtroLoja = $("filtroLoja");
    const relatorioLoja = $("relatorioLoja");

    if (!ehMatriz) {
        filtroLoja.value = sessaoUsuario.loja;
        filtroLoja.disabled = true;
        relatorioLoja.value = sessaoUsuario.loja;
        relatorioLoja.disabled = true;
    } else {
        filtroLoja.disabled = false;
        relatorioLoja.disabled = false;
    }

    $("btnGerenciarUsuarios").classList.toggle("hidden", !podeGerenciar);
    $("btnAlterarSenha").classList.remove("hidden");

    const titulo = document.querySelector("#adminSection .admin-header h2");
    const subtitulo = document.querySelector("#adminSection .admin-header p");
    if (titulo) titulo.textContent = `📊 Painel do TI — ${sessaoUsuario.loja}`;
    if (subtitulo) subtitulo.textContent = ehMatriz
        ? "Acesso da Matriz: visualização de todas as unidades."
        : `Acesso da Filial: somente chamados da ${sessaoUsuario.loja}.`;
}

function resetFormularioUsuario() {
    $("formUsuario").reset();
    $("usuarioEdicaoId").value = "";
    $("usuarioCadastro").readOnly = false;
    $("rustdeskCadastro").value = "";
    $("computadorCadastro").value = "";
    $("senhaCadastro").required = true;
    $("senhaCadastro").placeholder = "Mínimo 6 caracteres";
    $("lojaCadastro").value = "Filial";
    $("perfilCadastro").value = "operador";
    $("btnCancelarEdicaoUsuario").classList.add("hidden");
    $("btnSalvarUsuario").textContent = "➕ Cadastrar usuário";
    $("usuarioMensagem").className = "error";
    $("usuarioMensagem").textContent = "";
}

async function abrirModalUsuarios() {
    if (!sessaoUsuario?.pode_gerenciar_usuarios) return;
    $("usuarioMensagem").textContent = "";
    resetFormularioUsuario();
    $("usuariosModal").classList.remove("hidden");
    await carregarUsuarios();
}

function fecharModalUsuarios() {
    $("usuariosModal").classList.add("hidden");
    $("usuarioMensagem").textContent = "";
}

async function carregarUsuarios() {
    try {
        const resposta = await api("/api/usuarios");
        const tbody = $("tabelaUsuarios");
        const lista = resposta.usuarios || [];
        usuariosCache = lista;
        if (!lista.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:25px;">Nenhum usuário cadastrado.</td></tr>`;
            return;
        }
        tbody.innerHTML = lista.map((usuario) => {
            const ativo = Number(usuario.ativo) === 1;
            const acao = usuario.id === sessaoUsuario.id
                ? `<span class="muted">Usuário atual</span>`
                : `<div class="user-actions-inline">
                    <button class="btn btn-light btn-user-edit" data-user-id="${usuario.id}" type="button">Editar</button>
                    ${ativo
                        ? `<button class="btn btn-danger btn-user-action" data-user-id="${usuario.id}" type="button">Desativar</button>`
                        : `<button class="btn btn-light btn-user-action" data-user-id="${usuario.id}" data-reativar="1" type="button">Reativar</button>`}
                    <button class="btn btn-danger btn-user-delete" data-user-id="${usuario.id}" type="button">🗑️ Excluir</button>
                </div>`;
            return `<tr>
                <td><strong>${escapeHTML(usuario.usuario)}</strong></td>
                <td>${escapeHTML(usuario.nome)}</td>
                <td><span class="unit-badge unit-${classeLoja(usuario.loja)}">${escapeHTML(usuario.loja)}</span></td>
                <td>${usuario.perfil === "admin" ? "Administrador" : "Operador"}</td>
                <td>${escapeHTML(usuario.computador || "—")}</td>
                <td>${ativo ? "Ativo" : "Inativo"}</td>
                <td>${acao}</td>
            </tr>`;
        }).join("");

        document.querySelectorAll(".btn-user-edit").forEach((botao) => {
            botao.addEventListener("click", () => {
                const usuario = usuariosCache.find((item) => String(item.id) === String(botao.dataset.userId));
                if (!usuario) return;
                $("usuarioEdicaoId").value = usuario.id;
                $("usuarioCadastro").value = usuario.usuario;
                $("usuarioCadastro").readOnly = true;
                $("nomeCadastro").value = usuario.nome;
                $("senhaCadastro").value = "";
                $("senhaCadastro").required = false;
                $("senhaCadastro").placeholder = "Deixe em branco para manter";
                $("lojaCadastro").value = usuario.loja;
                $("perfilCadastro").value = usuario.perfil;
                $("rustdeskCadastro").value = usuario.rustdesk_id || "";
                $("computadorCadastro").value = usuario.computador || "";
                $("btnCancelarEdicaoUsuario").classList.remove("hidden");
                $("btnSalvarUsuario").textContent = "💾 Salvar alterações";
                $("usuarioMensagem").textContent = `Editando ${usuario.nome}.`;
                $("usuarioMensagem").className = "muted";
            });
        });

        document.querySelectorAll(".btn-user-delete").forEach((botao) => {
            botao.addEventListener("click", async () => {
                const id = botao.dataset.userId;
                const usuario = usuariosCache.find((item) => String(item.id) === String(id));
                if (!usuario) return;
                const confirmacao = window.confirm(
                    `Excluir definitivamente o usuário "${usuario.nome}" (${usuario.usuario})?\n\n` +
                    "A conta será removida, mas os chamados já registrados permanecerão no sistema.\n\n" +
                    "Esta ação não poderá ser desfeita."
                );
                if (!confirmacao) return;
                try {
                    await api(`/api/usuarios/${id}`, { method: "DELETE" });
                    await carregarUsuarios();
                } catch (erro) {
                    alert(erro.message);
                }
            });
        });

        document.querySelectorAll(".btn-user-action").forEach((botao) => {
            botao.addEventListener("click", async () => {
                const id = botao.dataset.userId;
                const reativar = botao.dataset.reativar === "1";
                const confirmacao = reativar
                    ? "Reativar este usuário?"
                    : "Desativar este usuário? Ele não poderá mais entrar no painel.";
                if (!window.confirm(confirmacao)) return;
                try {
                    if (reativar) {
                        await api(`/api/usuarios/${id}`, {
                            method: "PUT",
                            body: JSON.stringify({ ativo: true })
                        });
                    } else {
                        await api(`/api/usuarios/${id}`, { method: "DELETE" });
                    }
                    await carregarUsuarios();
                } catch (erro) {
                    alert(erro.message);
                }
            });
        });
    } catch (erro) {
        $("tabelaUsuarios").innerHTML = `<tr><td colspan="7" style="text-align:center;padding:25px;color:#b91c1c;">${escapeHTML(erro.message)}</td></tr>`;
    }
}

$("btnGerenciarUsuarios").addEventListener("click", abrirModalUsuarios);
$("btnFecharUsuariosModal").addEventListener("click", fecharModalUsuarios);
$("btnAtualizarUsuarios").addEventListener("click", carregarUsuarios);
$("btnCancelarEdicaoUsuario").addEventListener("click", resetFormularioUsuario);
$("usuariosModal").addEventListener("click", (event) => {
    if (event.target === $("usuariosModal")) fecharModalUsuarios();
});

$("formUsuario").addEventListener("submit", async (event) => {
    event.preventDefault();
    const botao = $("btnSalvarUsuario");
    botao.disabled = true;
    botao.textContent = "Cadastrando...";
    $("usuarioMensagem").textContent = "";

    try {
        const edicaoId = $("usuarioEdicaoId").value;
        const payload = {
            usuario: $("usuarioCadastro").value.trim(),
            nome: $("nomeCadastro").value.trim(),
            senha: $("senhaCadastro").value,
            loja: $("lojaCadastro").value,
            perfil: $("perfilCadastro").value,
            rustdesk_id: $("rustdeskCadastro").value.trim(),
            computador: $("computadorCadastro").value.trim(),
            ativo: true
        };
        const resposta = await api(edicaoId ? `/api/usuarios/${edicaoId}` : "/api/usuarios", {
            method: edicaoId ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });
        $("usuarioMensagem").textContent = resposta.mensagem;
        $("usuarioMensagem").className = "success-text";
        resetFormularioUsuario();
        await carregarUsuarios();
    } catch (erro) {
        $("usuarioMensagem").textContent = erro.message;
        $("usuarioMensagem").className = "error";
    } finally {
        botao.disabled = false;
        botao.textContent = "➕ Cadastrar usuário";
    }
});

/* ================= PAINEL ================= */

async function carregarPainel() {
    if (carregando) return;
    if (!sessaoUsuario) {
        try {
            sessaoUsuario = await api("/api/sessao");
            aplicarPermissoesInterface();
            if ($("rustdeskIdChamado")) $("rustdeskIdChamado").value = sessaoUsuario.rustdesk_id || "";
            if ($("nome")) $("nome").value = sessaoUsuario.nome || sessaoUsuario.usuario || "";
            if ($("equipamento")) $("equipamento").value = sessaoUsuario.computador || "";
        } catch (_) {
            mostrarUsuario();
            return;
        }
    }
    carregando = true;

    try {
        const [lista, dashboard] = await Promise.all([
            api("/api/chamados"),
            api("/api/dashboard")
        ]);

        chamados = lista.chamados || [];

        if (!notificacaoInicializada) {
            ultimoIdConhecido = obterMaiorIdChamado(chamados);
        }

        $("totalChamados").textContent = dashboard.total;
        $("totalAbertos").textContent = dashboard.abertos;
        $("totalAtendimento").textContent = dashboard.atendimento;
        $("totalResolvidos").textContent = dashboard.resolvidos;

        preencherFiltroMes();
        renderizarTabela();


        const mesAtual = new Date().toISOString().slice(0, 7);
        if (!$("relatorioMes").value) {
            $("relatorioMes").value = mesAtual;
        }
        await carregarRelatorioMensal($("relatorioMes").value);
    } catch (erro) {
        if (erro.status === 401) {
            mostrarUsuario();
        } else {
            alert(erro.message);
        }
    } finally {
        carregando = false;
    }
}

function renderizarTabela() {
    const tbody = $("tabelaChamados");

    const busca = $("busca").value.trim().toLowerCase();
    const filtroLoja = $("filtroLoja").value;
    const filtroMes = $("filtroMes").value;
    const filtroStatus = $("filtroStatus").value;
    const filtroPrioridade = $("filtroPrioridade").value;

    const lista = chamados.filter((chamado) => {
        const texto = [
            chamado.id,
            chamado.nome,
            chamado.loja,
            chamado.setor,
            chamado.categoria,
            chamado.equipamento,
            chamado.descricao,
            chamado.status,
            chamado.prioridade
        ].join(" ").toLowerCase();

        const mesChamado = extrairMesChamado(chamado.data_criacao);

        return (
            texto.includes(busca) &&
            (!filtroLoja || chamado.loja === filtroLoja) &&
            (!filtroMes || mesChamado === filtroMes) &&
            (!filtroStatus || chamado.status === filtroStatus) &&
            (!filtroPrioridade || chamado.prioridade === filtroPrioridade)
        );
    });

    if (!lista.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center;padding:35px;">
                    Nenhum chamado encontrado.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lista.map((chamado) => `
        <tr>
            <td><strong>#${escapeHTML(chamado.numero || "")}</strong></td>
            <td>${escapeHTML(chamado.nome)}</td>
            <td><span class="unit-badge unit-${classeLoja(chamado.loja)}">${escapeHTML(chamado.loja || "Matriz")}</span></td>
            <td>${escapeHTML(chamado.setor)}</td>
            <td>${escapeHTML(chamado.categoria)}</td>
            <td>
                <span class="priority-${classePrioridade(chamado.prioridade)}">
                    ${escapeHTML(chamado.prioridade)}
                </span>
            </td>
            <td>
                <span class="badge status-${classeStatus(chamado.status)}">
                    ${escapeHTML(chamado.status)}
                </span>
            </td>
            <td>${escapeHTML(chamado.data_criacao)}</td>
            <td>
                <button class="btn btn-primary btn-ver" data-id="${chamado.id}" type="button">
                    Ver
                </button>
            </td>
        </tr>
    `).join("");

    document.querySelectorAll(".btn-ver").forEach((botao) => {
        botao.addEventListener("click", () => abrirChamado(botao.dataset.id));
    });
}

function extrairMesChamado(data) {
    if (!data || data.length < 10) return "";
    // Formato armazenado: DD/MM/AAAA HH:MM:SS
    return `${data.substring(6, 10)}-${data.substring(3, 5)}`;
}

function nomeMes(mes) {
    if (!mes) return "Todos os meses";
    const [ano, numero] = mes.split("-");
    const data = new Date(Number(ano), Number(numero) - 1, 1);
    return data.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric"
    }).replace(/^./, (letra) => letra.toUpperCase());
}

function preencherFiltroMes() {
    const select = $("filtroMes");
    const valorAtual = select.value;

    const meses = [...new Set(
        chamados
            .map((chamado) => extrairMesChamado(chamado.data_criacao))
            .filter(Boolean)
    )].sort().reverse();

    select.innerHTML = `<option value="">Todos os meses</option>` +
        meses.map((mes) =>
            `<option value="${mes}">${escapeHTML(nomeMes(mes))}</option>`
        ).join("");

    if (meses.includes(valorAtual)) {
        select.value = valorAtual;
    } else {
        select.value = "";
    }
}

$("busca").addEventListener("input", renderizarTabela);
$("filtroLoja").addEventListener("change", () => {
    const loja = $("filtroLoja").value;
    $("relatorioLoja").value = loja;
    renderizarTabela();
    carregarRelatorioMensal($("relatorioMes").value);
});
$("filtroMes").addEventListener("change", () => {
    renderizarTabela();
    if ($("filtroMes").value) {
        $("relatorioMes").value = $("filtroMes").value;
        carregarRelatorioMensal($("filtroMes").value);
    }
});
$("filtroStatus").addEventListener("change", renderizarTabela);
$("filtroPrioridade").addEventListener("change", renderizarTabela);


async function baixarRelatorioMensal(formato) {
    const mes = $("relatorioMes").value;

    if (!mes) {
        alert("Selecione o mês do relatório antes de exportar.");
        return;
    }

    const loja = $("relatorioLoja").value || "";
    const params = `mes=${encodeURIComponent(mes)}&loja=${encodeURIComponent(loja)}`;
    const endpoint = formato === "pdf"
        ? `/api/relatorio-mensal.pdf?${params}`
        : `/api/relatorio-mensal.csv?${params}`;

    const botao = formato === "pdf"
        ? $("btnExportarRelatorioPDF")
        : $("btnExportarRelatorioCSV");

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Gerando...";

    try {
        const resposta = await fetch(endpoint, {
            method: "GET",
            credentials: "same-origin"
        });

        if (!resposta.ok) {
            let mensagem = "Não foi possível gerar o relatório.";
            try {
                const erro = await resposta.json();
                mensagem = erro.mensagem || mensagem;
            } catch (_) {}
            throw new Error(mensagem);
        }

        const blob = await resposta.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `relatorio_helpdesk_${mes}.${formato}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    } catch (erro) {
        alert(erro.message || "Erro ao exportar relatório.");
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}

$("btnExportarRelatorioCSV").addEventListener("click", () => {
    baixarRelatorioMensal("csv");
});

$("btnExportarRelatorioPDF").addEventListener("click", () => {
    baixarRelatorioMensal("pdf");
});


$("relatorioLoja").addEventListener("change", async () => {
    $("filtroLoja").value = $("relatorioLoja").value;
    renderizarTabela();
    await carregarRelatorioMensal($("relatorioMes").value);
});

$("relatorioMes").addEventListener("change", async () => {
    const mes = $("relatorioMes").value;
    if (mes) {
        $("filtroMes").value = mes;
    } else {
        $("filtroMes").value = "";
    }
    renderizarTabela();
    await carregarRelatorioMensal(mes);
});

function renderChamadosRelatorio(lista) {
    const alvo = $("relatorioChamados");

    if (!lista || !lista.length) {
        alvo.innerHTML = `<tr><td colspan="9" class="report-empty-cell">Nenhum chamado no período.</td></tr>`;
        return;
    }

    alvo.innerHTML = lista.map((chamado) => `
        <tr>
            <td><strong>#${escapeHTML(chamado.numero || chamado.id || "")}</strong></td>
            <td>${escapeHTML(chamado.data_criacao || "")}</td>
            <td>${escapeHTML(chamado.nome || "")}</td>
            <td>${escapeHTML(chamado.loja || "Matriz")}</td>
            <td>${escapeHTML(chamado.setor || "")}</td>
            <td>${escapeHTML(chamado.equipamento || "-")}</td>
            <td>${escapeHTML(chamado.categoria || "")}</td>
            <td>${escapeHTML(chamado.prioridade || "")}</td>
            <td>${escapeHTML(chamado.status || "")}</td>
        </tr>
    `).join("");
}

async function carregarRelatorioMensal(mes) {
    if (!mes) {
        $("relatorioTotalMes").textContent = "—";
        $("relatorioPeriodo").textContent = "Selecione um mês para gerar o relatório.";
        $("relatorioChamados").innerHTML = `<tr><td colspan="9" class="report-empty-cell">Selecione um mês.</td></tr>`;
        return;
    }

    try {
        const resposta = await api(
            `/api/relatorio-mensal?mes=${encodeURIComponent(mes)}&loja=${encodeURIComponent($("relatorioLoja").value || "")}`
        );

        relatorioAtual = resposta;

        $("relatorioTotalMes").textContent = resposta.total;
        $("relatorioPeriodo").textContent =
            `Período: ${nomeMes(resposta.mes)} • Unidade: ${resposta.loja || "Todas"}`;

        renderChamadosRelatorio(resposta.chamados || []);
    } catch (erro) {
        $("relatorioPeriodo").textContent = erro.message;
        $("relatorioChamados").innerHTML = `<tr><td colspan="9" class="report-empty-cell">Não foi possível carregar o relatório.</td></tr>`;
    }
}

/* ================= ATENDIMENTO ================= */

function abrirChamado(id) {
    chamadoSelecionado = chamados.find(
        (chamado) => String(chamado.id) === String(id)
    );

    if (!chamadoSelecionado) return;

    $("modalTitulo").textContent =
        `Chamado #${escapeHTML(chamadoSelecionado.numero || "")}`;

    $("modalInfo").innerHTML = `
        <div class="info-box">
            <strong>Usuário:</strong> ${escapeHTML(chamadoSelecionado.nome)}<br>
            <strong>Unidade:</strong> ${escapeHTML(chamadoSelecionado.loja || "Matriz")}<br>
            <strong>Setor:</strong> ${escapeHTML(chamadoSelecionado.setor)}<br>
            <strong>Equipamento:</strong> ${escapeHTML(chamadoSelecionado.equipamento || "-")}<br>
            <strong>Categoria:</strong> ${escapeHTML(chamadoSelecionado.categoria)}<br>
            <strong>Prioridade:</strong> ${escapeHTML(chamadoSelecionado.prioridade)}<br>
            <strong>Data:</strong> ${escapeHTML(chamadoSelecionado.data_criacao)}
            <hr>
            <strong>Descrição:</strong>
            <p>${escapeHTML(chamadoSelecionado.descricao)}</p>
            ${
                chamadoSelecionado.observacao
                    ? `<hr><strong>Observação atual:</strong><p>${escapeHTML(chamadoSelecionado.observacao)}</p>`
                    : ""
            }
        </div>
    `;

    $("modalStatus").value = chamadoSelecionado.status;
    $("modalObservacao").value = chamadoSelecionado.observacao || "";
    $("modalRustdeskId").value = chamadoSelecionado.rustdesk_id || "";
    atualizarBotaoRustdesk();
    atualizarBotaoExcluirChamado();
    carregarHistoricoChamado(chamadoSelecionado.id);

    $("modal").classList.remove("hidden");
    $("modalStatus").focus();
}

function validarIdRustDesk(id) {
    return /^\d{6,20}$/.test(id);
}

function atualizarBotaoRustdesk() {
    const id = ($("modalRustdeskId")?.value || "").trim();
    const botao = $("btnAcessoRemoto");
    if (!botao) return;
    botao.disabled = !validarIdRustDesk(id);
}

async function carregarHistoricoChamado(id) {
    const alvo = $("historicoChamado");
    if (!alvo) return;
    alvo.innerHTML = "Carregando histórico...";
    try {
        const resposta = await api(`/api/chamados/${id}/historico`);
        const registros = resposta.historico || [];
        if (!registros.length) {
            alvo.innerHTML = '<div class="history-empty">Nenhum registro no histórico.</div>';
            return;
        }
        alvo.innerHTML = registros.map(item => `
            <div class="history-item">
                <div class="history-item-top">
                    <span class="history-type">${escapeHTML(item.tipo)}</span>
                    <span>${escapeHTML(item.data)}</span>
                </div>
                <div class="history-desc">${escapeHTML(item.descricao)}</div>
                <div class="history-user">👤 ${escapeHTML(item.usuario || "Sistema")}</div>
            </div>
        `).join("");
    } catch (erro) {
        alvo.innerHTML = `<div class="history-error">${escapeHTML(erro.message)}</div>`;
    }
}

async function abrirRustDesk() {
    const id = ($("modalRustdeskId")?.value || "").trim();

    if (!validarIdRustDesk(id)) {
        alert("ID RustDesk inválido. Informe somente números, com 6 a 20 dígitos.");
        $("modalRustdeskId")?.focus();
        return;
    }

    if (!chamadoSelecionado) {
        alert("Nenhum chamado selecionado.");
        return;
    }

    const confirmou = window.confirm(
        `Confirmar acesso remoto?\\n\\n` +
        `Computador: ${chamadoSelecionado.equipamento || "Não informado"}\\n` +
        `ID RustDesk: ${id}\\n` +
        `Chamado: #${chamadoSelecionado.numero || ""}\\n\\n` +
        `O RustDesk será aberto nesta máquina.`
    );

    if (!confirmou) return;

    const botao = $("btnAcessoRemoto");
    botao.disabled = true;
    botao.textContent = "⏳ Conectando...";

    const uri = `rustdesk://connection/new/${encodeURIComponent(id)}`;

    try {
        // Primeiro registra no servidor. Se o registro falhar, ainda tentamos
        // abrir o RustDesk para não impedir o atendimento.
        let registroOk = false;

        try {
            await api(`/api/chamados/${chamadoSelecionado.id}/acesso-remoto`, {
                method: "POST",
                body: JSON.stringify({ rustdesk_id: id })
            });
            registroOk = true;
        } catch (erroRegistro) {
            console.error("Falha ao registrar acesso remoto:", erroRegistro);
            // O acesso remoto não deve ficar bloqueado por uma falha de histórico.
        }

        try {
            await navigator.clipboard?.writeText(id);
        } catch (_) {}

        // Abre o RustDesk diretamente na máquina do técnico.
        window.location.href = uri;

        if (registroOk) {
            await carregarHistoricoChamado(chamadoSelecionado.id);
        } else {
            alert(
                "O RustDesk será aberto, mas o Helpdesk não conseguiu registrar " +
                "o acesso no histórico. Verifique o servidor depois."
            );
        }
    } finally {
        setTimeout(() => {
            botao.disabled = !validarIdRustDesk(($("modalRustdeskId")?.value || "").trim());
            botao.textContent = "🖥️ Acessar";
        }, 1200);
    }
}

$("modalRustdeskId")?.addEventListener("input", atualizarBotaoRustdesk);
$("btnAcessoRemoto")?.addEventListener("click", abrirRustDesk);

function fecharModal() {
    $("modal").classList.add("hidden");
    chamadoSelecionado = null;
    atualizarBotaoExcluirChamado();
}

$("btnFecharModal").addEventListener("click", fecharModal);
$("btnCancelarModal").addEventListener("click", fecharModal);

$("modal").addEventListener("click", (event) => {
    if (event.target === $("modal")) fecharModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("modal").classList.contains("hidden")) {
        fecharModal();
    }
});

$("btnSalvarAlteracoes").addEventListener("click", async () => {
    if (!chamadoSelecionado) return;

    const botao = $("btnSalvarAlteracoes");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        await api(`/api/chamados/${chamadoSelecionado.id}`, {
            method: "PUT",
            body: JSON.stringify({
                status: $("modalStatus").value,
                observacao: $("modalObservacao").value.trim(),
                rustdesk_id: $("modalRustdeskId").value.trim()
            })
        });

        fecharModal();
        await carregarPainel();
    } catch (erro) {
        alert(erro.message);
    } finally {
        botao.disabled = false;
        botao.textContent = "💾 Salvar alterações";
    }
});

/* ================= EXPORTAÇÃO ================= */

$("btnExportar").addEventListener("click", () => {
    window.location.href = "/api/exportar.csv";
});

/* ================= ATUALIZAÇÃO AUTOMÁTICA ================= */

setInterval(async () => {
    if (!$("adminSection").classList.contains("hidden")) {
        await carregarPainel();
    }
}, 10000);


// Notificações de novos chamados: consulta o servidor a cada 3 segundos.
document.addEventListener("click", () => {
    if (audioContextNotificacao && audioContextNotificacao.state === "suspended") {
        audioContextNotificacao.resume();
    }
}, { once: true });

// A aplicação começa sempre na tela de login.
mostrarLogin();
solicitarPermissaoNotificacao();

$("fecharNotificacao").addEventListener("click", esconderNotificacaoChamado);

async function excluirChamado(id, nomeChamado = "") {
    if (!id) return;
    const chamadoParaExcluir = chamados.find((item) => String(item.id) === String(id));
    const num = chamadoParaExcluir?.numero || String(id);
    if (!window.confirm(
        `⚠️ EXCLUIR CHAMADO\n\nChamado #${num}\nSolicitante: ${nomeChamado || "Não informado"}\n\n` +
        `Esta ação excluirá o chamado e o histórico relacionado.\nEla não poderá ser desfeita.\n\nDeseja realmente excluir?`
    )) return;
    if (!window.confirm(`CONFIRMAÇÃO FINAL\n\nExcluir definitivamente o chamado #${num}?`)) return;

    try {
        await api(`/api/chamados/${id}`, { method: "DELETE" });
        alert(`Chamado #${num} excluído com sucesso.`);
        if (typeof carregarChamados === "function") await carregarChamados();
        else if (typeof carregarPainel === "function") await carregarPainel();

        ["modalChamado","modalDetalhesChamado","modalAtendimento"].forEach(mid => {
            const el=document.getElementById(mid);
            if (el) el.style.display="none";
        });
    } catch (e) {
        console.error(e);
        alert(e?.message || "Não foi possível excluir o chamado.");
    }
}


function atualizarBotaoExcluirChamado() {
    const btn = $("btnExcluirChamado");
    if (!btn) return;

    const ehAdminMatriz =
        !!sessaoUsuario &&
        sessaoUsuario.perfil === "admin" &&
        sessaoUsuario.loja === "Matriz";

    btn.style.display = ehAdminMatriz ? "inline-flex" : "none";
    btn.disabled = !ehAdminMatriz || !chamadoSelecionado;
}

$("btnExcluirChamado")?.addEventListener("click", () => {
    if (!chamadoSelecionado) {
        alert("Selecione um chamado primeiro.");
        return;
    }

    if (!sessaoUsuario || sessaoUsuario.perfil !== "admin" || sessaoUsuario.loja !== "Matriz") {
        alert("Somente o administrador da Matriz pode excluir chamados.");
        return;
    }

    excluirChamado(chamadoSelecionado.id, chamadoSelecionado.nome || "");
});
;
