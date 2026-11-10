# Configurar a sincronização do calendário

A sincronização bidirecional conecta o calendário do RildonX somente ao calendário principal do Google Calendar. Os eventos pessoais importados ficam visíveis somente para o proprietário; os eventos da equipe permanecem compartilhados. Tokens de atualização são criptografados no servidor e não devem ser adicionados ao código-fonte.

## 1. Aplicar a migração do banco

No **Supabase Dashboard → SQL Editor**, execute primeiro a fundação do domínio caso ainda não tenha sido aplicada e, em seguida, `supabase-calendar-sync.sql` e `supabase-calendar-enhancements.sql`, em `docs/`. A segunda migração também deve ser executada depois das migrações de tarefas e projetos. Se a migração de calendário já tiver sido executada, execute novamente a versão atualizada para restringir os provedores ao Google.

Essa atualização remove as conexões e os vínculos de sincronização do Outlook/Microsoft, mas preserva os eventos já importados no RildonX. Eles deixam de sincronizar com o Outlook.

## 2. Registrar o OAuth do Google

Use esta URL como **URI de redirecionamento autorizado** no cliente OAuth do Google:

```text
https://<project-ref>.supabase.co/functions/v1/calendar-oauth-callback
```

### Google Calendar

1. No Google Cloud Console, selecione ou crie um projeto e habilite a **Google Calendar API**.
2. Configure a tela de consentimento OAuth. Enquanto o aplicativo estiver em modo de teste, adicione as contas que farão a conexão como usuários de teste.
3. Crie um ID do cliente OAuth do tipo **Aplicativo da Web**.
4. Adicione a URL de redirecionamento acima em **URIs de redirecionamento autorizados**.
5. Guarde o ID e o segredo do cliente para cadastrá-los como segredos do Supabase.

O aplicativo solicita `openid`, `email` e `https://www.googleapis.com/auth/calendar.events`.

## 3. Cadastrar segredos no Supabase

Cadastre os segredos em **Supabase Dashboard → Edge Functions → Secrets** ou pela CLI. `CALENDAR_APP_URL` deve ser a URL completa da página publicada, por exemplo `https://app.exemplo.com/calendario.html`; sua origem precisa corresponder ao domínio que abre o RildonX.

| Segredo | Valor |
| --- | --- |
| `CALENDAR_APP_URL` | URL publicada da página `calendario.html` |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Segredo aleatório forte, exclusivo do projeto |
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth do Google |
| `GOOGLE_CLIENT_SECRET` | Segredo do cliente OAuth do Google |

O Supabase fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` às Edge Functions. Não exponha nem coloque esses valores, ou os segredos dos provedores, em arquivos do front-end.

Para gerar uma chave de criptografia no PowerShell:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Guarde o resultado em um gerenciador seguro de segredos. **Não troque a chave após conectar calendários sem antes recriptografar os tokens existentes**, pois as conexões salvas deixarão de poder ser lidas.

## 4. Publicar as Edge Functions

Com o Supabase CLI autenticado e o projeto vinculado, publique:

```powershell
supabase functions deploy calendar-connect --project-ref <project-ref>
supabase functions deploy calendar-sync --project-ref <project-ref>
supabase functions deploy calendar-oauth-callback --project-ref <project-ref>
```

O `supabase/config.toml` desativa a verificação JWT somente no callback OAuth, que recebe o retorno direto dos provedores. As funções `calendar-connect` e `calendar-sync` continuam exigindo uma sessão autenticada do RildonX.

## 5. Testar

1. Abra **Calendário**, conecte o Google Calendar e aprove as permissões.
2. Confirme que a página retorna ao RildonX, exibe o estado da conexão e inicia uma sincronização.
3. Crie ou altere um evento no RildonX e confirme a atualização no provedor; depois altere um evento no provedor e use **Sincronizar** no RildonX.
4. Exclua um evento nos dois lados e confira a exclusão sincronizada.
5. Com duas contas de teste, confirme que um evento pessoal importado aparece somente para seu proprietário e que eventos derivados de tarefas/projetos seguem a lista de acesso do registro de origem.
6. Edite o mesmo evento em ambos os lados antes de sincronizar e confira o indicador de conflito e a resolução pela versão mais recente.

Enquanto a página Calendário estiver aberta, a sincronização automática consulta alterações a cada cinco minutos. Também é possível sincronizar manualmente. A conexão externa ainda não estará ativa até que a migração, os segredos e as três funções estejam configurados no projeto Supabase.

## Diagnóstico: falha ao enviar solicitação à Edge Function

Se o navegador mostrar **“Failed to send a request to the Edge Function”**, confira:

1. As três funções `calendar-connect`, `calendar-sync` e `calendar-oauth-callback` foram publicadas no mesmo projeto Supabase indicado em `assets/js/supabase-config.js`.
2. `CALENDAR_APP_URL` foi cadastrado nos segredos do Supabase com a URL exata da página Calendário publicada, incluindo o protocolo, host e caminho (por exemplo, `https://app.exemplo.com/calendario.html`). A função usa a origem dessa URL para autorizar CORS; o host em que a página está aberta precisa corresponder.
3. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `CALENDAR_TOKEN_ENCRYPTION_KEY` foram cadastrados como segredos das Edge Functions.
4. Consulte **Supabase Dashboard → Edge Functions → Logs** para ver erros de execução. Se a função responder com status 404, publique-a; se falhar no servidor, corrija a configuração indicada nos logs.

Não publique uma chave de serviço nem segredos OAuth no front-end. Se a página estiver sendo testada por outro domínio/porta, ajuste `CALENDAR_APP_URL` para essa origem e publique as funções novamente.

Preferências de categoria são privadas por usuário e sincronizadas em `calendar_preferences`. A exportação `.ics` é apenas um arquivo pontual; ela não cria uma conexão contínua. Recorrência, convites e lembretes não são ativados por esta migração: ainda precisam de regras de edição, cancelamento e notificação. A detecção de conflito compara os eventos visíveis; não há catálogo confiável de salas para validar disponibilidade física.

Se as datas de tarefas ou projetos forem salvas, mas não aparecerem no Calendário, execute novamente `supabase-calendar-enhancements.sql` no SQL Editor. Essa migração cria as colunas de origem e permissões usadas para vincular os eventos às datas e restringir seu acesso.

Se a sincronização falhar com `events_category_check` ou o código `23514`, execute `supabase-event-categories.sql` no SQL Editor. Ela atualiza a restrição para aceitar a categoria `tarefa` usada nos eventos derivados de tarefas.
