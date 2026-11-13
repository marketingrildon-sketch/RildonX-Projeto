# Treinamentos e Desenvolvimento (RH)

O painel do setor RH centraliza o cadastro de capacitações, as participações dos funcionários, o acompanhamento de cobertura e vencimentos, os relatórios e os investimentos. Use a identidade e o controle de acesso do RildonX; o sistema não replica o login por código do portal legado.

## Acesso, pessoas e persistência

- Respeita as permissões individuais do painel, o acesso do setor RH e os perfis administrativos autorizados.
- Os funcionários vêm do diretório central **Pessoas**. O painel não duplica contas ou cadastros; alterações de nome, cargo, setor e situação são feitas no diretório.
- Somente funcionários ativos aparecem para seleção em novas turmas. Participações históricas permanecem vinculadas ao identificador do perfil e guardam uma cópia do nome/setor no momento do lançamento.
- Turmas, participações e investimentos são registros compartilhados em `business_card_records`, sob `module_key = 'hr-training'` e setor `rh`. A tabela existente e as políticas RLS são necessárias para sincronização e persistência.
- As participações legadas no módulo RH são mantidas e podem compor o histórico; novas turmas usam o mesmo registro de turma para reunir vários participantes. O painel não importa dados dos arquivos anexados.

## Visões

- **Visão geral:** funcionários ativos, cobertura, carga horária de turmas e pessoas sem registro; inclui média de horas por funcionário ativo, ranking de cursos por participação, distribuição por setor atual, últimas participações e alertas de validade.
- **Turmas e histórico:** registra tipo, curso/tema, data, carga horária, instrutor, validade em meses e um ou mais funcionários ativos. Exibe as 15 turmas mais recentes; o histórico completo fica em Relatórios.
- **Calendário:** a data de uma turma é sincronizada como evento pessoal no calendário do usuário que salvou o registro. Investimentos e turmas canceladas não criam lembretes; alterar ou arquivar a turma atualiza/remove o evento.
- **Anexos:** turmas e investimentos aceitam um arquivo por envio. Os arquivos ficam no armazenamento privado compartilhado e são acessíveis ao autor e aos perfis autorizados para o painel.
- **Relatórios e pendências:** consulta por competência, curso e funcionário; um curso selecionado mostra funcionários ativos sem participação no recorte, e um funcionário sem curso selecionado mostra cursos do histórico que ainda não constam para essa pessoa.
- **Investimentos:** controla tipo, instrutor/tema, quantidade informada, custo do treinamento e coffee break, calculando total e custo por pessoa. É independente das turmas e não é lançado automaticamente.
- **Funcionários:** consulta os perfis do diretório central e encaminha à página Pessoas para manutenção.

As listas de turmas permitem editar um grupo, corrigir individualmente ou remover uma participação e arquivar a turma. A correção individual guarda exceções de curso, data, carga e validade sem alterar os demais participantes. A exportação CSV é construída dos dados (não da tabela visual), inclui participantes e validade; a exportação de investimentos inclui custos total e unitário.

## Regras dos indicadores e validade

- A população ativa respeita o estado atual dos perfis. Cobertura conta pessoas distintas com pelo menos uma participação, independentemente de validade ou carga; pessoas inativas continuam no histórico, mas não entram nos indicadores de ativos.
- Novas turmas são lançadas como **Realizado**. Registros legados com status de planejamento, inscrição ou andamento permanecem visíveis no histórico, mas só entram nos indicadores e vencimentos após a ação **Registrar como realizado**; status cancelados também não contam.
- Ranking e distribuição por setor contam participações, não turmas. Setor usa o valor atual do perfil.
- Carga das turmas conta uma vez por turma; horas de participação somam a carga individual de cada funcionário. A média de horas divide a soma das participações por todos os funcionários ativos.
- Validade é calculada por `setMonth` do JavaScript com o valor inteiro de meses informado. A validade ausente ou igual a zero não gera alerta. Vencidos são exibidos; validades futuras aparecem até 60 dias úteis, contando segunda a sexta e sem feriados.
- Uma renovação não apaga ocorrências anteriores nem suprime automaticamente o alerta antigo. Não existe cálculo de matriz obrigatória por cargo, estado de presença, certificado, aprovação financeira ou integração contábil.
- A lista Pessoas é a fonte única dos funcionários; o painel não implementa cadastro de usuário, senha, empresa/unidade ou histórico de situação separado.
