# Gestão Comercial

O painel **Gestão Comercial** adapta os recursos selecionados do kit V91 à autenticação e aos registros compartilhados do RildonX:

- visão mensal, metas e indicadores de vendas;
- lançamento de atendimentos, com situação e próximo contato;
- lançamento manual de vendas realizadas e vendas perdidas;
- consulta pesquisável aos prazos de garantia dos fabricantes.

Como a integração com a extensão X2 não faz parte desta versão, atendimentos, vendas e perdas precisam ser lançados manualmente. Os registros são persistidos em `business_card_records` pelo Supabase; o vendedor vê os registros atribuídos a ele e pode editar os que cadastrou, enquanto perfis de gerência têm visão consolidada e podem definir metas por vendedor.

## Ativação

1. Aplique [`supabase-sales-commercial-management.sql`](./supabase-sales-commercial-management.sql) no SQL Editor do Supabase, depois das migrações de `business_card_records` e Controle de Funcionários.
2. Atualize o catálogo de painéis no Controle de Funcionários. Os perfis do setor Comercial/Vendas e de gerência recebem acesso conforme as regras do painel; vendedores não podem ler nem alterar registros de outros vendedores.
3. Atualize o site publicado. A tabela de garantias é carregada de `public/data/sales-manufacturer-warranties.json`.

O cadastro legado, as credenciais locais e o servidor local do kit V91 não são usados nem importados.
