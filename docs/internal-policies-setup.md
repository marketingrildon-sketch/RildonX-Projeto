# Políticas Internas

## Configuração do Supabase

1. No SQL Editor do projeto Supabase, execute `docs/supabase-internal-policies.sql`. Se essa configuração já tiver sido aplicada, execute `docs/supabase-internal-policies-images.sql` para liberar JPEG/PNG no bucket existente.
2. Publique a versão atualizada do site. Ao salvar permissões de uma pessoa em Controle de Funcionários, o catálogo sincroniza o novo painel `management-policies-library`.
3. Na Biblioteca de Módulos, abra **Controle de Funcionários**, edite a pessoa e habilite **Políticas Internas** em **Painéis habilitados**. Salve para conceder a essa pessoa permissão de enviar, publicar e arquivar documentos.

O painel de Gerência já tem acesso pela regra existente de perfil gerencial. Pessoas com o painel habilitado também podem administrar as políticas; os demais usuários não veem esse módulo. A permissão é validada novamente no Supabase, além do bloqueio visual do site.

## Uso

No módulo **Gerência / Gestão → Políticas Internas**, envie imagens JPEG/PNG, PDF, Word, Excel ou OpenDocument de até 25 MB. Cada envio cria uma versão; ela pode ser salva como rascunho ou publicada. Ao publicar uma nova versão com o mesmo título, a versão publicada anterior é arquivada automaticamente. Versões arquivadas permanecem no histórico e podem ser publicadas novamente.

Todos os usuários autenticados podem consultar e baixar somente as versões publicadas pelo link rápido **Políticas internas**. Os arquivos ficam em um bucket privado e são abertos por links temporários; não use links públicos nem o bucket geral de documentos para essas políticas.

As alterações do site não aplicam o SQL remoto automaticamente. O módulo e os links rápidos só funcionarão depois de executar a migração no projeto Supabase correto.
