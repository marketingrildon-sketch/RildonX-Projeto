HELPDESK TI - V12

ALTERACOES
1. Grafico mensal em formato de pizza SOLIDA, inspirado na referencia enviada:
   - fatias coloridas
   - percentuais fora da pizza
   - linhas-guia discretas
   - legenda compacta na parte inferior
   - total anual abaixo do grafico
2. Mantido o seletor de ano.
3. Adicionado iniciar_ngrok.bat para publicar o Helpdesk da loja principal para a filial.

ACESSO DA FILIAL COM NGROK

Na maquina onde o Helpdesk roda:
1. Instale o ngrok. No Windows, o site oficial recomenda:
   winget install ngrok -s msstore
2. Cadastre o authtoken da conta ngrok UMA VEZ:
   ngrok config add-authtoken "SEU_AUTHTOKEN"
3. Execute iniciar.bat para iniciar o Helpdesk.
4. Execute iniciar_ngrok.bat.
5. O ngrok mostrara uma URL HTTPS, por exemplo:
   https://xxxx.ngrok.app
6. A filial acessa essa URL pelo navegador.

IMPORTANTE
- A filial acessara a MESMA aplicacao e o MESMO helpdesk.db da loja principal.
- Os chamados abertos pela filial aparecem no painel do TI da loja principal.
- Nao copie o helpdesk.db para a filial se a intencao for compartilhar os mesmos chamados.
- A URL gratuita do ngrok pode mudar quando o tunel for reiniciado.
- Nao compartilhe o authtoken do ngrok.
- Como o sistema ficara acessivel pela internet, use senha forte no acesso administrativo.

ARQUITETURA
Filial -> Internet -> ngrok -> PC/Servidor da loja principal -> Flask :5000 -> helpdesk.db

Para uma implantacao permanente, podemos depois separar as lojas no sistema com um campo LOJA/FILIAL,
permissoes por loja e identificacao da origem de cada chamado.


V12 - Alteração solicitada
- O gráfico mensal foi removido do painel administrativo.
- Os indicadores (Total, Abertos, Em atendimento e Resolvidos) continuam funcionando.

Sobre ERR_NGROK_6024
- Essa tela é um aviso de segurança do ngrok para endpoints gratuitos acessados por navegador.
- No primeiro acesso ao endereço, clique em "Visit Site". O ngrok grava um cookie e, segundo a documentação oficial, o aviso deixa de aparecer por 7 dias para aquele domínio.
- Para remover o interstitial de forma permanente, o ngrok informa que é necessário um plano pago. O cabeçalho ngrok-skip-browser-warning também pode ignorá-lo quando o cliente consegue enviar esse cabeçalho.
