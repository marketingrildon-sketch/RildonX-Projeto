import pg_db as db, json, re, io, os, hashlib, hmac, secrets, datetime, shutil
from pathlib import Path
BASE=Path(__file__).resolve().parent
# Dados operacionais armazenados no PostgreSQL central.
SELLERS={'dudu':'CARLOS EDUARDO ROBERTO DOS SANTOS','claudiston':'CLAUDISTON SANTOS DA SILVA','halison':'HALISON MATIAS APOLINÁRIO','luana':'LUANA ANDRADE DOS ANJOS','nete':'VALDINETE GARCIA MONTEIRO','gislei':'GISLEI CEZARIO DA SILVA','isaias':'ISAIAS DE JESUS ANDRADE','carlos rafael':'CARLOS RAFAEL DA SILVA PIMENTEL','elis anthonny':'ELIS ANTHONNY','iran':'IRAN COUTO GALVÃO','fernando':'FERNANDO'}
# Equivalências específicas do cadastro X2. O nome canônico é único; a loja é independente.
CANONICAL_NAMES = {
 'CARLOS EDUARDO':'CARLOS EDUARDO ROBERTO DOS SANTOS',
 'CARLOS RAFAEL':'CARLOS RAFAEL DA SILVA PIMENTEL',
 'CLAUDISTON':'CLAUDISTON SANTOS DA SILVA',
 'ELIS ANTHONNY':'ELIS ANTHONNY',
 'GISLEI':'GISLEI CEZARIO DA SILVA',
 'HALISON':'HALISON MATIAS APOLINÁRIO',
 'IRAN':'IRAN COUTO GALVÃO',
 'ISAIAS':'ISAIAS DE JESUS ANDRADE',
 'LUANA':'LUANA ANDRADE DOS ANJOS',
 'VALDINETE':'VALDINETE GARCIA MONTEIRO',
}
OFFICIAL_SELLERS = [
 'CARLOS EDUARDO ROBERTO DOS SANTOS','CARLOS RAFAEL DA SILVA PIMENTEL',
 'CLAUDISTON SANTOS DA SILVA','ELIS ANTHONNY','GISLEI CEZARIO DA SILVA',
 'HALISON MATIAS APOLINÁRIO','IRAN COUTO GALVÃO','ISAIAS DE JESUS ANDRADE',
 'LUANA ANDRADE DOS ANJOS','VALDINETE GARCIA MONTEIRO'
]

def canonical_seller_branch(seller, branch):
 import unicodedata
 name=' '.join(str(seller or '').upper().strip().split())
 branch=str(branch or '').upper().strip()
 def fold(v):
  return ''.join(ch for ch in unicodedata.normalize('NFD',v) if unicodedata.category(ch)!='Mn')
 original=fold(name)
 # Vendas internas é um grupo independente do quadro oficial.
 if original.startswith('VENDAS INTERNAS') or branch in ('INTERNAS','VENDAS INTERNAS'):
  return 'VENDAS INTERNAS','Internas'
 # Prioridade de origem: B2B primeiro, depois DIST, depois Matriz.
 kind=('B2B' if re.search(r'\bB2B\b', original+' '+branch) else
       'DIST' if re.search(r'\bDIST\b', original+' '+branch) else 'Matriz')
 if original=='ISAIAS DE JESUS ANDRADE ISAIAS':kind='DIST'
 if original=='LUANA DIST.':kind='DIST'
 cleaned=re.sub(r'\s*[-(]*\s*(?:DIST\.?|B2B|EXTERNO)\s*\)?\s*$','',original).strip(' -().')
 if cleaned=='ISAIAS DE JESUS ANDRADE ISAIAS':cleaned='ISAIAS DE JESUS ANDRADE'
 prefixes={
  'CARLOS EDUARDO':'CARLOS EDUARDO ROBERTO DOS SANTOS',
  'DUDU':'CARLOS EDUARDO ROBERTO DOS SANTOS',
  'CARLOS RAFAEL':'CARLOS RAFAEL DA SILVA PIMENTEL',
  'CLAUDISTON':'CLAUDISTON SANTOS DA SILVA',
  'ELIS ANTHONNY':'ELIS ANTHONNY',
  'GISLEI':'GISLEI CEZARIO DA SILVA',
  'HALISON':'HALISON MATIAS APOLINÁRIO',
  'IRAN':'IRAN COUTO GALVÃO',
  'ISAIAS':'ISAIAS DE JESUS ANDRADE',
  'LUANA':'LUANA ANDRADE DOS ANJOS',
  'VALDINETE':'VALDINETE GARCIA MONTEIRO',
  'NETE':'VALDINETE GARCIA MONTEIRO',
 }
 for prefix,canonical in prefixes.items():
  if cleaned==prefix or cleaned.startswith(prefix+' '):return canonical,kind
 # Preserva grupos fora do quadro oficial no histórico para auditoria;
 # não os atribui automaticamente a um dos dez vendedores.
 return name,kind

