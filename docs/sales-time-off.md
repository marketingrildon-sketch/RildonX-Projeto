# Tabela de Folgas de Sábado

O painel **Tabela de Folgas de Sábado** organiza a escala mensal compartilhada da empresa. Ele reúne a lista de folgas, férias e a distribuição das responsabilidades de trabalho para cada sábado.

## Organização mensal

- Selecione a competência para consultar os sábados daquele mês.
- A lista de folgas é apresentada por sábado e separada em **Administrativos**, **Vendedores** e **Estoque e motoboy**, usando o setor cadastrado no perfil.
- Na seção **Férias do mês**, registre início e fim das férias de cada pessoa. Quem estiver de férias aparece identificado na escala e não pode receber uma responsabilidade de trabalho nos sábados cobertos pelo período. A mesma seção reúne as ações de gerar e exportar a escala.
- Para cada sábado, distribua as pessoas que estão trabalhando entre **Balcão**, **Televendas**, **Caixa**, **Suporte aos setores**, **Conferência**, **Expedição**, **Entrega pelo motoboy**, **Estoque**, **Garantia**, **Supervisão** e **OMRE — transferência e expedição**.
- Os campos de trabalho sem preenchimento permanecem visíveis para conferência. Folgas e férias ficam identificadas no lugar de uma atribuição.
- A distribuição de trabalho é manual e não substitui a conferência da escala. Ao alterar nomes, datas ou setores, valide novamente as referências e a cobertura necessária para cada sábado.

## Geração da escala e exceções

Em **Férias do mês**, gestores podem gerar a escala do mês. Preferências recorrentes já salvas são mantidas; para pessoas sem preferências registradas, a escala usa o 1º e o 4º sábados (ou as datas disponíveis mais próximas).

Exceções justificadas permitem registrar folga adicional, ausência excepcional ou troca de folga entre funcionários. A troca só é autorizada quando a pessoa de origem está escalada para folgar naquela data e a pessoa de destino não está.

## Conferência, exportação e histórico

- O contador de responsabilidades ajuda a identificar o que já foi distribuído.
- **Exportar escala**, na seção **Férias do mês**, gera um CSV com folgas, férias, atribuições de trabalho e exceções do mês.
- Preferências, períodos de férias, distribuição de trabalho e exceções ficam registrados no histórico compartilhado.
- Ao alterar nomes, setores ou datas, confira os dados vinculados e a cobertura dos setores antes de executar a escala.

## Acesso e ativação

Perfis com acesso ao painel podem consultar e exportar. Somente gestores identificados pelas regras de perfil existentes podem gerar a escala, salvar férias, atribuições de trabalho e exceções.

Para restringir as gravações aos gestores no banco, aplique [supabase-sales-time-off.sql](./supabase-sales-time-off.sql) depois da migração dos cards setoriais. As informações da escala são armazenadas no campo JSON compartilhado de `business_card_records`; não é necessária uma nova tabela.
