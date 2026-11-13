import json, os, socket, threading, getpass
import pg_db
import metas_backend as targets
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from pathlib import Path
import atendimentos_backend as attendance
import solicitacoes_backend as requests
attendance.init()
attendance.ensure_seller_users()
requests.init()
targets.init()
BASE=Path(__file__).resolve().parent
DB='PostgreSQL / rildon_gestao'
LOCK=threading.RLock()
RESET_CODE=os.environ.get('RILDON_RESET_CODE','')
with pg_db.raw() as c:
 c.execute('CREATE TABLE IF NOT EXISTS rildon_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
 c.execute("INSERT INTO rildon_metadata(key,value) VALUES('epoch','0') ON CONFLICT DO NOTHING")
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw): super().__init__(*a,directory=str(BASE/'site'),**kw)
 def end_headers(self):
  self.send_header('Cache-Control','no-store, max-age=0')
  super().end_headers()
 def reply(self,status,obj):
  data=json.dumps(obj,ensure_ascii=False).encode('utf-8');self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 def do_GET(self):
  if urlparse(self.path).path=='/api/targets':return targets.handler(self,'GET')
  if urlparse(self.path).path.startswith("/api/requests/"):return requests.get(self,urlparse(self.path).path)
  if urlparse(self.path).path.startswith("/api/attendance/"):return attendance.get(self,urlparse(self.path).path)
  if urlparse(self.path).path=='/api/ruptures':
   with pg_db.raw() as c:
    items=[r[0] for r in c.execute('SELECT payload FROM rildon_lost_sales ORDER BY updated_at DESC').fetchall()]
    epoch=int(c.execute("SELECT value FROM rildon_metadata WHERE key='epoch'").fetchone()[0])
   return self.reply(200,{'ok':True,'items':items,'epoch':epoch})
  if urlparse(self.path).path in ('/api/build','/api/version'):return self.reply(200,{'ok':True,'version':'8.5-PG','build':'RILDON-V84-COMPRAS-NAVEGACAO','source':'RILDON Gestão Comercial'})
  if urlparse(self.path).path=='/api/health':return self.reply(200,{'ok':True,'mode':'LAN','version':'8.5-PG','database':'postgresql'})
  return super().do_GET()
 def do_POST(self):
  if urlparse(self.path).path=='/api/targets':return targets.handler(self,'POST')
  if urlparse(self.path).path.startswith("/api/requests/"):return requests.post(self,urlparse(self.path).path)
  if urlparse(self.path).path.startswith("/api/attendance/"):return attendance.post(self,urlparse(self.path).path)
  if urlparse(self.path).path=='/api/reset':
   try:
    n=int(self.headers.get('Content-Length','0'))
    if not 0<n<1000:return self.reply(400,{'ok':False})
    data=json.loads(self.rfile.read(n))
    if not RESET_CODE or data.get('code')!=RESET_CODE:return self.reply(403,{'ok':False,'error':'Código incorreto'})
    with pg_db.raw() as c:
     c.execute('DELETE FROM rildon_lost_sales')
     c.execute("UPDATE rildon_metadata SET value=(value::integer+1)::text WHERE key='epoch'")
     epoch=int(c.execute("SELECT value FROM rildon_metadata WHERE key='epoch'").fetchone()[0])
    return self.reply(200,{'ok':True,'epoch':epoch})
   except Exception as e:return self.reply(400,{'ok':False,'error':str(e)[:100]})
  if urlparse(self.path).path!='/api/ruptures':return self.reply(404,{'ok':False})
  try:
   n=int(self.headers.get('Content-Length','0'))
   if not 0<n<=2_000_000:return self.reply(413,{'ok':False,'error':'Limite de tamanho'})
   payload=json.loads(self.rfile.read(n));items=payload.get('items',[])
   if not isinstance(items,list) or len(items)>1000:return self.reply(400,{'ok':False,'error':'Lista inválida'})
   with pg_db.raw() as c:
    epoch=int(c.execute("SELECT value FROM rildon_metadata WHERE key='epoch'").fetchone()[0])
   if payload.get('epoch')!=epoch:return self.reply(409,{'ok':False,'error':'Histórico reiniciado; atualize a página','epoch':epoch})
   cleaned=[]
   for r in items:
    if not isinstance(r,dict) or not isinstance(r.get('id'),str) or not 0<len(r['id'])<=180:continue
    if not isinstance(r.get('seller'),str) or not isinstance(r.get('code'),str):continue
    cleaned.append((r['id'],json.dumps(r,ensure_ascii=False)))
   with pg_db.raw() as c:
    for rid,data in cleaned:
     obj=json.loads(data)
     c.execute("""INSERT INTO rildon_lost_sales(id,seller,payload,updated_at)
        VALUES(%s,%s,%s::jsonb,NOW()) ON CONFLICT(id) DO UPDATE
        SET seller=EXCLUDED.seller,payload=EXCLUDED.payload,updated_at=NOW()""",(rid,obj.get('seller',''),data))
   return self.reply(200,{'ok':True,'saved':len(cleaned)})
  except Exception as e:return self.reply(400,{'ok':False,'error':str(e)[:200]})
 def log_message(self,fmt,*args):pass
if __name__=='__main__':
 try:ip=socket.gethostbyname(socket.gethostname())
 except:ip='IP-DO-COMPUTADOR'
 print('\nRILDON GESTAO COMERCIAL V7.0 POSTGRESQL — REDE LOCAL')
 print('Gerencia neste computador: http://localhost:8789/gerencia.html')
 print('Outros computadores: http://'+ip+':8789/vendedor.html')
 print('Compras: http://localhost:8789/compras.html')
 print('Se o IP exibido estiver errado, use ipconfig no Windows.')
 print('Mantenha esta janela aberta. Nao exponha a porta 8789 na internet.\n')
 print('Reinicio de historico desabilitado, salvo configuracao explicita.' if not RESET_CODE else 'Codigo de reinicio configurado.')
 ThreadingHTTPServer(('0.0.0.0',8789),Handler).serve_forever()