def migrate_attendance_aliases(c):
 records=c.execute('SELECT day,seller,branch,client,value_cents FROM attendances').fetchall()
 for day,old,branch,client,value in records:
  new,kind=canonical_seller_branch(old,branch)
  if (new,kind)==(old,branch):continue
  existing=c.execute('SELECT value_cents FROM attendances WHERE day=? AND seller=? AND branch=? AND client=?',(day,new,kind,client)).fetchone()
  if existing is not None and existing[0]!=value:
   raise ValueError('Conflito na migração de '+old+'; faça backup e revise os registros.')
  c.execute('INSERT OR IGNORE INTO attendances VALUES(?,?,?,?,?)',(day,new,kind,client,value))
  c.execute('DELETE FROM attendances WHERE day=? AND seller=? AND branch=? AND client=?',(day,old,branch,client))

TOKENS={}
def init():
 with db.connect() as c:
  c.execute('CREATE TABLE IF NOT EXISTS attendances(day TEXT, seller TEXT, branch TEXT, client TEXT, value_cents INTEGER, PRIMARY KEY(day,seller,branch,client))')
  c.execute('CREATE TABLE IF NOT EXISTS attendance_periods (start_day TEXT, end_day TEXT, PRIMARY KEY(start_day,end_day))')
  c.execute('CREATE TABLE IF NOT EXISTS attendance_group_totals (start_day TEXT, end_day TEXT, seller TEXT, branch TEXT, gross_cents INTEGER NOT NULL, refund_cents INTEGER NOT NULL, net_cents INTEGER NOT NULL, PRIMARY KEY(start_day,end_day,seller,branch))')
  c.execute('CREATE TABLE IF NOT EXISTS attendance_report_totals (start_day TEXT, end_day TEXT, gross_cents INTEGER NOT NULL, refund_cents INTEGER NOT NULL, net_cents INTEGER NOT NULL, rounding_delta_cents INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(start_day,end_day))')
  c.execute('CREATE TABLE IF NOT EXISTS attendance_users(username TEXT PRIMARY KEY, seller TEXT, salt TEXT, hash TEXT, admin INTEGER)')
  c.execute('CREATE TABLE IF NOT EXISTS attendance_entries_v57 (report_start TEXT, report_end TEXT, sale_day TEXT, seller TEXT, branch TEXT, client TEXT, value_cents INTEGER NOT NULL, PRIMARY KEY(report_start,report_end,sale_day,seller,branch,client))')
  c.execute('CREATE TABLE IF NOT EXISTS attendance_migrations (key TEXT PRIMARY KEY)')
  migrate_attendance_aliases(c)
  if not c.execute("SELECT 1 FROM attendance_migrations WHERE key='v57_entries'").fetchone():
   periods=dict(c.execute('SELECT start_day,end_day FROM attendance_periods').fetchall())
   for old_day,seller,branch,client,value in c.execute('SELECT day,seller,branch,client,value_cents FROM attendances').fetchall():
    end=periods.get(old_day,old_day)
    c.execute('INSERT OR REPLACE INTO attendance_entries_v57 VALUES(?,?,?,?,?,?,?)',(old_day,end,old_day if end==old_day else '',seller,branch,client,value))
   c.execute("INSERT INTO attendance_migrations VALUES('v57_entries')")
  if not c.execute("SELECT 1 FROM attendance_users WHERE username='gerencia'").fetchone():
   create_user(c,'gerencia','','12345',1)
def create_user(c,u,s,p,a=0):
 salt=secrets.token_hex(16); hv=hashlib.pbkdf2_hmac('sha256',p.encode(),bytes.fromhex(salt),200000).hex()
 c.execute('INSERT OR REPLACE INTO attendance_users VALUES(?,?,?,?,?)',(u,s,salt,hv,a))
