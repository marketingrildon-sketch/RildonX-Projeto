from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from pathlib import Path
import sqlite3
import csv
import io
from io import BytesIO
import os
import re

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "helpdesk.db"

app = Flask(__name__)
app.secret_key = os.environ.get("HELPDESK_SECRET_KEY", "troque-esta-chave-em-producao")

ADMIN_USER = os.environ.get("HELPDESK_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("HELPDESK_ADMIN_PASSWORD", "1234")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def garantir_coluna(conn, tabela, coluna, definicao):
    colunas = {row[1] for row in conn.execute(f"PRAGMA table_info({tabela})").fetchall()}
    if coluna not in colunas:
        conn.execute(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {definicao}")


def obter_periodo_chamado(data_texto):
    """Retorna (ano, mes) a partir de DD/MM/AAAA HH:MM:SS."""
    try:
        dt = datetime.strptime(str(data_texto)[:19], "%d/%m/%Y %H:%M:%S")
        return dt.year, dt.month
    except (ValueError, TypeError):
        return datetime.now().year, datetime.now().month


def formatar_numero_chamado(ano, mes, sequencial):
    return f"CH-{int(ano):04d}-{int(mes):02d}-{int(sequencial):04d}"


def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS usuarios_ti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL,
            nome TEXT NOT NULL,
            loja TEXT NOT NULL DEFAULT 'Matriz',
            perfil TEXT NOT NULL DEFAULT 'operador',
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT NOT NULL DEFAULT ''
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS chamados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            loja TEXT NOT NULL DEFAULT 'Matriz',
            setor TEXT NOT NULL,
            equipamento TEXT DEFAULT '',
            categoria TEXT NOT NULL,
            prioridade TEXT NOT NULL DEFAULT 'Normal',
            descricao TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Aberto',
            observacao TEXT DEFAULT '',
            data_criacao TEXT NOT NULL,
            data_atualizacao TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS sequencia_chamados (
            ano INTEGER NOT NULL,
            mes INTEGER NOT NULL,
            ultimo_numero INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (ano, mes)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS historico_chamados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chamado_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            usuario TEXT NOT NULL DEFAULT '',
            data TEXT NOT NULL,
            FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE CASCADE
        )
    """)

    # Migrações automáticas de versões anteriores.
    garantir_coluna(conn, "chamados", "loja", "TEXT NOT NULL DEFAULT 'Matriz'")
    garantir_coluna(conn, "chamados", "rustdesk_id", "TEXT NOT NULL DEFAULT ''")
    garantir_coluna(conn, "usuarios_ti", "loja", "TEXT NOT NULL DEFAULT 'Matriz'")
    garantir_coluna(conn, "usuarios_ti", "perfil", "TEXT NOT NULL DEFAULT 'operador'")
    garantir_coluna(conn, "usuarios_ti", "criado_em", "TEXT NOT NULL DEFAULT ''")
    garantir_coluna(conn, "usuarios_ti", "rustdesk_id", "TEXT NOT NULL DEFAULT ''")
    garantir_coluna(conn, "usuarios_ti", "computador", "TEXT NOT NULL DEFAULT ''")
    garantir_coluna(conn, "chamados", "numero_mes", "INTEGER")

    # Migra os chamados antigos para a numeração mensal sem alterar o ID interno.
    chamados_sem_numero = conn.execute(
        "SELECT id, data_criacao FROM chamados WHERE numero_mes IS NULL ORDER BY data_criacao ASC, id ASC"
    ).fetchall()
    for antigo in chamados_sem_numero:
        ano_antigo, mes_antigo = obter_periodo_chamado(antigo["data_criacao"])
        seq = conn.execute(
            "SELECT ultimo_numero FROM sequencia_chamados WHERE ano = ? AND mes = ?",
            (ano_antigo, mes_antigo)
        ).fetchone()
        proximo = (int(seq["ultimo_numero"]) if seq else 0) + 1
        conn.execute(
            "INSERT INTO sequencia_chamados (ano, mes, ultimo_numero) VALUES (?, ?, ?) "
            "ON CONFLICT(ano, mes) DO UPDATE SET ultimo_numero = excluded.ultimo_numero",
            (ano_antigo, mes_antigo, proximo)
        )
        conn.execute("UPDATE chamados SET numero_mes = ? WHERE id = ?", (proximo, antigo["id"]))

    admin = conn.execute(
        "SELECT id FROM usuarios_ti WHERE usuario = ?",
        (ADMIN_USER,)
    ).fetchone()

    if not admin:
        conn.execute(
            """
            INSERT INTO usuarios_ti (usuario, senha_hash, nome, loja, perfil, criado_em)
            VALUES (?, ?, ?, 'Matriz', 'admin', ?)
            """,
            (
                ADMIN_USER,
                generate_password_hash(ADMIN_PASSWORD),
                "Analista de TI",
                agora() if 'agora' in globals() else datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            )
        )
    else:
        # A conta administrativa original sempre mantém acesso total pela Matriz.
        conn.execute(
            "UPDATE usuarios_ti SET loja = 'Matriz', perfil = 'admin' WHERE usuario = ?",
            (ADMIN_USER,)
        )

    conn.commit()
    conn.close()


def agora():
    return datetime.now().strftime("%d/%m/%Y %H:%M:%S")


def admin_required():
    return session.get("admin_logged_in") is True


def usuario_sessao():
    if not admin_required():
        return None
    return {
        "id": session.get("usuario_id"),
        "usuario": session.get("admin_usuario"),
        "nome": session.get("admin_nome"),
        "loja": session.get("admin_loja", "Matriz"),
        "perfil": session.get("admin_perfil", "operador"),
        "rustdesk_id": session.get("admin_rustdesk_id", ""),
        "computador": session.get("admin_computador", ""),
    }


def acesso_total():
    usuario = usuario_sessao()
    return bool(usuario and usuario.get("loja") == "Matriz")


def pode_gerenciar_usuarios():
    usuario = usuario_sessao()
    return bool(usuario and usuario.get("perfil") == "admin" and usuario.get("loja") == "Matriz")


def filtro_loja_sql(base_where, params, campo="loja"):
    usuario = usuario_sessao()
    if usuario and usuario.get("loja") != "Matriz":
        base_where += f" AND {campo} = ?"
        params.append(usuario["loja"])
    return base_where, params


from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

@app.route("/")
def index():
    # A primeira tela é sempre o login. O operador só acessa o formulário
    # de abertura depois de autenticar; o administrador vai para o painel do TI.
    return render_template("index.html")


@app.route("/login", methods=["POST"])
def login():
    dados = request.get_json(silent=True) or {}
    usuario = str(dados.get("usuario", "")).strip()
    senha = str(dados.get("senha", ""))

    conn = get_db()
    admin = conn.execute(
        """
        SELECT * FROM usuarios_ti
        WHERE usuario = ? AND ativo = 1
        """,
        (usuario,)
    ).fetchone()
    conn.close()

    if admin and check_password_hash(admin["senha_hash"], senha):
        session["admin_logged_in"] = True
        session["usuario_id"] = admin["id"]
        session["admin_usuario"] = admin["usuario"]
        session["admin_nome"] = admin["nome"]
        session["admin_loja"] = admin["loja"] or "Matriz"
        session["admin_perfil"] = admin["perfil"] or "operador"
        session["admin_rustdesk_id"] = admin["rustdesk_id"] or ""
        session["admin_computador"] = admin["computador"] or ""
        return jsonify({
            "ok": True,
            "id": admin["id"],
            "nome": admin["nome"],
            "usuario": admin["usuario"],
            "loja": admin["loja"] or "Matriz",
            "perfil": admin["perfil"] or "operador",
            "rustdesk_id": admin["rustdesk_id"] or "",
            "computador": admin["computador"] or "",
            "pode_gerenciar_usuarios": (admin["loja"] == "Matriz" and admin["perfil"] == "admin")
        })

    return jsonify({
        "ok": False,
        "mensagem": "Usuário ou senha inválidos."
    }), 401


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/sessao", methods=["GET"])
def sessao_atual():
    usuario = usuario_sessao()
    if not usuario:
        return jsonify({"ok": False, "mensagem": "Não autenticado."}), 401
    return jsonify({
        "ok": True,
        **usuario,
        "pode_gerenciar_usuarios": pode_gerenciar_usuarios(),
        "rustdesk_id": usuario.get("rustdesk_id", "")
    })


@app.route("/api/usuarios", methods=["GET", "POST"])
def usuarios_api():
    if not pode_gerenciar_usuarios():
        return jsonify({"ok": False, "mensagem": "Apenas um administrador da Matriz pode gerenciar usuários."}), 403

    conn = get_db()
    if request.method == "GET":
        rows = conn.execute(
            "SELECT id, usuario, nome, loja, perfil, ativo, criado_em, rustdesk_id, computador FROM usuarios_ti ORDER BY nome, usuario"
        ).fetchall()
        conn.close()
        return jsonify({"ok": True, "usuarios": [dict(row) for row in rows]})

    dados = request.get_json(silent=True) or {}
    usuario = str(dados.get("usuario", "")).strip().lower()
    nome = str(dados.get("nome", "")).strip()
    senha = str(dados.get("senha", ""))
    loja = str(dados.get("loja", "")).strip()
    perfil = str(dados.get("perfil", "operador")).strip()
    rustdesk_id = str(dados.get("rustdesk_id", "")).strip()
    computador = str(dados.get("computador", "")).strip()
    if rustdesk_id and not re.fullmatch(r"\d{6,20}", rustdesk_id):
        conn.close()
        return jsonify({"ok": False, "mensagem": "ID RustDesk inválido. Informe somente números (6 a 20 dígitos)."}), 400

    if not usuario or not nome or not senha or loja not in {"Matriz", "Filial"} or perfil not in {"admin", "operador"}:
        conn.close()
        return jsonify({"ok": False, "mensagem": "Preencha usuário, nome, senha, loja e perfil corretamente."}), 400
    if len(senha) < 6:
        conn.close()
        return jsonify({"ok": False, "mensagem": "A senha deve ter pelo menos 6 caracteres."}), 400
    if " " in usuario:
        conn.close()
        return jsonify({"ok": False, "mensagem": "O usuário não pode conter espaços."}), 400

    try:
        conn.execute(
            "INSERT INTO usuarios_ti (usuario, senha_hash, nome, loja, perfil, ativo, criado_em, rustdesk_id, computador) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)",
            (usuario, generate_password_hash(senha), nome, loja, perfil, agora(), rustdesk_id, computador)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"ok": False, "mensagem": "Esse usuário já existe."}), 409
    conn.close()
    return jsonify({"ok": True, "mensagem": "Usuário cadastrado com sucesso."}), 201


@app.route("/api/usuarios/<int:usuario_id>", methods=["PUT", "DELETE"])
def usuario_admin_api(usuario_id):
    if not pode_gerenciar_usuarios():
        return jsonify({"ok": False, "mensagem": "Apenas um administrador da Matriz pode gerenciar usuários."}), 403
    if usuario_id == session.get("usuario_id"):
        return jsonify({"ok": False, "mensagem": "O usuário atualmente logado não pode ser desativado ou alterado por esta tela."}), 400

    conn = get_db()
    row = conn.execute("SELECT * FROM usuarios_ti WHERE id = ?", (usuario_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"ok": False, "mensagem": "Usuário não encontrado."}), 404

    if request.method == "DELETE":
        # Exclusão definitiva da conta, sem apagar os chamados já registrados.
        # Os chamados não possuem vínculo de chave estrangeira com usuarios_ti,
        # portanto o histórico permanece preservado.
        conn.execute("DELETE FROM usuarios_ti WHERE id = ?", (usuario_id,))
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "mensagem": "Usuário excluído definitivamente."})

    dados = request.get_json(silent=True) or {}
    nome = str(dados.get("nome", row["nome"])).strip()
    loja = str(dados.get("loja", row["loja"])).strip()
    perfil = str(dados.get("perfil", row["perfil"])).strip()
    senha = str(dados.get("senha", ""))
    rustdesk_id = str(dados.get("rustdesk_id", row["rustdesk_id"] or "")).strip()
    computador = str(dados.get("computador", row["computador"] or "")).strip()
    if rustdesk_id and not re.fullmatch(r"\d{6,20}", rustdesk_id):
        conn.close()
        return jsonify({"ok": False, "mensagem": "ID RustDesk inválido. Informe somente números (6 a 20 dígitos)."}), 400
    ativo = 1 if dados.get("ativo", row["ativo"]) else 0

    if not nome or loja not in {"Matriz", "Filial"} or perfil not in {"admin", "operador"}:
        conn.close()
        return jsonify({"ok": False, "mensagem": "Dados de usuário inválidos."}), 400
    if senha and len(senha) < 6:
        conn.close()
        return jsonify({"ok": False, "mensagem": "A nova senha deve ter pelo menos 6 caracteres."}), 400

    if senha:
        conn.execute(
            "UPDATE usuarios_ti SET nome = ?, loja = ?, perfil = ?, ativo = ?, senha_hash = ?, rustdesk_id = ?, computador = ? WHERE id = ?",
            (nome, loja, perfil, ativo, generate_password_hash(senha), rustdesk_id, computador, usuario_id)
        )
    else:
        conn.execute(
            "UPDATE usuarios_ti SET nome = ?, loja = ?, perfil = ?, ativo = ?, rustdesk_id = ?, computador = ? WHERE id = ?",
            (nome, loja, perfil, ativo, rustdesk_id, computador, usuario_id)
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "mensagem": "Usuário atualizado com sucesso."})


@app.route("/api/admin/senha", methods=["PUT"])
def alterar_senha_admin():
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    dados = request.get_json(silent=True) or {}
    senha_atual = str(dados.get("senha_atual", ""))
    nova_senha = str(dados.get("nova_senha", ""))
    confirmar_senha = str(dados.get("confirmar_senha", ""))

    if not senha_atual or not nova_senha or not confirmar_senha:
        return jsonify({
            "ok": False,
            "mensagem": "Preencha todos os campos."
        }), 400

    if len(nova_senha) < 6:
        return jsonify({
            "ok": False,
            "mensagem": "A nova senha deve ter pelo menos 6 caracteres."
        }), 400

    if nova_senha != confirmar_senha:
        return jsonify({
            "ok": False,
            "mensagem": "A confirmação da nova senha não confere."
        }), 400

    conn = get_db()
    usuario_logado = usuario_sessao()
    admin = conn.execute(
        "SELECT * FROM usuarios_ti WHERE id = ? AND ativo = 1",
        (usuario_logado["id"],)
    ).fetchone()

    if not admin or not check_password_hash(admin["senha_hash"], senha_atual):
        conn.close()
        return jsonify({
            "ok": False,
            "mensagem": "A senha atual está incorreta."
        }), 400

    conn.execute(
        "UPDATE usuarios_ti SET senha_hash = ? WHERE id = ?",
        (generate_password_hash(nova_senha), usuario_logado["id"])
    )
    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "mensagem": "Senha alterada com sucesso."
    })


@app.route("/api/usuario-atual", methods=["GET"])
def usuario_atual_api():
    usuario = usuario_sessao()
    if not usuario:
        return jsonify({"ok": False, "mensagem": "Não autenticado."}), 401
    return jsonify({
        "ok": True,
        "id": usuario.get("id"),
        "usuario": usuario.get("usuario", ""),
        "nome": usuario.get("nome", ""),
        "loja": usuario.get("loja", "Matriz"),
        "rustdesk_id": usuario.get("rustdesk_id", ""),
        "computador": usuario.get("computador", "")
    })


@app.route("/api/chamados", methods=["POST"])
def criar_chamado():
    # A abertura de chamados não é mais pública: somente usuário autenticado.
    usuario = usuario_sessao()
    if not usuario:
        return jsonify({"ok": False, "mensagem": "Faça login para abrir um chamado."}), 401

    dados = request.get_json(silent=True) or {}

    campos = ["nome", "loja", "setor", "categoria", "descricao"]
    for campo in campos:
        if not str(dados.get(campo, "")).strip():
            return jsonify({
                "ok": False,
                "mensagem": f"O campo '{campo}' é obrigatório."
            }), 400

    prioridade = str(dados.get("prioridade", "Normal")).strip()
    prioridades_validas = {"Baixa", "Normal", "Alta", "Urgente"}

    if prioridade not in prioridades_validas:
        prioridade = "Normal"

    loja = str(dados.get("loja", usuario["loja"])).strip()
    lojas_validas = {"Matriz", "Filial"}
    if loja not in lojas_validas:
        loja = usuario["loja"]

    # Operadores só podem abrir chamados na própria loja.
    # O administrador da Matriz mantém acesso às duas unidades.
    if usuario.get("perfil") != "admin" or usuario.get("loja") != "Matriz":
        loja = usuario["loja"]

    data = agora()

    rustdesk_id = str(dados.get("rustdesk_id", "")).strip()
    if not rustdesk_id:
        rustdesk_id = str(usuario.get("rustdesk_id", "")).strip()
    if rustdesk_id and not re.fullmatch(r"\d{6,20}", rustdesk_id):
        return jsonify({"ok": False, "mensagem": "ID RustDesk inválido. Informe somente números (6 a 20 dígitos)."}), 400

    conn = get_db()
    conn.execute("BEGIN IMMEDIATE")
    ano_chamado, mes_chamado = obter_periodo_chamado(data)
    seq = conn.execute(
        "SELECT ultimo_numero FROM sequencia_chamados WHERE ano = ? AND mes = ?",
        (ano_chamado, mes_chamado)
    ).fetchone()
    numero_mes = (int(seq["ultimo_numero"]) if seq else 0) + 1
    conn.execute(
        "INSERT INTO sequencia_chamados (ano, mes, ultimo_numero) VALUES (?, ?, ?) "
        "ON CONFLICT(ano, mes) DO UPDATE SET ultimo_numero = excluded.ultimo_numero",
        (ano_chamado, mes_chamado, numero_mes)
    )

    cursor = conn.execute(
        """
        INSERT INTO chamados (
            nome, loja, setor, equipamento, categoria, prioridade,
            descricao, status, observacao, rustdesk_id, numero_mes, data_criacao, data_atualizacao
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Aberto', '', ?, ?, ?, ?)
        """,
        (
            str(dados["nome"]).strip(),
            loja,
            str(dados["setor"]).strip(),
            str(dados.get("equipamento", "")).strip(),
            str(dados["categoria"]).strip(),
            prioridade,
            str(dados["descricao"]).strip(),
            rustdesk_id,
            numero_mes,
            data,
            data
        )
    )

    chamado_id = cursor.lastrowid
    conn.execute(
        "INSERT INTO historico_chamados (chamado_id, tipo, descricao, usuario, data) VALUES (?, ?, ?, ?, ?)",
        (chamado_id, "Chamado", "Chamado aberto", usuario.get("nome", usuario.get("usuario", "")), data)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "id": chamado_id,
        "numero": formatar_numero_chamado(ano_chamado, mes_chamado, numero_mes),
        "numero_mes": numero_mes,
        "ano": ano_chamado,
        "mes": mes_chamado
    }), 201


@app.route("/api/chamados/consultar/<numero>", methods=["GET"])
def consultar_chamado(numero):
    usuario = usuario_sessao()
    if not usuario:
        return jsonify({"ok": False, "mensagem": "Faça login para consultar um chamado."}), 401

    identificador = str(numero).strip().replace("#", "")
    conn = get_db()

    # Novo padrão: CH-AAAA-MM-NNNN. Também aceitamos o número mensal 0001
    # quando o mês/ano forem identificáveis pelo registro único.
    chamado = None
    m = re.fullmatch(r"CH-(\d{4})-(\d{2})-(\d{4,})", identificador, re.IGNORECASE)
    if m:
        ano_consulta, mes_consulta, seq_consulta = map(int, m.groups())
        chamado = conn.execute(
            """SELECT * FROM chamados
               WHERE substr(data_criacao, 7, 4) = ?
                 AND substr(data_criacao, 4, 2) = ?
                 AND numero_mes = ?""",
            (f"{ano_consulta:04d}", f"{mes_consulta:02d}", seq_consulta)
        ).fetchone()
    else:
        # Compatibilidade: números antigos pelo ID interno continuam consultáveis.
        try:
            chamado_id = int(identificador)
        except ValueError:
            return jsonify({"ok": False, "mensagem": "Número inválido. Use CH-AAAA-MM-NNNN."}), 400
        chamado = conn.execute(
            "SELECT * FROM chamados WHERE id = ?",
            (chamado_id,)
        ).fetchone()
    conn.close()

    if not chamado:
        return jsonify({
            "ok": False,
            "mensagem": "Chamado não encontrado."
        }), 404

    # Usuário de filial/matriz operador só consulta chamados da própria loja.
    if usuario.get("loja") != "Matriz" or usuario.get("perfil") != "admin":
        if chamado["loja"] != usuario.get("loja"):
            return jsonify({
                "ok": False,
                "mensagem": "Chamado não encontrado."
            }), 404

    return jsonify({
        "ok": True,
        "chamado": dict(chamado)
    })


@app.route("/api/chamados", methods=["GET"])
def listar_chamados():
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    conn = get_db()
    where, params = filtro_loja_sql("1=1", [])
    chamados = conn.execute(
        f"SELECT *, ('CH-' || substr(data_criacao, 7, 4) || '-' || substr(data_criacao, 4, 2) || '-' || printf('%04d', numero_mes)) AS numero FROM chamados WHERE {where} ORDER BY id DESC",
        params
    ).fetchall()
    conn.close()

    return jsonify({
        "ok": True,
        "chamados": [dict(chamado) for chamado in chamados]
    })


@app.route("/api/chamados/<int:chamado_id>", methods=["PUT"])
def atualizar_chamado(chamado_id):
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    dados = request.get_json(silent=True) or {}

    status = str(dados.get("status", "")).strip()
    observacao = str(dados.get("observacao", "")).strip()
    rustdesk_id = str(dados.get("rustdesk_id", "")).strip()
    computador = str(dados.get("computador", "")).strip()
    if rustdesk_id and not re.fullmatch(r"\d{6,20}", rustdesk_id):
        return jsonify({"ok": False, "mensagem": "ID RustDesk inválido. Informe somente números (6 a 20 dígitos)."}), 400

    status_validos = {
        "Aberto",
        "Em atendimento",
        "Aguardando usuário",
        "Resolvido",
        "Encerrado"
    }

    if status not in status_validos:
        return jsonify({
            "ok": False,
            "mensagem": "Status inválido."
        }), 400

    conn = get_db()
    if not acesso_total():
        permitido = conn.execute("SELECT loja FROM chamados WHERE id = ?", (chamado_id,)).fetchone()
        if not permitido or permitido["loja"] != usuario_sessao()["loja"]:
            conn.close()
            return jsonify({"ok": False, "mensagem": "Você não tem permissão para alterar este chamado."}), 403
    atual = conn.execute("SELECT status, observacao, rustdesk_id FROM chamados WHERE id = ?", (chamado_id,)).fetchone()
    if not atual:
        conn.close()
        return jsonify({"ok": False, "mensagem": "Chamado não encontrado."}), 404

    data_atualizacao = agora()
    cursor = conn.execute(
        """
        UPDATE chamados
        SET status = ?, observacao = ?, rustdesk_id = ?, data_atualizacao = ?
        WHERE id = ?
        """,
        (status, observacao, rustdesk_id, data_atualizacao, chamado_id)
    )

    usuario = usuario_sessao() or {}
    usuario_nome = usuario.get("nome") or usuario.get("usuario") or ""
    if str(atual["status"]) != status:
        conn.execute(
            "INSERT INTO historico_chamados (chamado_id, tipo, descricao, usuario, data) VALUES (?, ?, ?, ?, ?)",
            (chamado_id, "Status", f"Status alterado de '{atual['status']}' para '{status}'", usuario_nome, data_atualizacao)
        )
    if str(atual["observacao"] or "") != observacao:
        conn.execute(
            "INSERT INTO historico_chamados (chamado_id, tipo, descricao, usuario, data) VALUES (?, ?, ?, ?, ?)",
            (chamado_id, "Observação", "Observação/solução atualizada", usuario_nome, data_atualizacao)
        )
    if str(atual["rustdesk_id"] or "") != rustdesk_id:
        descricao = "ID RustDesk atualizado" if rustdesk_id else "ID RustDesk removido"
        conn.execute(
            "INSERT INTO historico_chamados (chamado_id, tipo, descricao, usuario, data) VALUES (?, ?, ?, ?, ?)",
            (chamado_id, "RustDesk", descricao, usuario_nome, data_atualizacao)
        )

    conn.commit()
    atualizado = cursor.rowcount
    conn.close()

    if not atualizado:
        return jsonify({
            "ok": False,
            "mensagem": "Chamado não encontrado."
        }), 404

    return jsonify({"ok": True})


@app.route("/api/chamados/<int:chamado_id>/acesso-remoto", methods=["POST"])
def registrar_acesso_remoto(chamado_id):
    """
    Registra a solicitação de acesso remoto sem tentar executar o RustDesk no servidor.
    O cliente (navegador da máquina de TI) abre o protocolo rustdesk://.
    """
    if not admin_required():
        return jsonify({"ok": False, "mensagem": "Acesso não autorizado."}), 401

    dados = request.get_json(silent=True) or {}
    rustdesk_id = str(dados.get("rustdesk_id", "")).strip()

    if not re.fullmatch(r"\d{6,20}", rustdesk_id):
        return jsonify({
            "ok": False,
            "mensagem": "ID RustDesk inválido. Informe somente números (6 a 20 dígitos)."
        }), 400

    conn = None
    try:
        conn = get_db()

        # Garante compatibilidade com bancos criados em versões anteriores.
        garantir_coluna(conn, "chamados", "rustdesk_id", "TEXT NOT NULL DEFAULT ''")
        garantir_coluna(conn, "usuarios_ti", "rustdesk_id", "TEXT NOT NULL DEFAULT ''")
        garantir_coluna(conn, "usuarios_ti", "computador", "TEXT NOT NULL DEFAULT ''")

        chamado = conn.execute(
            "SELECT id, nome, loja, equipamento, rustdesk_id FROM chamados WHERE id = ?",
            (chamado_id,)
        ).fetchone()

        if not chamado:
            return jsonify({"ok": False, "mensagem": "Chamado não encontrado."}), 404

        usuario = usuario_sessao() or {}

        # Matriz pode acessar todos. Filial somente os próprios chamados.
        if usuario.get("loja") != "Matriz" and chamado["loja"] != usuario.get("loja"):
            return jsonify({
                "ok": False,
                "mensagem": "Você não tem permissão para acessar este chamado."
            }), 403

        data = agora()
        nome_usuario = usuario.get("nome") or usuario.get("usuario") or "Sistema"

        conn.execute(
            "UPDATE chamados SET rustdesk_id = ?, data_atualizacao = ? WHERE id = ?",
            (rustdesk_id, data, chamado_id)
        )

        # Vincula o novo ID ao usuário solicitante, quando houver correspondência.
        try:
            vinculo = conn.execute(
                """
                SELECT id FROM usuarios_ti
                WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND ativo = 1
                LIMIT 1
                """,
                (chamado["nome"],)
            ).fetchone()

            if vinculo:
                conn.execute(
                    "UPDATE usuarios_ti SET rustdesk_id = ? WHERE id = ?",
                    (rustdesk_id, vinculo["id"])
                )
        except sqlite3.Error:
            # O acesso remoto não deve ser bloqueado por uma falha secundária
            # no vínculo do usuário.
            pass

        conn.execute(
            """
            INSERT INTO historico_chamados
            (chamado_id, tipo, descricao, usuario, data)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                chamado_id,
                "Acesso remoto",
                f"Solicitação de acesso RustDesk para o ID {rustdesk_id}",
                nome_usuario,
                data
            )
        )

        conn.commit()

        return jsonify({
            "ok": True,
            "mensagem": "Acesso remoto registrado no histórico.",
            "rustdesk_id": rustdesk_id,
            "data": data,
            "uri": f"rustdesk://connection/new/{rustdesk_id}"
        })

    except sqlite3.Error as erro:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        app.logger.exception("Erro SQLite ao registrar acesso remoto")
        return jsonify({
            "ok": False,
            "mensagem": "Não foi possível registrar o acesso remoto no histórico.",
            "detalhe": str(erro)
        }), 500
    except Exception as erro:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        app.logger.exception("Erro inesperado ao registrar acesso remoto")
        return jsonify({
            "ok": False,
            "mensagem": "Erro interno ao registrar o acesso remoto.",
            "detalhe": str(erro)
        }), 500
    finally:
        if conn:
            conn.close()



@app.route("/api/chamados/<int:chamado_id>", methods=["DELETE"])
def excluir_chamado(chamado_id):
    """Exclui chamado e histórico; somente administrador."""
    usuario = usuario_sessao()
    if not usuario or usuario.get("perfil") != "admin" or usuario.get("loja") != "Matriz":
        return jsonify({"ok": False, "mensagem": "Somente o administrador da Matriz pode excluir chamados."}), 403
    conn = None
    try:
        conn = get_db()
        chamado = conn.execute(
            "SELECT id, nome, equipamento, loja FROM chamados WHERE id = ?",
            (chamado_id,)
        ).fetchone()
        if not chamado:
            return jsonify({"ok": False, "mensagem": "Chamado não encontrado."}), 404

        try:
            conn.execute("DELETE FROM historico_chamados WHERE chamado_id = ?", (chamado_id,))
        except sqlite3.Error:
            pass

        conn.execute("DELETE FROM chamados WHERE id = ?", (chamado_id,))
        conn.commit()

        usuario = usuario_sessao() or {}
        nome_admin = usuario.get("nome") or usuario.get("usuario") or "Administrador"
        app.logger.warning(
            "Chamado #%s excluído por %s (solicitante=%s, equipamento=%s, loja=%s)",
            chamado_id, nome_admin, chamado["nome"], chamado["equipamento"], chamado["loja"]
        )
        return jsonify({"ok": True, "mensagem": f"Chamado #{chamado_id} excluído com sucesso."})
    except sqlite3.Error as erro:
        if conn:
            try: conn.rollback()
            except Exception: pass
        app.logger.exception("Erro SQLite ao excluir chamado")
        return jsonify({"ok": False, "mensagem": "Não foi possível excluir o chamado.", "detalhe": str(erro)}), 500
    except Exception as erro:
        if conn:
            try: conn.rollback()
            except Exception: pass
        app.logger.exception("Erro inesperado ao excluir chamado")
        return jsonify({"ok": False, "mensagem": "Erro interno ao excluir o chamado.", "detalhe": str(erro)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/chamados/<int:chamado_id>/historico", methods=["GET"])
def historico_chamado(chamado_id):
    if not admin_required():
        return jsonify({"ok": False, "mensagem": "Acesso não autorizado."}), 401

    conn = get_db()
    chamado = conn.execute("SELECT id, loja FROM chamados WHERE id = ?", (chamado_id,)).fetchone()
    if not chamado:
        conn.close()
        return jsonify({"ok": False, "mensagem": "Chamado não encontrado."}), 404

    usuario = usuario_sessao() or {}
    if usuario.get("loja") != "Matriz" or usuario.get("perfil") != "admin":
        if chamado["loja"] != usuario.get("loja"):
            conn.close()
            return jsonify({"ok": False, "mensagem": "Acesso não autorizado."}), 403

    registros = conn.execute(
        "SELECT id, tipo, descricao, usuario, data FROM historico_chamados WHERE chamado_id = ? ORDER BY id DESC",
        (chamado_id,)
    ).fetchall()
    conn.close()
    return jsonify({"ok": True, "historico": [dict(r) for r in registros]})


@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    conn = get_db()
    where, params = filtro_loja_sql("1=1", [])

    total = conn.execute(
        f"SELECT COUNT(*) AS total FROM chamados WHERE {where}", params
    ).fetchone()["total"]

    abertos = conn.execute(
        f"SELECT COUNT(*) AS total FROM chamados WHERE {where} AND status = 'Aberto'", params
    ).fetchone()["total"]

    atendimento = conn.execute(
        f"SELECT COUNT(*) AS total FROM chamados WHERE {where} AND status = 'Em atendimento'", params
    ).fetchone()["total"]

    resolvidos = conn.execute(
        f"SELECT COUNT(*) AS total FROM chamados WHERE {where} AND status IN ('Resolvido', 'Encerrado')", params
    ).fetchone()["total"]

    conn.close()

    return jsonify({
        "ok": True,
        "total": total,
        "abertos": abertos,
        "atendimento": atendimento,
        "resolvidos": resolvidos
    })


@app.route("/api/dashboard/mensal", methods=["GET"])
def dashboard_mensal():
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    ano = request.args.get("ano", default=datetime.now().year, type=int)
    if ano < 2000 or ano > 2100:
        return jsonify({
            "ok": False,
            "mensagem": "Ano inválido."
        }), 400

    conn = get_db()
    where = "substr(data_criacao, 7, 4) = ?"
    params = [f"{ano:04d}"]
    where, params = filtro_loja_sql(where, params)
    rows = conn.execute(
        f"""
        SELECT substr(data_criacao, 4, 2) AS mes, COUNT(*) AS total
        FROM chamados
        WHERE {where}
        GROUP BY substr(data_criacao, 4, 2)
        ORDER BY mes
        """,
        params
    ).fetchall()
    conn.close()

    totais = {str(row["mes"]): int(row["total"]) for row in rows}
    nomes_meses = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ]

    return jsonify({
        "ok": True,
        "ano": ano,
        "meses": [
            {"mes": i + 1, "label": nomes_meses[i], "total": totais.get(f"{i + 1:02d}", 0)}
            for i in range(12)
        ]
    })


@app.route("/api/chamados/novos", methods=["GET"])
def chamados_novos():
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    ultimo_id = request.args.get("ultimo_id", default=0, type=int)

    conn = get_db()
    where = "id > ?"
    params = [ultimo_id]
    where, params = filtro_loja_sql(where, params)
    rows = conn.execute(
        f"""
        SELECT id, ('CH-' || substr(data_criacao, 7, 4) || '-' || substr(data_criacao, 4, 2) || '-' || printf('%04d', numero_mes)) AS numero, data_criacao, nome, loja, setor, equipamento,
               categoria, prioridade, status, descricao
        FROM chamados
        WHERE {where}
        ORDER BY id ASC
        """,
        params
    ).fetchall()
    conn.close()

    return jsonify({
        "ok": True,
        "chamados": [dict(row) for row in rows]
    })


@app.route("/api/relatorio-mensal.csv", methods=["GET"])
def relatorio_mensal_csv():
    if not admin_required():
        return jsonify({"ok": False, "mensagem": "Acesso não autorizado."}), 401

    mes = str(request.args.get("mes", "")).strip() or datetime.now().strftime("%Y-%m")
    try:
        ano, numero_mes = mes.split("-")
        ano_int = int(ano)
        mes_int = int(numero_mes)
        if len(ano) != 4 or len(numero_mes) != 2 or not 1 <= mes_int <= 12:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"ok": False, "mensagem": "Mês inválido. Use AAAA-MM."}), 400

    where_mes = "substr(data_criacao, 7, 4) = ? AND substr(data_criacao, 4, 2) = ?"
    params = [str(ano_int), f"{mes_int:02d}"]
    filtro_loja = str(request.args.get("loja", "")).strip()
    if not acesso_total():
        # A permissão da sessão sempre vence o parâmetro enviado pela URL.
        filtro_loja = usuario_sessao()["loja"]
        params.append(filtro_loja)
        where_mes += " AND loja = ?"
    elif filtro_loja in {"Matriz", "Filial"}:
        where_mes += " AND loja = ?"
        params.append(filtro_loja)
    else:
        filtro_loja = ""

    conn = get_db()
    chamados = conn.execute(
        f"""
        SELECT ('CH-' || substr(data_criacao, 7, 4) || '-' || substr(data_criacao, 4, 2) || '-' || printf('%04d', numero_mes)) AS numero, data_criacao, nome, loja, setor,
               equipamento, categoria, prioridade, status, descricao, observacao
        FROM chamados
        WHERE {where_mes}
        ORDER BY data_criacao ASC, id ASC
        """, params
    ).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", lineterminator="\n")
    writer.writerow(["RELATÓRIO MENSAL - HELPDESK TI"])
    writer.writerow(["Mês", mes])
    writer.writerow(["Unidade", filtro_loja or "Todas"])
    writer.writerow(["Total de chamados", len(chamados)])
    writer.writerow([])
    writer.writerow([
        "Chamado", "Data", "Usuário", "Unidade", "Setor", "Equipamento",
        "Categoria", "Prioridade", "Status", "Descrição", "Observação"
    ])
    for row in chamados:
        writer.writerow([
            row["numero"], row["data_criacao"], row["nome"], row["loja"], row["setor"],
            row["equipamento"] or "", row["categoria"], row["prioridade"],
            row["status"], row["descricao"], row["observacao"] or ""
        ])

    resposta = make_response(output.getvalue().encode("utf-8-sig"))
    resposta.headers["Content-Type"] = "text/csv; charset=utf-8"
    sufixo_loja = f'_{filtro_loja.lower()}' if filtro_loja else ''
    resposta.headers["Content-Disposition"] = f'attachment; filename="relatorio_helpdesk_{mes}{sufixo_loja}.csv"'
    return resposta


