"""Solicitação de Itens Novos - LAN/SQLite, módulo isolado, acesso por perfil."""
import secrets, hashlib, hmac, json, re, datetime
import psycopg
from psycopg.rows import dict_row
import pg_db

from pathlib import Path
# O banco unico e rildon_gestao (PostgreSQL).
SESSIONS={}
SELLERS={'DUDU':'Dudu','CARLOS EDUARDO':'Dudu','CARLOS RAFAEL':'Carlos Rafael','CLAUDISTON':'Claudiston','ELIS ANTHONNY':'Elis Anthonny','GISLEI':'Gislei','HALISON':'Halison','IRAN':'Iran','ISAIAS':'Isaias','LUANA':'Luana','NETE':'Valdinete','VALDINETE':'Valdinete','FERNANDO':'Fernando'}

def connect():
 return psycopg.connect(**pg_db.configure(),row_factory=dict_row)

def init():
 with connect() as c:
  c.execute('CREATE TABLE IF NOT EXISTS sol_users(username TEXT PRIMARY KEY,role TEXT NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1)')
  c.execute('CREATE TABLE IF NOT EXISTS rildon_requesters(id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name TEXT NOT NULL UNIQUE)')
  for user,role in [('COMPRAS','compras'),('GERENCIA','gerencia')]+[(name,'vendedor') for name in SELLERS]:
   if not c.execute('SELECT 1 FROM sol_users WHERE username=%s',(user,)).fetchone():create_user(c,user,role,'12345')
  for name in ('Aldimar','Djalma'):
   c.execute('INSERT INTO rildon_buyers(name) VALUES(%s) ON CONFLICT (name) DO NOTHING',(name,))
  for name in set(SELLERS.values()):
   c.execute('INSERT INTO rildon_requesters(name) VALUES(%s) ON CONFLICT (name) DO NOTHING',(name,))

def create_user(c,name,role,password):
 salt=secrets.token_hex(16);pw=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),200000).hex()
 c.execute('INSERT INTO sol_users(username,role,salt,hash) VALUES(%s,%s,%s,%s) ON CONFLICT(username) DO UPDATE SET role=EXCLUDED.role,salt=EXCLUDED.salt,hash=EXCLUDED.hash',(name,role,salt,pw))

def login(username,password):
 username=str(username or '').strip().upper()
 with connect() as c:r=c.execute('SELECT * FROM sol_users WHERE username=%s AND enabled=1',(username,)).fetchone()
 if not r:return None
 expected=hashlib.pbkdf2_hmac('sha256',str(password).encode(),bytes.fromhex(r['salt']),200000).hex()
 if not hmac.compare_digest(expected,r['hash']):return None
 token=secrets.token_urlsafe(32);SESSIONS[token]={'username':username,'role':r['role']}
 return {'token':token,'role':r['role'],'user':username}

def who(h):
 tok=h.headers.get('Authorization','').removeprefix('Bearer ').strip()
 return SESSIONS.get(tok)

def read_body(h):
 size=int(h.headers.get('Content-Length','0'))
 if size<=0 or size>100000:raise ValueError('Dados inválidos ou muito grandes')
 return json.loads(h.rfile.read(size).decode('utf-8'))

def _date(x):return x.isoformat() if hasattr(x,'isoformat') else (str(x) if x else '')
def _quantity(x):
 try:return int(float(str(x).replace(',','.')))
 except (ValueError,TypeError):return 0

def _row(r):
 return {'id':r['id'],'date_request':_date(r['requested_on']),'requester':r['requester'],
 'reference':r['reference'],'part':r['part'],'quantity':_quantity(r['quantity_text']),
 'supplier':r['supplier'] or '', 'seller_note':r['seller_note'],'status':r['status'],
 'response_date':_date(r['responded_on']),'answered_by':r['answered_by'],
 'arrival_date':r['arrival_text'],'purchase_note':r['purchase_note'],'created_by':r['requester'],
 'source_file':r['source_file'] or ''}

def get(h,path):
 user=who(h)
 if not user:return h.reply(401,{'error':'Faça login'})
 try:
  with connect() as c:
   if path.endswith('/initial'):
    result={}
    for k,table in [('suppliers','rildon_suppliers'),('buyers','rildon_buyers'),('requesters','rildon_requesters')]:
     result[k]=[dict(r) for r in c.execute('SELECT id,name FROM '+table+(' WHERE active=TRUE' if table=='rildon_suppliers' else '')+' ORDER BY lower(name)')]
    return h.reply(200,{'ok':True,**result,'role':user['role'],'user':user['username'],'storage':'POSTGRESQL'})
   if path.endswith('/rows'):
    query='''SELECT r.*,s.name AS supplier FROM rildon_requests r
      LEFT JOIN rildon_suppliers s ON s.id=r.supplier_id'''
    params=()
    if user['role']=='vendedor':
     allowed={user['username'],SELLERS.get(user['username'],user['username'])}
     if user['username']=='DUDU':allowed.update(('Carlos Eduardo','Carlos Eduardo (Dudu)'))
     if user['username'] in ('NETE','VALDINETE'):allowed.update(('Nete','Valdinete'))
     query+=' WHERE upper(r.requester)=ANY(%s)';params=([x.upper() for x in allowed],)
    query+=' ORDER BY r.requested_on DESC NULLS LAST,r.id DESC LIMIT 10000'
    rows=[_row(r) for r in c.execute(query,params)]
    return h.reply(200,{'ok':True,'rows':rows,'storage':'POSTGRESQL'})
  return h.reply(404,{'error':'Rota inexistente'})
 except Exception as e:return h.reply(500,{'error':str(e)[:150]})