def ensure_seller_users():
 with db.connect() as c:
  # Usuarios iniciais, sem redefinicao automatica de senhas existentes.
  # Alteracoes futuras de senha permanecem intactas em reinicializacoes.
  c.execute('CREATE TABLE IF NOT EXISTS attendance_config (key TEXT PRIMARY KEY, value TEXT)')
  for username,seller in SELLERS.items():
   if not c.execute('SELECT 1 FROM attendance_users WHERE username=?',(username,)).fetchone():
    create_user(c,username,seller,'12345')

def auth(handler):
 tok=handler.headers.get('Authorization','').removeprefix('Bearer ').strip(); return TOKENS.get(tok)
def respond(h,status,obj):h.reply(status,obj)
def post(h,path):
 n=int(h.headers.get('Content-Length','0'))
 if n<1 or n>18_000_000:return respond(h,413,{'error':'Arquivo muito grande'})
 raw=h.rfile.read(n)
 if path=='/api/attendance/login':
  try:
   d=json.loads(raw); u=d['user'].strip().lower(); p=d['password']; u={'nete':'nete','valdinete':'nete','carlos eduardo':'dudu'}.get(u,u)
   with db.connect() as c:r=c.execute('SELECT seller,salt,hash,admin FROM attendance_users WHERE username=?',(u,)).fetchone()
   if not r or not hmac.compare_digest(hashlib.pbkdf2_hmac('sha256',p.encode(),bytes.fromhex(r[1]),200000).hex(),r[2]):return respond(h,401,{'error':'Credenciais inválidas'})
   token=secrets.token_urlsafe(32);TOKENS[token]={'user':u,'seller':r[0],'admin':bool(r[3])};return respond(h,200,{'token':token,'admin':bool(r[3]),'seller':r[0]})
  except Exception:return respond(h,400,{'error':'Dados inválidos'})
 user=auth(h)
 if not user:return respond(h,401,{'error':'Faça login'})
 if path=='/api/attendance/change-password':
  try:
   d=json.loads(raw); old=d['old']; new=d['new']
   if len(new)<8:return respond(h,400,{'error':'A nova senha deve ter pelo menos 8 caracteres'})
   with db.connect() as c:
    r=c.execute('SELECT salt,hash FROM attendance_users WHERE username=?',(user['user'],)).fetchone()
    if not r or not hmac.compare_digest(hashlib.pbkdf2_hmac('sha256',old.encode(),bytes.fromhex(r[0]),200000).hex(),r[1]):return respond(h,403,{'error':'Senha atual incorreta'})
    create_user(c,user['user'],user['seller'],new,int(user['admin']))
   for k,v in list(TOKENS.items()):
    if v['user']==user['user']:TOKENS.pop(k,None)
   return respond(h,200,{'ok':True})
  except Exception:return respond(h,400,{'error':'Não foi possível alterar a senha'})
 if path=='/api/attendance/import':
  if not user['admin']:return respond(h,403,{'error':'Apenas gerência'})
  try:
   if len(raw)>12_000_000:return respond(h,413,{'error':'HTML muito grande (limite de 12 MB)'})
   rows,day,end_day,totals=parse_html_report(raw)
   return respond(h,200,{'day':day,'end_day':end_day,'rows':rows,'count':len(rows),'totals':totals,'warning':'PRÉVIA NÃO SALVA. O painel só será atualizado após clicar em Confirmar importação.'})
  except Exception as e:return respond(h,422,{'error':'Não foi possível interpretar o HTML: '+str(e)[:220]})
 if path=='/api/attendance/confirm':
  if not user['admin']:return respond(h,403,{'error':'Apenas gerência'})
  try:
   from collections import defaultdict
   data=json.loads(raw); day=data['day'];end_day=data.get('end_day',day)
   datetime.date.fromisoformat(day);datetime.date.fromisoformat(end_day)
   if day>end_day:raise ValueError('Período inválido')
   rows=data['rows']
   if not isinstance(rows,list) or not 0<len(rows)<20000:raise ValueError('Lista de registros inválida')
   group_totals=data.get('group_totals')
   if not isinstance(group_totals,list) or not group_totals:raise ValueError('Recarregue o HTML para importar as devoluções.')
   clean=[];grouped=defaultdict(int)
   for r in rows:
    seller,branch=canonical_seller_branch(str(r['seller'])[:120],str(r['branch'])[:24])
    client=str(r['client']).strip()[:250];value=int(r['value_cents'])
    sale_day=str(r.get('sale_day') or '')
    if sale_day:
     datetime.date.fromisoformat(sale_day)
     if not day<=sale_day<=end_day:raise ValueError('Data da venda fora do período: '+sale_day)
    if not seller or not client or branch not in ('Matriz','DIST','B2B','Internas') or not 0<=value<=1000000000:
     raise ValueError('Registro inválido em '+seller)
    clean.append((day,end_day,sale_day,seller,branch,client,value))
    grouped[(seller,branch)]+=value
   confirmed={}
   for g in group_totals:
    seller,branch=canonical_seller_branch(str(g['seller']),str(g['branch']))
    gross=int(g['gross_cents']);refund=int(g['refund_cents']);net=int(g['net_cents'])
    if gross<0 or refund<0 or gross-refund!=net or max(gross,refund,abs(net))>10**11:
     raise ValueError('Total ou devolução inválido')
    key=(seller,branch)
    if key in confirmed:raise ValueError('Resumo financeiro duplicado: '+seller+' / '+branch)
    confirmed[key]=(gross,refund,net)
   if not set(grouped).issubset(confirmed) or any(grouped.get(k,0)!=v[0] for k,v in confirmed.items()):
    raise ValueError('Valores dos clientes não conferem com os totais do X2; reabra o HTML.')
   # O rodapé GERAL do X2 é a fonte do total líquido. Centavos de arredondamento
   # entre a soma dos rodapés individuais e o consolidado são auditados, não
   # atribuídos artificialmente a um vendedor ou cliente.
   report_totals=data.get('report_totals')
   if not isinstance(report_totals,dict):raise ValueError('Recarregue o HTML para conferir o TOTAL GERAL do X2.')
   official_gross=int(report_totals['gross_cents'])
   official_refund=int(report_totals['refund_cents'])
   official_net=official_gross-official_refund
   group_gross=sum(v[0] for v in confirmed.values())
   group_refund=sum(v[1] for v in confirmed.values())
   rounding_delta=official_refund-group_refund
   if official_gross!=group_gross:raise ValueError('TOTAL GERAL vendido não confere com os grupos do X2')
   if abs(rounding_delta)>2:raise ValueError('Devoluções não conferem; diferença de '+str(rounding_delta)+' centavos, superior à tolerância de arredondamento')
   if abs(int(report_totals.get('net_cents',official_net))-official_net)>2:
    raise ValueError('Total líquido do X2 diverge de vendido menos devolvido')
   consolidated=defaultdict(int)
   legacy=defaultdict(int)
   for start,end,sale,seller,branch,client,value in clean:
    consolidated[(start,end,sale,seller,branch,client)]+=value
    legacy[(start,seller,branch,client)]+=value
   with db.connect() as c:
    # Impede duplicidade de relatórios sobrepostos, preservando relatórios parcialmente externos.
    periods=c.execute('SELECT start_day,end_day FROM attendance_periods WHERE start_day<=? AND end_day>=?',(end_day,day)).fetchall()
    if periods and not data.get('replace_overlaps'):
     raise ValueError('Período sobreposto; confirme a substituição dos dados anteriores.')
    if any(start<day or end>end_day for start,end in periods):
     raise ValueError('Há relatório parcialmente sobreposto ou maior. Importe um período que o cubra integralmente.')
    c.execute('DELETE FROM attendance_entries_v57 WHERE report_start>=? AND report_end<=?',(day,end_day))
    c.execute('DELETE FROM attendances WHERE day>=? AND day<=?',(day,end_day))
    c.execute('DELETE FROM attendance_periods WHERE start_day>=? AND end_day<=?',(day,end_day))
    c.execute('DELETE FROM attendance_group_totals WHERE start_day>=? AND end_day<=?',(day,end_day))
    c.execute('DELETE FROM attendance_report_totals WHERE start_day>=? AND end_day<=?',(day,end_day))
    c.executemany('INSERT INTO attendance_entries_v57 VALUES(?,?,?,?,?,?,?)',[(*key,value) for key,value in consolidated.items()])
    # Tabela legada agregada apenas para permitir regressão à versão anterior.
    c.executemany('INSERT INTO attendances VALUES(?,?,?,?,?)',[(*key,value) for key,value in legacy.items()])
    c.executemany('INSERT INTO attendance_group_totals VALUES(?,?,?,?,?,?,?)',[(day,end_day,seller,branch,*values) for (seller,branch),values in confirmed.items()])
    c.execute('INSERT INTO attendance_report_totals VALUES(?,?,?,?,?,?)',(day,end_day,official_gross,official_refund,official_net,rounding_delta))
    c.execute('INSERT INTO attendance_periods VALUES(?,?)',(day,end_day))
   return respond(h,200,{'ok':True,'saved':len(consolidated),'gross_cents':official_gross,'refund_cents':official_refund,'net_cents':official_net,'rounding_delta_cents':rounding_delta})
  except Exception as e:return respond(h,400,{'error':'Dados inválidos: '+str(e)[:170]})
 if path=='/api/attendance/user':
  if not user['admin']:return respond(h,403,{'error':'Apenas gerência'})
  try:
   d=json.loads(raw); u=d['user'].strip().lower();seller=d['seller'];pw=d['password'];assert u in SELLERS and seller==SELLERS[u] and len(pw)>=8
   with db.connect() as c:create_user(c,u,seller,pw)
   return respond(h,200,{'ok':True})
  except Exception:return respond(h,400,{'error':'Usuário inválido ou senha com menos de 8 caracteres'})
 return respond(h,404,{'error':'Não encontrado'})