@app.route("/api/relatorio-mensal.pdf", methods=["GET"])
def relatorio_mensal_pdf():
    if not admin_required():
        return jsonify({"ok": False, "mensagem": "Acesso não autorizado."}), 401

    mes = str(request.args.get("mes", "")).strip() or datetime.now().strftime("%Y-%m")
    try:
        ano, numero_mes = mes.split("-")
        ano_int = int(ano)
        mes_int = int(numero_mes)
        if len(ano) != 4 or len(numero_mes) != 2 or not 1 <= mes_int <= 12:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"ok": False, "mensagem": "Mês inválido. Use AAAA-MM."}), 400

    where_mes = "substr(data_criacao, 7, 4) = ? AND substr(data_criacao, 4, 2) = ?"
    params = [str(ano_int), f"{mes_int:02d}"]
    filtro_loja = str(request.args.get("loja", "")).strip()
    if not acesso_total():
        # A permissão da sessão sempre vence o parâmetro enviado pela URL.
        filtro_loja = usuario_sessao()["loja"]
        params.append(filtro_loja)
        where_mes += " AND loja = ?"
    elif filtro_loja in {"Matriz", "Filial"}:
        where_mes += " AND loja = ?"
        params.append(filtro_loja)
    else:
        filtro_loja = ""

    try:
        conn = get_db()
        chamados = conn.execute(
            f"""
            SELECT ('CH-' || substr(data_criacao, 7, 4) || '-' || substr(data_criacao, 4, 2) || '-' || printf('%04d', numero_mes)) AS numero, data_criacao, nome, loja, setor,
                   equipamento, categoria, prioridade, status, descricao, observacao
            FROM chamados
            WHERE {where_mes}
            ORDER BY data_criacao ASC, id ASC
            """, params
        ).fetchall()
        conn.close()

        # Mantemos somente os chamados do mês escolhido no PDF.
        # O texto é normalizado para Latin-1 para evitar erro do Helvetica
        # quando algum chamado contém caracteres Unicode não suportados.
        def pdf_text(value, limit=None):
            text = "" if value is None else str(value)
            if limit:
                text = text[:limit]
            return text.encode("latin-1", "replace").decode("latin-1")

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=24,
            leftMargin=24,
            topMargin=24,
            bottomMargin=24,
            title=f"Relatório Helpdesk {mes}",
            author="Helpdesk TI"
        )

        styles = getSampleStyleSheet()
        titulo = ParagraphStyle(
            "TituloRelatorio",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            spaceAfter=5,
        )
        subtitulo = ParagraphStyle(
            "SubtituloRelatorio",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.HexColor("#475569"),
            spaceAfter=12,
        )

        story = [
            Paragraph("Relatório Mensal — Helpdesk TI", titulo),
            Paragraph(
                f"Mês: {pdf_text(mes)} &nbsp;&nbsp; | &nbsp;&nbsp; Unidade: <b>{pdf_text(filtro_loja or 'Todas')}</b> &nbsp;&nbsp; | &nbsp;&nbsp; Total de chamados: <b>{len(chamados)}</b>",
                subtitulo
            )
        ]

        dados = [[
            "Chamado", "Data", "Usuário", "Unidade", "Setor", "Equipamento",
            "Categoria", "Prioridade", "Status"
        ]]

        for row in chamados:
            dados.append([
                pdf_text(row["numero"]),
                pdf_text(row["data_criacao"]),
                pdf_text(row["nome"], 28),
                pdf_text(row["loja"], 14),
                pdf_text(row["setor"], 20),
                pdf_text(row["equipamento"], 20),
                pdf_text(row["categoria"], 20),
                pdf_text(row["prioridade"], 12),
                pdf_text(row["status"], 18),
            ])

        if len(dados) == 1:
            dados.append(["—", "—", "Nenhum chamado", "—", "—", "—", "—", "—", "—"])

        tabela = Table(
            dados,
            colWidths=[48, 82, 112, 65, 88, 105, 95, 70, 98],
            repeatRows=1,
            hAlign="LEFT"
        )
        tabela.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(tabela)

        doc.build(story)
        pdf_data = buffer.getvalue()
        if not pdf_data.startswith(b"%PDF"):
            raise RuntimeError("O arquivo PDF não foi gerado corretamente.")

        resposta = make_response(pdf_data)
        resposta.headers["Content-Type"] = "application/pdf"
        sufixo_loja = f'_{filtro_loja.lower()}' if filtro_loja else ''
        resposta.headers["Content-Disposition"] = f'attachment; filename="relatorio_helpdesk_{mes}{sufixo_loja}.pdf"'
        resposta.headers["Content-Length"] = str(len(pdf_data))
        return resposta

    except Exception as exc:
        # Retorna a causa real ao JavaScript para facilitar diagnóstico.
        return jsonify({
            "ok": False,
            "mensagem": f"Erro ao gerar PDF: {type(exc).__name__}: {exc}"
        }), 500


