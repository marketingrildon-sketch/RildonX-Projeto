-- Atualiza as categorias permitidas para eventos do calendario.
-- Execute no Supabase SQL Editor depois de criar public.events.

alter table public.events
  add column if not exists category text not null default 'reuniao';

update public.events
set category = 'reuniao'
where category is null
   or category not in (
     'reuniao', 'projeto', 'acao_comercial', 'feriado', 'conteudo',
     'aniversario', 'treinamento', 'exame', 'auditoria', 'documento', 'tarefa'
   );

alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (category in (
    'reuniao', 'projeto', 'acao_comercial', 'feriado', 'conteudo',
    'aniversario', 'treinamento', 'exame', 'auditoria', 'documento', 'tarefa'
  ));
