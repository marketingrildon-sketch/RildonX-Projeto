# RildonX — contexto e padrão de trabalho

Este arquivo é lido por qualquer agente (de qualquer modelo) antes de implementar mudanças neste repositório. Siga o padrão abaixo.

## O projeto

RildonX é uma plataforma web interna (HTML, CSS e JavaScript puro, sem framework nem build no repositório) para gestão de pessoas, projetos, tarefas, documentos, calendário e comunicação. O backend é o Supabase (`assets/js/supabase-config.js`). O site é publicado no GitHub Pages.

- Páginas HTML na raiz; lógica em `assets/js/`; estilos em `assets/css/`.
- Scripts são carregados com parâmetro de versão manual (`?v=AAAAMMDDx`). Ao alterar um script, atualize o parâmetro nas páginas que o usam, para evitar cache antigo.
- Arquivos em `assets/` com hash no nome (`index-*.js`, `marketing-report-import-*.js`, `supabase-client-*.js`, etc.) são saídas de build. Não edite esses arquivos diretamente sem saber o código-fonte correspondente.
- Scripts SQL em `docs/` são de referência; aplique-os no Supabase somente com aprovação.
- `scripts/audit-site.mjs` é executado pelo workflow `.github/workflows/scheduled-site-audit.yml`.

## Padrão de Issues

Toda tarefa vira uma Issue no GitHub antes de ser implementada. Classifique-a em um dos três tipos:

- **Correção**: algo que existe e não funciona como deveria.
- **Melhoria**: ajuste ou aprimoramento de algo que já funciona.
- **Nova função**: funcionalidade que ainda não existe.

Use o título com o tipo entre colchetes, por exemplo `[Correção] Ajustar filtro de férias`.

## Padrão de Pull Requests

Todas as entregas e deploys passam por Pull Request. Não envie commits direto para `main`.

Toda descrição de PR deve conter, nesta ordem:

1. **Issue relacionada**: mencione com `Closes #N` ou `Relacionada a #N`.
2. **O que mudou**: resumo objetivo das alterações.
3. **Como foi validado**: passos realizados (testes, navegação nas páginas afetadas, execução da auditoria, etc.). Se não foi possível validar algo, diga.
4. **Riscos, limitações e próximos passos**.

## Antes de implementar

1. Confirme que existe uma Issue para a tarefa e que ela tem o tipo correto.
2. Leia os arquivos da área afetada antes de alterar.
3. Trabalhe em uma branch a partir de `main` atualizada.
4. Ao final, abra o PR seguindo o padrão acima.

## Commits

Mensagens de commit em português, no imperativo, descrevendo a mudança. Inclua as linhas de atribuição exigidas pelo ambiente de quem está gerando o commit.
