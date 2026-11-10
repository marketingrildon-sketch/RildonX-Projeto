# Endurecimento de segurança do RildonX

## Migração de Storage e tentativas de login

Execute [supabase-security-hardening.sql](./supabase-security-hardening.sql) no SQL Editor do projeto, depois de aplicar `supabase-collaboration-access-and-profile-self-service.sql`. A migração passa a autorizar arquivos pela coluna `documents.storage_path`, não pela URL editável do registro. Novos uploads já gravam esse caminho. Registros antigos cujo endereço não permita recuperar um caminho pertencente ao dono ficam sem caminho de Storage, por segurança.

## Bloqueio e alerta de login

O bloqueio após cinco tentativas é aplicado pela Edge Function `rildonx-login`, usando os RPCs privados criados pela migração. Antes de ativar o fluxo, configure no projeto Supabase:

- `LOGIN_APP_URL`: origem exata do site publicado, sem curingas.
- `LOGIN_HASH_SECRET`: segredo aleatório longo para gerar identificadores irreversíveis das tentativas.
- `RESEND_API_KEY`: chave de API de um remetente Resend verificado.
- `LOGIN_ALERT_FROM`: remetente autorizado no Resend.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente de Edge Functions do Supabase. Não coloque essas chaves nem a senha do usuário no código do navegador ou no e-mail de alerta.

Depois de definir os segredos, publique a função com:

```powershell
supabase functions deploy rildonx-login --project-ref <project-ref> --no-verify-jwt
```

Somente então habilite `window.RILDONX_LOGIN_FUNCTION_ENABLED = true` em `assets/js/supabase-config.js` e publique novamente o site. O alerta contém somente o login tentado e o horário final do bloqueio, e é enviado para `rhrildon5@gmail.com`. A função não registra nem envia senhas. A autenticação padrão do Supabase continua sendo uma API pública; mantenha também a proteção contra força bruta e CAPTCHA/rate limit configurados em **Authentication → Rate Limits/Security**.

## Limite de sessão

O front-end encerra a sessão local após oito horas e reinicia a contagem em um novo login. Esse relógio do navegador é apenas uma camada adicional; ele pode ser alterado pelo usuário. Para impor o limite absoluto, configure também **Authentication → Sessions → Maximum session lifetime** para oito horas no projeto Supabase e confirme que o provedor está aplicando a política a todas as sessões.

## Validação operacional

Após configurar e publicar os controles no Supabase, valide com uma conta de teste: quatro senhas inválidas, bloqueio na quinta, recebimento do alerta, recuperação depois de 15 minutos e login válido zerando a contagem. Confirme também o encerramento de uma sessão após oito horas e que usuários sem acesso não conseguem gerar URL assinada ou baixar arquivos de outro dono. Não use contas reais para os testes de bloqueio.