@app.route("/api/relatorio-mensal", methods=["GET"])
def relatorio_mensal():
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    mes = str(request.args.get("mes", "")).strip()

    if not mes:
        mes = datetime.now().strftime("%Y-%m")

    try:
        ano, numero_mes = mes.split("-")
        if len(ano) != 4 or len(numero_mes) != 2:
            raise ValueError
        ano_int = int(ano)
        mes_int = int(numero_mes)
        if mes_int < 1 or mes_int > 12:
            raise ValueError
    except ValueError:
        return jsonify({
            "ok": False,
            "mensagem": "Mês inválido. Use o formato AAAA-MM."
        }), 400

    # data_criacao é armazenada como DD/MM/AAAA HH:MM:SS.
    # O SQLite compara o ano/mês usando substrings dessa data.
    conn = get_db()

    where_mes = """
        substr(data_criacao, 7, 4) = ?
        AND substr(data_criacao, 4, 2) = ?
    """
    params = [str(ano_int), f"{mes_int:02d}"]
    filtro_loja = str(request.args.get("loja", "")).strip()
    if not acesso_total():
        filtro_loja = usuario_sessao()["loja"]
        where_mes += " AND loja = ?"
        params.append(filtro_loja)
    elif filtro_loja in {"Matriz", "Filial"}:
        where_mes += " AND loja = ?"
        params.append(filtro_loja)
    else:
        filtro_loja = ""

    total = conn.execute(
        f"SELECT COUNT(*) AS total FROM chamados WHERE {where_mes}",
        params
    ).fetchone()["total"]

    por_status_rows = conn.execute(
        f"""
        SELECT status, COUNT(*) AS total
        FROM chamados
        WHERE {where_mes}
        GROUP BY status
        ORDER BY total DESC
        """,
        params
    ).fetchall()

    por_setor_rows = conn.execute(
        f"""
        SELECT setor, COUNT(*) AS total
        FROM chamados
        WHERE {where_mes}
        GROUP BY setor
        ORDER BY total DESC, setor
        """,
        params
    ).fetchall()

    por_categoria_rows = conn.execute(
        f"""
        SELECT categoria, COUNT(*) AS total
        FROM chamados
        WHERE {where_mes}
        GROUP BY categoria
        ORDER BY total DESC, categoria
        """,
        params
    ).fetchall()

    por_prioridade_rows = conn.execute(
        f"""
        SELECT prioridade, COUNT(*) AS total
        FROM chamados
        WHERE {where_mes}
        GROUP BY prioridade
        ORDER BY total DESC, prioridade
        """,
        params
    ).fetchall()

    chamados_rows = conn.execute(
        f"""
        SELECT ('CH-' || substr(data_criacao, 7, 4) || '-' || substr(data_criacao, 4, 2) || '-' || printf('%04d', numero_mes)) AS numero, data_criacao, nome, loja, setor,
               equipamento, categoria, prioridade, status, descricao, observacao
        FROM chamados
        WHERE {where_mes}
        ORDER BY data_criacao ASC, id ASC
        """, params
    ).fetchall()

    conn.close()

    return jsonify({
        "ok": True,
        "mes": mes,
        "loja": filtro_loja,
        "total": total,
        "chamados": [dict(row) for row in chamados_rows]
    })


