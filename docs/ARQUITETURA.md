# Arquitetura

`WishlistApp.tsx` coordena os fluxos de conta, listas, itens, compartilhamento e reservas. As ações passam pela API na mesma origem. A API valida os dados, identifica a conta e verifica a relação com o recurso antes de persistir mudanças.

`lib/auth.ts` mantém contas e sessões. O SQLite armazena perfis, listas, itens, relações de acompanhamento, reservas e controles auxiliares. `lib/sqlite.ts` adapta consultas e aplica migrações ao abrir uma base nova. Nenhuma base real é distribuída.

O compartilhamento usa um token na URL. A troca gera um endereço novo; a desativação remove a autorização associada ao token anterior. O acesso compartilhado expõe os campos previstos para a lista, sem dar acesso às funções privadas do proprietário.

Ofertas e e-mail são integrações opcionais, isoladas por configuração. Os links para pesquisar produtos continuam disponíveis sem consulta automática de ofertas. A interface informa quando a recuperação por e-mail está indisponível.

Categorias pertencem à conta e têm identificadores próprios. A migração `0011_user_categories.sql` cria as categorias iniciais para contas existentes, preserva os itens e instala a criação das categorias padrão para novas contas. O campo textual `items.category` permanece compatível com a API. Triggers validam a categoria na gravação e propagam renomeações/exclusões atomicamente, sempre restritas às listas do proprietário. A exclusão deixa o campo vazio, exibido como “Sem categoria”; não exclui desejos nem reservas. Categorias excluídas não são recriadas ao entrar novamente.

Nomes aceitam até 40 caracteres e são normalizados antes da verificação de duplicidade por conta, incluindo maiúsculas/minúsculas em português. Cada conta pode manter até 50 categorias. A visão compartilhada apresenta apenas as categorias dos desejos daquela lista, sem expor o catálogo privado completo.

`proxy.ts` aplica a política HTTPS configurada e cria o nonce da CSP. `next.config.ts` configura o build standalone e cabeçalhos. A segurança do transporte depende também do proxy e das restrições de rede da implantação.

Nesta publicação inicial, os arquivos de aplicação foram preservados da versão em operação. Foram acrescentados README, exemplos e documentação; os artefatos de infraestrutura e os segredos da instalação ficaram de fora. Os arquivos legados de Cloudflare/preview continuam identificáveis no código, mas não são o caminho validado de execução.