def post(h,path):
 try:
  body=read_body(h)
  if path.endswith('/login'):
   session=login(body.get('user'),body.get('password'))
   return h.reply(200,{'ok':True,**session}) if session else h.reply(403,{'error':'Credenciais inválidas'})
  user=who(h)
  if not user:return h.reply(401,{'error':'Faça login'})
  role=user['role']
  if path.endswith('/password'):
   if role!='compras':return h.reply(403,{'error':'Apenas Compras pode alterar esta senha'})
   old=str(body.get('current_password',''));new=str(body.get('new_password',''))
   if len(new)<8 or len(new)>128:raise ValueError('A nova senha deve ter pelo menos 8 caracteres')
   with connect() as c:
    record=c.execute('SELECT salt,hash FROM sol_users WHERE username=%s',(user['username'],)).fetchone()
    if not record:raise ValueError('Usuário não encontrado')
    hashed=hashlib.pbkdf2_hmac('sha256',old.encode(),bytes.fromhex(record['salt']),200000).hex()
    if not hmac.compare_digest(hashed,record['hash']):return h.reply(403,{'error':'Senha atual incorreta'})
    salt=secrets.token_hex(16);digest=hashlib.pbkdf2_hmac('sha256',new.encode(),bytes.fromhex(salt),200000).hex()
    c.execute('UPDATE sol_users SET salt=%s,hash=%s WHERE username=%s',(salt,digest,user['username']))
   return h.reply(200,{'ok':True})
  if path.endswith('/create'):
   if role!='vendedor':return h.reply(403,{'error':'Somente vendedores podem criar solicitações'})
   date=str(body.get('date') or datetime.date.today().isoformat());datetime.date.fromisoformat(date)
   requester=SELLERS.get(user['username'],user['username'])
   ref=str(body.get('reference','')).strip()[:120];part=str(body.get('part','')).strip()[:250]
   supplier=str(body.get('supplier','')).strip()[:120];note=str(body.get('note','')).strip()[:1500]
   qty=int(body.get('quantity',0))
   if not (ref and part and supplier and 0<qty<=100000):raise ValueError('Preencha referência, peça, quantidade e fabricante')
   with connect() as c:
    result=c.execute('SELECT id FROM rildon_suppliers WHERE lower(name)=lower(%s)',(supplier,)).fetchone()
    if not result:raise ValueError('Fabricante não cadastrado')
    c.execute('''INSERT INTO rildon_requests(requested_on,requester,reference,part,quantity_text,supplier_id,seller_note,source_type)
     VALUES(%s,%s,%s,%s,%s,%s,%s,'sistema_rildon')''',(date,requester,ref,part,str(qty),result['id'],note))
   return h.reply(200,{'ok':True,'storage':'POSTGRESQL'})
  if path.endswith('/respond'):
   if role!='compras':return h.reply(403,{'error':'Somente Compras pode responder'})
   rid=int(body['id']);status=str(body.get('status','')).strip()
   if status not in ('Pendente','Atendido','Não Atendido'):raise ValueError('Status inválido')
   by=str(body.get('answered_by','')).strip()[:120]
   with connect() as check_db:
    if not check_db.execute('SELECT 1 FROM rildon_buyers WHERE lower(name)=lower(%s)',(by,)).fetchone():raise ValueError('Selecione um comprador cadastrado')
   arrival=str(body.get('arrival_date','')).strip()
   if arrival:datetime.date.fromisoformat(arrival)
   note=str(body.get('purchase_note','')).strip()[:1500]
   with connect() as c:
    cur=c.execute('''UPDATE rildon_requests SET status=%s,responded_on=CURRENT_DATE,answered_by=%s,
      arrival_text=%s,purchase_note=%s,updated_at=NOW() WHERE id=%s''',(status,by,arrival,note,rid))
    if not cur.rowcount:return h.reply(404,{'error':'Solicitação não encontrada'})
   return h.reply(200,{'ok':True,'storage':'POSTGRESQL'})
  if path.endswith('/catalog'):
   if role!='compras':return h.reply(403,{'error':'Acesso somente Compras'})
   table={'suppliers':'rildon_suppliers','buyers':'rildon_buyers','requesters':'rildon_requesters'}.get(body.get('category'))
   if not table:raise ValueError('Categoria inválida')
   with connect() as c:
    if body.get('action')=='delete':
     if table=='rildon_suppliers':
      # Retain historic references; hide a supplier instead of cascading deletes.
      c.execute('UPDATE rildon_suppliers SET active=FALSE WHERE id=%s',(int(body['id']),))
     else:c.execute('DELETE FROM '+table+' WHERE id=%s',(int(body['id']),))
    elif body.get('action','add')=='add':
     name=str(body.get('name','')).strip()[:120]
     if not name:raise ValueError('Nome obrigatório')
     if table=='rildon_suppliers':
      c.execute('INSERT INTO rildon_suppliers(name) VALUES(%s) ON CONFLICT(name) DO UPDATE SET active=TRUE',(name,))
     else:c.execute('INSERT INTO '+table+'(name) VALUES(%s)',(name,))
    elif body.get('action')=='rename' and table=='rildon_buyers':
     name=str(body.get('name','')).strip()[:120]
     if not name:raise ValueError('Nome obrigatório')
     c.execute('UPDATE rildon_buyers SET name=%s WHERE id=%s',(name,int(body['id'])))
    else:raise ValueError('Ação inválida')
   return h.reply(200,{'ok':True,'storage':'POSTGRESQL'})
  return h.reply(404,{'error':'Rota inexistente'})
 except (ValueError,psycopg.IntegrityError,KeyError) as e:return h.reply(400,{'error':str(e)[:250]})
 except Exception as e:return h.reply(500,{'error':str(e)[:250]})