@app.route("/api/exportar.csv", methods=["GET"])
def exportar_csv():
    if not admin_required():
        return jsonify({
            "ok": False,
            "mensagem": "Acesso não autorizado."
        }), 401

    conn = get_db()
    where, params = filtro_loja_sql("1=1", [])
    chamados = conn.execute(
        f"SELECT * FROM chamados WHERE {where} ORDER BY id DESC",
        params
    ).fetchall()
    conn.close()

    output = io.StringIO()
    output.write("\ufeff")

    campos = [
        "Chamado", "Nome", "Unidade", "Setor", "Equipamento", "Categoria",
        "Prioridade", "Status", "Data criação", "Data atualização",
        "Descrição", "Observação"
    ]

    writer = csv.writer(output, delimiter=";")
    writer.writerow(campos)

    for chamado in chamados:
        writer.writerow([
            chamado.get("numero") or formatar_numero_chamado(*obter_periodo_chamado(chamado["data_criacao"]), chamado.get("numero_mes") or chamado["id"]),
            chamado["nome"],
            chamado["loja"],
            chamado["setor"],
            chamado["equipamento"],
            chamado["categoria"],
            chamado["prioridade"],
            chamado["status"],
            chamado["data_criacao"],
            chamado["data_atualizacao"],
            chamado["descricao"],
            chamado["observacao"]
        ])

    memoria = io.BytesIO(output.getvalue().encode("utf-8"))
    memoria.seek(0)

    return send_file(
        memoria,
        mimetype="text/csv; charset=utf-8",
        as_attachment=True,
        download_name="helpdesk_chamados.csv"
    )


if __name__ == "__main__":
    init_db()
    print("")
    print("======================================")
    print("        HELPDESK TI - SERVIDOR")
    print("======================================")
    print("Acesso local: http://127.0.0.1:5000")
    print("Acesso na rede: http://IP-DO-PC-TI:5000")
    print("Usuário TI:", ADMIN_USER)
    print("======================================")
    print("")
    app.run(host="0.0.0.0", port=5000, debug=False)
