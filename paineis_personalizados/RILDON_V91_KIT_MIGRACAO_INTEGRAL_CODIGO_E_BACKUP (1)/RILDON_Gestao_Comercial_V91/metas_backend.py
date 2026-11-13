"""Metas compartilhadas pelo PostgreSQL; autorização usa sessões do módulo de atendimentos."""
import json, re
import pg_db
import atendimentos_backend as attendance

def init():
 with pg_db.raw() as c:
  c.execute("""CREATE TABLE IF NOT EXISTS rildon_target_days (month TEXT PRIMARY KEY, workdays INTEGER NOT NULL DEFAULT 26, elapsed INTEGER NOT NULL DEFAULT 0)""")
  c.execute("""CREATE TABLE IF NOT EXISTS rildon_target_seller_days (month TEXT NOT NULL,seller TEXT NOT NULL,workdays INTEGER NOT NULL, PRIMARY KEY(month,seller))""")
  c.execute("ALTER TABLE rildon_target_seller_days ADD COLUMN IF NOT EXISTS elapsed INTEGER")
  c.execute("ALTER TABLE rildon_target_seller_days ADD COLUMN IF NOT EXISTS worked INTEGER")
  c.execute("ALTER TABLE rildon_target_seller_days ADD COLUMN IF NOT EXISTS remaining INTEGER")

def seller_day_defaults(month):
 # Quantidades da planilha de referência enviadas pelo usuário para outubro/2026.
 return {'IRAN':16,'VALDINETE':20} if month=='2026-10' else {}

def calendar_workdays(month):
 import datetime,calendar
 y,m=map(int,month.split('-'))
 return sum(datetime.date(y,m,d).weekday()<5 for d in range(1,calendar.monthrange(y,m)[1]+1))

def handler(h,method):
 user=attendance.auth(h)
 if not user: return h.reply(401,{'error':'Sessão inválida. Entre novamente no sistema.'})
 if method=='GET':
  from urllib.parse import parse_qs,urlparse
  month=parse_qs(urlparse(h.path).query).get('month',[''])[0]
  if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',month):return h.reply(400,{'error':'Mês inválido'})
  with pg_db.raw() as c:
   data=c.execute('SELECT seller,amount FROM rildon_targets WHERE month=%s',(month+'-01',)).fetchall()
   days=c.execute('SELECT workdays,elapsed FROM rildon_target_days WHERE month=%s',(month,)).fetchone()
   overrides=c.execute('SELECT seller,workdays,elapsed,worked,remaining FROM rildon_target_seller_days WHERE month=%s',(month,)).fetchall()
  permitted=[(seller,amount) for seller,amount in data if user['admin'] or attendance.canonical_seller_branch(seller,'Matriz')[0]==attendance.canonical_seller_branch(user['seller'],'Matriz')[0]]
  return h.reply(200,{'ok':True,'month':month,'goals':{n:float(v) for n,v in permitted},'days':{'total':days[0],'elapsed':days[1]} if days else {'total':(21 if month=='2026-10' else calendar_workdays(month)),'elapsed':(13 if month=='2026-10' else 0)},'seller_days':{**seller_day_defaults(month),**{r[0]:r[1] for r in overrides}},'seller_progress':{r[0]:{'elapsed':r[2],'worked':r[3],'remaining':r[4]} for r in overrides if r[2] is not None and r[3] is not None},'admin':user['admin']})
 if not user['admin']:return h.reply(403,{'error':'Somente gerência pode alterar metas'})
 try:
  n=int(h.headers.get('Content-Length','0'))
  if not 0<n<16000:return h.reply(400,{'error':'Tamanho inválido'})
  data=json.loads(h.rfile.read(n));month=data['month'];goals=data['goals'];days=data['days']
  if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',month):raise ValueError('Mês inválido')
  if not isinstance(goals,dict) or len(goals)>30:raise ValueError('Vendedores inválidos')
  import decimal
  rows=[]
  for name,amount in goals.items():
   if name not in ('DUDU','CARLOS RAFAEL','CLAUDISTON','DONIZETE','ELIS ANTHONNY','GISLEI','GUSTAVO','HALISON','IRAN','ISAIAS','LUANA','VALDINETE','VENDAS INTERNAS'):raise ValueError('Vendedor inválido')
   v=decimal.Decimal(str(amount));cents=int((v*100).quantize(decimal.Decimal('1')))
   if cents<0 or cents>100000000000:raise ValueError('Valor de meta inválido')
   rows.append((month+'-01',name,str(decimal.Decimal(cents)/100)))
  total=int(days['total']);elapsed=int(days['elapsed'])
  overrides=data.get('seller_days',{})
  if not isinstance(overrides,dict):raise ValueError('Dias por vendedor inválidos')
  if set(overrides)-{'DUDU','CARLOS RAFAEL','CLAUDISTON','DONIZETE','ELIS ANTHONNY','GISLEI','GUSTAVO','HALISON','IRAN','ISAIAS','LUANA','VALDINETE','VENDAS INTERNAS'}:raise ValueError('Vendedor inválido')
  for val in overrides.values():
   if not 1<=int(val)<=31:raise ValueError('Dias úteis individuais inválidos')
  if total<1 or total>31 or elapsed<0 or elapsed>total:raise ValueError('Dias úteis inválidos')
  progress=data.get('seller_progress',{})
  if not isinstance(progress,dict) or set(progress)-{'DUDU','CARLOS RAFAEL','CLAUDISTON','DONIZETE','ELIS ANTHONNY','GISLEI','GUSTAVO','HALISON','IRAN','ISAIAS','LUANA','VALDINETE','VENDAS INTERNAS'}:raise ValueError('Dias trabalhados inválidos')
  normalized={}
  for seller,record in progress.items():
   if not isinstance(record,dict):raise ValueError('Dias de '+seller+' inválidos')
   seller_total=int(overrides.get(seller,total));passed=int(record['elapsed']);worked=int(record['worked']);remaining=int(record.get('remaining',max(0,total-elapsed)))
   if not 0<=worked<=passed<=seller_total or not 0<=remaining<=31:raise ValueError(seller+': informe 0 <= trabalhados <= transcorridos <= dias previstos')
   normalized[seller]=(seller_total,passed,worked,remaining)
  with pg_db.raw() as c:
   for row in rows:c.execute('INSERT INTO rildon_targets(month,seller,amount) VALUES(%s,%s,%s) ON CONFLICT(month,seller) DO UPDATE SET amount=EXCLUDED.amount',row)
   c.execute('INSERT INTO rildon_target_days(month,workdays,elapsed) VALUES(%s,%s,%s) ON CONFLICT(month) DO UPDATE SET workdays=EXCLUDED.workdays,elapsed=EXCLUDED.elapsed',(month,total,elapsed))
   for name,val in overrides.items():c.execute('INSERT INTO rildon_target_seller_days(month,seller,workdays) VALUES(%s,%s,%s) ON CONFLICT(month,seller) DO UPDATE SET workdays=EXCLUDED.workdays',(month,name,int(val)))
   for name,(seller_total,passed,worked,remaining) in normalized.items():c.execute('INSERT INTO rildon_target_seller_days(month,seller,workdays,elapsed,worked,remaining) VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(month,seller) DO UPDATE SET workdays=EXCLUDED.workdays,elapsed=EXCLUDED.elapsed,worked=EXCLUDED.worked,remaining=EXCLUDED.remaining',(month,name,seller_total,passed,worked,remaining))
  return h.reply(200,{'ok':True,'saved':len(rows)})
 except Exception as e:return h.reply(400,{'error':str(e)[:180]})