def get(h,path):
 user=auth(h)
 if not user:return respond(h,401,{'error':'Faça login'})
 if path=='/api/attendance/rows':
  with db.connect() as c:
   if user['admin']:
    rows=c.execute('SELECT report_start,report_end,sale_day,seller,branch,client,value_cents FROM attendance_entries_v57 ORDER BY report_start DESC,seller,client LIMIT 30000').fetchall()
    groups=c.execute('SELECT start_day,end_day,seller,branch,gross_cents,refund_cents,net_cents FROM attendance_group_totals').fetchall()
    reports=c.execute('SELECT start_day,end_day,gross_cents,refund_cents,net_cents,rounding_delta_cents FROM attendance_report_totals').fetchall()
   else:
    rows=c.execute('SELECT report_start,report_end,sale_day,seller,branch,client,value_cents FROM attendance_entries_v57 WHERE seller=? ORDER BY report_start DESC,client LIMIT 30000',(user['seller'],)).fetchall()
    groups=c.execute('SELECT start_day,end_day,seller,branch,gross_cents,refund_cents,net_cents FROM attendance_group_totals WHERE seller=?',(user['seller'],)).fetchall()
    reports=[]  # Vendedor não recebe totais de outros vendedores.
  result=[dict(zip(('day','end_day','sale_day','seller','branch','client','value_cents'),r)) for r in rows]
  summaries=[dict(zip(('day','end_day','seller','branch','gross_cents','refund_cents','net_cents'),g)) for g in groups]
  full_reports=[dict(zip(('day','end_day','gross_cents','refund_cents','net_cents','rounding_delta_cents'),g)) for g in reports]
  return respond(h,200,{'rows':result,'group_totals':summaries,'report_totals':full_reports,'admin':user['admin']})
 return respond(h,404,{'error':'Não encontrado'})
