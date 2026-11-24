# Categorias por conta

## Uso

Abra **Gerenciar categorias** no menu lateral. No celular, abra primeiro o menu. É possível criar uma categoria, renomear uma existente ou confirmar sua exclusão. As categorias iniciais também podem ser editadas e excluídas.

- Renomear atualiza os desejos associados em todas as listas da sua conta, incluindo itens já adquiridos.
- Excluir mantém os desejos, notas, preços e reservas. Os itens passam a aparecer como **Sem categoria**.
- O filtro e o formulário de desejos usam as categorias da conta.
- A exclusão de todas as categorias é permitida; novos desejos podem ficar sem categoria.
- Uma categoria de outra conta não pode ser alterada pelo seu identificador.
- Formulários antigos que tentem usar uma categoria removida ou renomeada recebem orientação para atualizar a página.

## Implantação

Esta alteração requer o código e a migração `0011_user_categories.sql` juntos. O inicializador SQLite executa as migrações pendentes sob transação ao abrir o banco. Não rode o SQL manualmente sobre a produção.

A migração SQL deste recurso foi escrita manualmente: os triggers de integridade fazem parte dela e não são representados apenas pelo schema Drizzle. Migrações geradas posteriormente precisam de revisão antes de serem aplicadas.

Antes de implantar, confira se o código do servidor mudou, obtenha backup consistente da base e verifique espaço disponível no volume usado pelo Docker. Prepare a imagem fora do servidor se faltar espaço. A atualização do serviço exige autorização do proprietário.

Reverter somente o código para a versão anterior mantém os novos dados, mas a interface e a validação antigas não suportam categorias personalizadas. Uma reversão precisa considerar essa incompatibilidade; restaurar um backup descarta alterações posteriores ao backup.

## Validação

`npm test` inclui a migração de uma base antiga sintética e a persistência após reinício. `npm run test:integration` verifica CRUD, autorização entre contas, renomeação/exclusão sem perda de desejos, reservas, compartilhamento, duplicidade Unicode e limite de categorias sob concorrência. `npm run test:e2e` inclui gerenciamento em desktop e celular, filtros, edição de desejos e renderização literal dos nomes.

Nenhum desses testes usa contas reais nem integrações pagas. A preparação desta alteração não modifica a instalação em produção.
