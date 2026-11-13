"""PostgreSQL only. A small SQLite-query compatibility wrapper for legacy attendance code."""
import os,re,getpass
import psycopg
from psycopg.rows import tuple_row
from psycopg import IntegrityError
_CONFIG = None

def configure(password=None):
 global _CONFIG
 if _CONFIG is None:
  _CONFIG={'host':os.getenv('RILDON_PG_HOST','localhost'),'port':int(os.getenv('RILDON_PG_PORT','5432')),'dbname':os.getenv('RILDON_PG_DATABASE','rildon_gestao'),'user':os.getenv('RILDON_PG_USER','rildon_app'),'password':password or os.getenv('RILDON_PG_PASSWORD','')}
 if password:_CONFIG['password']=password
 return _CONFIG

def raw():
 return psycopg.connect(**configure(),connect_timeout=8)

class Connection:
 def __init__(self,*args,**kwargs): self.conn=raw()
 def __enter__(self):return self
 def __exit__(self,exc_type,exc,tb):
  try:self.conn.rollback() if exc_type else self.conn.commit()
  finally:self.conn.close()
 def close(self):self.conn.close()
 def execute(self,sql,params=()):
  q=sql.strip(); replacement=None
  if re.match(r'INSERT OR IGNORE\s+INTO',q,re.I):
   q=re.sub(r'INSERT OR IGNORE\s+INTO','INSERT INTO',q,count=1,flags=re.I).rstrip(';')+' ON CONFLICT DO NOTHING'
  elif re.match(r'INSERT OR REPLACE\s+INTO',q,re.I):
   table=re.search(r'INTO\s+(\w+)',q,re.I).group(1)
   keys={'attendance_entries_v57':['report_start','report_end','sale_day','seller','branch','client'],'attendance_users':['username'],'sol_users':['username']}
   columns={'attendance_entries_v57':['report_start','report_end','sale_day','seller','branch','client','value_cents'],'attendance_users':['username','seller','salt','hash','admin'],'sol_users':['username','role','salt','hash']}
   if table not in keys:raise ValueError('UPSERT not supported for '+table)
   q=re.sub(r'INSERT OR REPLACE\s+INTO','INSERT INTO',q,count=1,flags=re.I)
   updated=[x for x in columns[table] if x not in keys[table]]
   q+=' ON CONFLICT ('+','.join(keys[table])+') DO UPDATE SET '+','.join(x+'=EXCLUDED.'+x for x in updated)
  q=q.replace('?', '%s')
  cur=self.conn.cursor(row_factory=tuple_row)
  cur.execute(q,params)
  return cur
 def executemany(self,sql,rows):
  c=None
  for row in rows:c=self.execute(sql,row)
  return c

def connect(*args,**kwargs):return Connection()