def parse(text):
 m=re.search(r'(?:per[ií]odo de|periodo de)\s*(\d\d/\d\d/\d{4})',text,re.I)
 if not m:raise ValueError('Data não identificada no cabeçalho')
 day=datetime.datetime.strptime(m.group(1),'%d/%m/%Y').date().isoformat()
 seller=None;branch='Matriz';rows=[]
 for line in text.splitlines():
  line=line.strip()
  sm=re.search(r'VENDEDOR\s*:\s*(.+)',line,re.I)
  if sm:
   seller=sm.group(1).strip();seller,branch=canonical_seller_branch(seller,'Matriz');continue
  if not seller or re.search(r'\bTOTAL\b|CLIENTE\s+VALOR|VALOR L[IÍ]QUIDO',line,re.I):continue
  match=re.search(r'^(.*?)\s+R\$\s*([\d.]+,\d{2})\s*$',line,re.I)
  if match:
   name=match.group(1).strip();val=int(match.group(2).replace('.','').replace(',',''))
   if len(name)>2:rows.append({'seller':seller,'branch':branch,'client':name,'value_cents':val})
 return rows,day


class _X2TableParser(__import__('html.parser',fromlist=['HTMLParser']).HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.tables=[];self.table_depth=0;self.rows=[];self.cells=[];self.cell=None;self.text=[]
 def handle_starttag(self,tag,attrs):
  if tag=='table':
   if self.table_depth==0:self.rows=[]
   self.table_depth+=1
  elif self.table_depth==1 and tag=='tr':self.cells=[]
  elif self.table_depth==1 and tag in ('td','th'):self.cell=[]
 def handle_data(self,data):
  self.text.append(data)
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if self.table_depth==1 and tag in ('td','th') and self.cell is not None:
   self.cells.append(' '.join(''.join(self.cell).split()));self.cell=None
  elif self.table_depth==1 and tag=='tr':
   if self.cells:self.rows.append(self.cells)
  elif tag=='table' and self.table_depth:
   self.table_depth-=1
   if self.table_depth==0:self.tables.append(self.rows)

def parse_html_report(raw):
 """Extrai grupos e datas do relatório HTML X2.

 Conserva três conferências independentes: linhas versus grupo, grupo
 versus líquido, e soma de TODOS os grupos versus TOTAL GERAL do X2.
 Relatórios com uma estrutura nova não são salvos com valores parciais.
 """
 from collections import defaultdict
 import unicodedata
 if b'<table' not in raw.lower() or b'VENDEDOR' not in raw.upper():
  raise ValueError('Arquivo não parece ser o relatório HTML de vendas do X2')
 try: html_text=raw.decode('utf-8-sig')
 except UnicodeDecodeError: html_text=raw.decode('cp1252')
 p=_X2TableParser();p.feed(html_text)
 header=' '.join(p.text[:180])
 dates=re.search(r'Produtos vendidos no per[ií]odo de\s*(\d{2}/\d{2}/\d{4})\s*a\s*(\d{2}/\d{2}/\d{4})',header,re.I)
 if not dates:raise ValueError('Período do relatório não identificado')
 start=datetime.datetime.strptime(dates.group(1),'%d/%m/%Y').date().isoformat()
 end=datetime.datetime.strptime(dates.group(2),'%d/%m/%Y').date().isoformat()
 if start>end:raise ValueError('Período inválido')
 def fold(x):
  return ''.join(ch for ch in unicodedata.normalize('NFD',str(x).upper()) if unicodedata.category(ch)!='Mn')
 def cents(x):
  m=re.fullmatch(r'R\$\s*([\d.]+,\d{2})',str(x).strip())
  return int(m.group(1).replace('.','').replace(',','')) if m else None
 def brmoney(n):
  sign='-' if n<0 else ''
  val=abs(n)
  return sign+'R$ '+format(val//100,',').replace(',','.')+','+f'{val%100:02}'
 def sale_date(x):
  m=re.search(r'(?<!\d)(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})(?!\d)',str(x))
  if not m:return ''
  val=m.group(1)
  return datetime.datetime.strptime(val,'%d/%m/%Y').date().isoformat() if '/' in val else datetime.date.fromisoformat(val).isoformat()
 def heading_name(cells):
  for i,v in enumerate(cells):
   m=re.match(r'^VENDEDOR\s*:\s*(.*)$',str(v).strip(),re.I)
   if m:
    name=m.group(1).strip()
    if not name and i+1<len(cells):name=str(cells[i+1]).strip()
    return name
  return None
 seller=None;branch='Matriz';rows=[];groups=defaultdict(lambda:{'gross':0,'refund':0,'net':0});daily=0
 section_seen=[];section_processed=set();unparsed=[]
 group_warnings=[]
 for index,table in enumerate(p.tables):
  if not table:continue
  # O X2 pode colocar o nome do vendedor junto a mais linhas na mesma tabela.
  named=next((heading_name(cells) for cells in table[:5] if heading_name(cells) is not None),None)
  if named:
   seller,branch=canonical_seller_branch(named,'Matriz')
   section_seen.append((seller,branch))
  # Encontra o verdadeiro cabeçalho: pode haver linhas adicionais acima dele.
  header_idx=None;client_idx=None;value_idx=None;date_idx=None
  for hi,cells in enumerate(table[:9]):
   cols=[fold(x).strip() for x in cells]
   ci=next((i for i,x in enumerate(cols) if x=='CLIENTE' or x.startswith('CLIENTE ') or x in ('NOME DO CLIENTE','RAZAO SOCIAL')),None)
   vi=next((i for i,x in enumerate(cols) if 'VALOR LIQUIDO' in x or ('VALOR' in x and 'SUBST' in x) or x in ('VALOR DA VENDA','VALOR VENDIDO','VALOR (R$)')),None)
   if ci is not None and vi is not None:
    header_idx,client_idx,value_idx=hi,ci,vi
    date_idx=next((i for i,x in enumerate(cols) if x in ('DATA','DATA DA VENDA','DATA VENDA','DT VENDA','DT. VENDA','DATA DO PEDIDO','DATA PEDIDO','DT. PEDIDO')),None)
    break
  if header_idx is None:
   # X2: 'Devoluções onde não houve vendas no período' vem em tabela
   # própria com colunas VENDEDOR e Valor Líquido; não há linhas de venda.
   header_names=[fold(x).strip() for x in table[0]]
   if any(x=='VENDEDOR' for x in header_names) and any('VALOR LIQUIDO' in x for x in header_names):
    for cells in table[1:]:
     if len(cells)<2:continue
     name=str(cells[0]).strip();amount=next((cents(v) for v in reversed(cells) if cents(v) is not None),None)
     if not name or amount is None:raise ValueError('Devolução sem venda com vendedor ou valor inválido')
     refund_seller,refund_branch=canonical_seller_branch(name,'Matriz')
     if not refund_seller or amount<=0:raise ValueError('Devolução sem venda inválida: '+name[:80])
     group=groups[(refund_seller,refund_branch)]
     group['refund']+=amount;group['net']-=amount
    continue
   # Não perder silenciosamente blocos com rodapé financeiro reconhecível.
   totals_here=any(any(fold(c).strip() in ('TOTAL','TOTAL DEVOLVIDO','TOTAL (VENDIDOS - DEVOLVIDOS)') for c in row) for row in table)
   if seller and totals_here and not any(fold(c).strip()=='TOTAL GERAL' for row in table for c in row):
    unparsed.append((seller,branch))
   continue
  if not seller:
   raise ValueError('Tabela de clientes sem vendedor identificado no HTML (tabela '+str(index+1)+')')
  count=0;footer={};row_count=0
  for cells in table[header_idx+1:]:
   if len(cells)<2:continue
   # Rodapés podem ter colspan, então não presumimos que a legenda seja a primeira célula.
   footkey=next((fold(v).strip() for v in cells if fold(v).strip() in ('TOTAL','TOTAL DEVOLVIDO','TOTAL (VENDIDOS - DEVOLVIDOS)')),None)
   footval=next((cents(v) for v in reversed(cells) if cents(v) is not None),None)
   if footkey:
    if footval is not None:footer[footkey]=footval
    continue
   if len(cells)<=max(client_idx,value_idx):continue
   client=str(cells[client_idx]).strip();money=cents(cells[value_idx])
   if not client or money is None:continue
   individual=''
   if date_idx is not None:
    if date_idx>=len(cells):raise ValueError('Data ausente para cliente '+client[:60])
    individual=sale_date(cells[date_idx])
    if not individual:raise ValueError('Data não identificada na linha de '+client[:60])
    if not start<=individual<=end:raise ValueError('Data individual fora do período: '+individual)
    daily+=1
   rows.append({'seller':seller,'branch':branch,'client':client,'value_cents':money,'sale_day':individual})
   count+=money;row_count+=1
  if not footer and row_count==0:continue
  if set(footer)!={'TOTAL','TOTAL DEVOLVIDO','TOTAL (VENDIDOS - DEVOLVIDOS)'}:
   raise ValueError('Rodapé de totais ausente ou incompleto: '+seller+' ('+branch+')')
  gross,refund,net=footer['TOTAL'],footer['TOTAL DEVOLVIDO'],footer['TOTAL (VENDIDOS - DEVOLVIDOS)']
  if count!=gross:
   raise ValueError('Soma dos clientes diverge em '+seller+' ('+branch+'): '+brmoney(count)+' versus '+brmoney(gross)+' do X2.')
  delta=net-(gross-refund)
  if abs(delta)>2:raise ValueError('Devoluções não conferem com total líquido em '+seller+' ('+branch+'); diferença de '+brmoney(delta))
  if delta:group_warnings.append(seller+' ('+branch+'): líquido do X2 '+brmoney(net)+' versus calculado '+brmoney(gross-refund)+'; diferença '+brmoney(delta)+'.')
  group=groups[(seller,branch)];group['gross']+=gross;group['refund']+=refund;group['net']+=gross-refund
  section_processed.add((seller,branch))
 if not rows:raise ValueError('Nenhum cliente encontrado nas tabelas')
 total_gross=sum(v['gross'] for v in groups.values());total_refund=sum(v['refund'] for v in groups.values());total_net=sum(v['net'] for v in groups.values())
 # O TOTAL GERAL do X2 está numa tabela de resumo à parte. Não misturar
 # suas linhas com os rodapés de cada vendedor: os nomes de campos se repetem.
 global_totals=None
 for table in p.tables:
  if not any(fold(c).strip()=='TOTAL GERAL' for row in table for c in row):continue
  candidate={}
  for cells in table:
   if len(cells)<2:continue
   label=next((fold(c).strip() for c in cells if fold(c).strip() in ('TOTAL GERAL','TOTAL DEVOLVIDO','TOTAL (VENDIDOS - DEVOLVIDOS)')),None)
   amount=next((cents(v) for v in reversed(cells) if cents(v) is not None),None)
   if label and amount is not None:candidate[label]=amount
  if set(candidate)=={'TOTAL GERAL','TOTAL DEVOLVIDO','TOTAL (VENDIDOS - DEVOLVIDOS)'}:
   global_totals=candidate
   break
 if not global_totals:
  raise ValueError('Rodapé TOTAL GERAL do X2 incompleto. Não foi possível conferir vendido e devolvido.')
 x2_gross=global_totals['TOTAL GERAL']
 x2_refund=global_totals['TOTAL DEVOLVIDO']
 x2_net=x2_gross-x2_refund
 reported_net=global_totals['TOTAL (VENDIDOS - DEVOLVIDOS)']
 if x2_gross!=total_gross:
  missing=[seller+' ('+branch+')' for seller,branch in section_seen if (seller,branch) not in section_processed]
  raise ValueError('TOTAL GERAL do X2 '+brmoney(x2_gross)+'; grupos '+brmoney(total_gross)+'; diferença '+brmoney(x2_gross-total_gross)+'. '+('Grupos não lidos: '+', '.join(dict.fromkeys(missing))[:110] if missing else 'Revise os grupos do arquivo.'))
 # Alguns relatórios do X2 podem acumular diferenças de centavos nos rodapés
 # por vendedor. Apenas 1 ou 2 centavos são tolerados, com aviso explícito.
 rounding_delta=x2_refund-total_refund
 if abs(rounding_delta)>2:
  raise ValueError('Devoluções X2 '+brmoney(x2_refund)+'; soma por vendedor '+brmoney(total_refund)+'; diferença '+brmoney(rounding_delta)+'. Revisar relatório.')
 if abs(reported_net-x2_net)>2:
  raise ValueError('Total líquido no rodapé '+brmoney(reported_net)+' diverge de vendido menos devolvido '+brmoney(x2_net))
 audit_warnings=list(group_warnings)
 if rounding_delta:
  audit_warnings.append('O total devolvido geral difere '+brmoney(rounding_delta)+' da soma dos rodapés dos vendedores. Foi usado o TOTAL DEVOLVIDO do resumo geral do X2; a diferença de centavos foi preservada para auditoria.')
 if reported_net!=x2_net:
  audit_warnings.append('O total líquido exibido no rodapé difere até 2 centavos do cálculo; foi utilizado vendido menos devolvido.')
 by_group=[{'seller':seller,'branch':branch,'gross_cents':v['gross'],'refund_cents':v['refund'],'net_cents':v['net']} for (seller,branch),v in groups.items()]
 totals={branch:sum(v['gross'] for (seller,b),v in groups.items() if b==branch) for branch in ('Matriz','DIST','B2B','Internas')}
 totals.update({'total':x2_gross,'gross_cents':x2_gross,'refund_cents':x2_refund,'net_cents':x2_net,'by_group':by_group,'dated_rows':daily,'rounding_delta_cents':rounding_delta,'audit_warnings':audit_warnings})
 return rows,start,end,totals
