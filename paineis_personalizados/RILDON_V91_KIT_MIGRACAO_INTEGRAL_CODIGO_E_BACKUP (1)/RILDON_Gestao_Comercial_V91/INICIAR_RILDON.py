"""Run ONLY the bundled RILDON server. Refuse to launch if port is already in use."""
import json, socket, sys, urllib.request, os, getpass
import pg_db
from pathlib import Path
BASE=Path(__file__).resolve().parent
PORT=8789
VERSION='7.0-PG'
def alive():
    with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as s:
        s.settimeout(.7)
        return s.connect_ex(('127.0.0.1',PORT))==0
if alive():
    print('\nATENCAO: PORTA 8789 JA ESTA OCUPADA!')
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/build',timeout=2) as r:
            d=json.load(r)
            print('VERSAO ATUAL QUE ESTA RESPONDENDO: ',d.get('version','nao identificada'))
            if d.get('version')==VERSION:
                print('V7.0 ja esta funcionando. Nao abra outra janela do servidor.')
            else:
                print('Feche o servidor antigo. Depois execute este arquivo novamente.')
    except Exception:
        print('Outra versao ou outro programa ocupa essa porta. Feche a janela do servidor antigo.')
    print('NAO use o site antigo achando que a V6.9 iniciou.')
    sys.exit(2)
print('\nCONEXAO COM POSTGRESQL — rildon_gestao')
if not os.getenv('RILDON_PG_PASSWORD'):
 pg_db.configure(password=getpass.getpass('Senha PostgreSQL de rildon_app: '))
else:pg_db.configure()
try:
 with pg_db.raw() as c:
  print('Banco conectado:',c.execute('SELECT current_database()').fetchone()[0])
except Exception as e:
 print('FALHA NA CONEXAO POSTGRESQL:',str(e)[:200]);sys.exit(3)
import servidor_rildon as server
from http.server import ThreadingHTTPServer
print('\n'+'='*60)
print('  RILDON GESTAO COMERCIAL  V7.0  - POSTGRESQL')
print('  http://localhost:8789/gerencia.html')
print('  TESTE DA VERSAO: http://localhost:8789/api/build')
print('  Banco de dados: PostgreSQL rildon_gestao')
print('='*60+'\n')
try:
    ThreadingHTTPServer(('0.0.0.0',PORT),server.Handler).serve_forever()
except KeyboardInterrupt:
    print('Servidor encerrado.')
