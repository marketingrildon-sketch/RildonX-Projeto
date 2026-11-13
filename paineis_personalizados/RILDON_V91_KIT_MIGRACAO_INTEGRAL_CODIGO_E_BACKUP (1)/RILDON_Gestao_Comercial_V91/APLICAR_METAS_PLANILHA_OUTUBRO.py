"""Aplicacao pontual autorizada da planilha outubro/2026 ao PostgreSQL.
Faz copia da configuracao atual no banco antes de alterar, sem afetar vendas ou compras.
"""
import os,getpass,datetime,json
import psycopg
from psycopg.types.json import Jsonb
GOALS={
 'DUDU':('130000.00',21),'CARLOS RAFAEL':('40000.00',21),
 'CLAUDISTON':('160000.00',21),'DONIZETE':('0.00',21),
 'ELIS ANTHONNY':('220000.00',21),'GISLEI':('200000.00',21),
 'GUSTAVO':('2000.00',21),'HALISON':('160000.00',21),
 'IRAN':('290000.00',16),'ISAIAS':('400000.00',21),
 'LUANA':('110000.00',21),'VALDINETE':('200000.00',20),
 'VENDAS INTERNAS':('456.69',21)}
print('RILDON - METAS OUTUBRO/2026 (planilha recebida)')
print('TOTAL:',sum(__import__('decimal').Decimal(v[0]) for v in GOALS.values()),'|',len(GOALS),'linhas')
print('Esta operacao substitui SOMENTE metas e dias de 2026-10; preserva Compras, vendas e usuarios.')
if input('Para continuar digite APLICAR METAS OUTUBRO: ').strip()!='APLICAR METAS OUTUBRO':raise SystemExit('Cancelado.')
password=os.getenv('RILDON_PG_PASSWORD') or getpass.getpass('Senha local de rildon_app: ')
with psycopg.connect(host=os.getenv('RILDON_PG_HOST','localhost'),port=int(os.getenv('RILDON_PG_PORT','5432')),dbname=os.getenv('RILDON_PG_DATABASE','rildon_gestao'),user=os.getenv('RILDON_PG_USER','rildon_app'),password=password) as conn:
 with conn.cursor() as c:
  c.execute('ALTER TABLE rildon_target_seller_days ADD COLUMN IF NOT EXISTS remaining INTEGER')
  c.execute('CREATE TABLE IF NOT EXISTS rildon_targets_backup_v83 (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,created_at TIMESTAMPTZ DEFAULT now(),month TEXT NOT NULL, data JSONB NOT NULL)')
  c.execute('SELECT seller,amount FROM rildon_targets WHERE month=%s',('2026-10-01',));old_goals=c.fetchall()
  c.execute('SELECT workdays,elapsed FROM rildon_target_days WHERE month=%s',('2026-10',));old_days=c.fetchall()
  c.execute('SELECT seller,workdays,elapsed,worked,remaining FROM rildon_target_seller_days WHERE month=%s',('2026-10',));old_progress=c.fetchall()
  c.execute('INSERT INTO rildon_targets_backup_v83(month,data) VALUES(%s,%s)',('2026-10',Jsonb({'goals':[(n,str(v)) for n,v in old_goals],'days':old_days,'progress':old_progress})))
  c.execute('DELETE FROM rildon_targets WHERE month=%s',('2026-10-01',))
  c.execute('DELETE FROM rildon_target_seller_days WHERE month=%s',('2026-10',))
  for name,(goal,days) in GOALS.items():
   c.execute('INSERT INTO rildon_targets(month,seller,amount) VALUES(%s,%s,%s)',('2026-10-01',name,goal))
   elapsed=min(days,13)  # 13 dias trabalhados na planilha; restantes da equipe = 8.
   c.execute('INSERT INTO rildon_target_seller_days(month,seller,workdays,elapsed,worked,remaining) VALUES(%s,%s,%s,%s,%s,%s)',('2026-10',name,days,elapsed,elapsed,8))
  c.execute('INSERT INTO rildon_target_days(month,workdays,elapsed) VALUES(%s,%s,%s) ON CONFLICT(month) DO UPDATE SET workdays=EXCLUDED.workdays,elapsed=EXCLUDED.elapsed',('2026-10',21,13))
print('Metas aplicadas: 13 linhas. Dias trabalhados sao valores iniciais editaveis pela Gerencia.')
print('Backup das metas anteriores: tabela rildon_targets_backup_v83.')
