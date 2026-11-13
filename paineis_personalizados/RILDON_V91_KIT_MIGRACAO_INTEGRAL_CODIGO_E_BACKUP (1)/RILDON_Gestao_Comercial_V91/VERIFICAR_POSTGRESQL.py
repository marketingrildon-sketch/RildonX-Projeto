import getpass
import pg_db
from psycopg.rows import dict_row
pg_db.configure(password=getpass.getpass('Senha do PostgreSQL (rildon_app): '))
try:
 with pg_db.raw() as c:
  print('Usuario e banco:',c.execute('SELECT current_user,current_database()').fetchone())
  for table in ('rildon_requests','rildon_suppliers','rildon_sales','rildon_lost_sales','rildon_targets'):
   print(table,c.execute('SELECT COUNT(*) FROM '+table).fetchone()[0])
 print('CONEXAO VALIDADA.')
except Exception as exc:
 print('ERRO:',exc)
 input('Pressione Enter para sair...')
 raise SystemExit(1)
input('Pressione Enter para sair...')
