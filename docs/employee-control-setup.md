# Controle de Funcionários

## Supabase

1. Apply `supabase-employee-control.sql` after the profile privacy/admin, business-card, Quality, Infrastructure/maintenance, Support ticket, and purchase-management migrations. Apply it before `supabase-hr-recruitment.sql`. The script converts existing profiles with no individual permissions into an explicit list matching their current access, then makes `enabled_panels` mandatory. **Recrutamento e Seleção is intentionally not added to non-managerial legacy RH profiles**; enable it per person in Controle de Funcionários. It also creates a central panel-ID registry. The profile editor automatically reconciles this registry with the current frontend catalog: new panel IDs are registered, removed IDs are deleted from profiles, and existing users do not receive new panels unless a manager selects them. Panel title/description changes keep existing permissions when the panel ID remains stable. When deploying this behavior to a database that already has employee control installed, run `supabase-panel-catalog-sync.sql` once; subsequent visits to Controle de Funcionários reconcile the catalog automatically.
2. Deploy the updated `invite-rildonx-user` Edge Function. The endpoint name is retained for compatibility, but it no longer sends invitations or emails: it provisions a confirmed account directly with the temporary password supplied by an authorized manager. The function verifies the caller's RH, Gestão, or administrator profile and validates enabled panels against the central panel-ID registry. Its service-role key is read only from the Supabase Edge Function environment.
3. Configure these Edge Function secrets:
   - `EMPLOYEE_CONTROL_APP_URL`: exact origin of the web app, such as `https://portal.example.com`.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, supplied by Supabase.
4. The user can sign in immediately with their corporate email and temporary password. The first login requires them to choose a new password. Deliver the temporary password through a secure channel; it is never sent by email or stored in the employee profile.

The function is configured with gateway JWT verification disabled so the browser's CORS preflight can reach it; it validates the caller's bearer token itself before any privileged operation.

## Permissões para novas pessoas

Ao cadastrar uma pessoa, o setor e o cargo pré-selecionam os painéis correspondentes ao catálogo atual, incluindo Recrutamento e Seleção para RH e os painéis de Financeiro/Fiscal e Logística. A pessoa responsável pelo cadastro pode marcar ou desmarcar qualquer painel antes de salvar; essa seleção manual é a lista efetivamente enviada e gravada. Alterar permissões de pessoas já cadastradas continua sendo uma ação manual e não é afetado por esse padrão de novos cadastros.

In the RH panel, the employee list reads each account's `profiles.active` value. The toggle uses `set_rildonx_profile_active`; disabled accounts are rejected at login and are also denied panel access by the server-side profile and RLS checks. An administrator cannot disable their own current account from this list.

If the browser reports **“Failed to send a request to the Edge Function”**, publish the latest `invite-rildonx-user` function and confirm `EMPLOYEE_CONTROL_APP_URL` matches the exact origin shown in the address bar (scheme, host, and port; no page path is required). The function's success and error responses use this same origin for CORS. If the request is still blocked, inspect the browser Network panel and Supabase Edge Function logs, and check whether a browser extension, proxy, or network policy blocked the request.
