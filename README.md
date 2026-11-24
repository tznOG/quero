<img src="public/favicon.svg" width="56" alt="Marca do Quero">

# Quero

Um lugar para organizar desejos e compartilhar ideias de presente. Cada pessoa pode criar listas, reunir produtos, definir prioridades e enviar um link para quem quiser acompanhar ou reservar um presente.

[Abrir aplicação](https://quero.tznog.com) · [Arquitetura](docs/ARQUITETURA.md) · [Configuração](docs/CONFIGURACAO.md)

## O que dá para fazer

- Criar e editar listas e itens com nome, imagem, preço, categoria e link do produto.
- Criar, renomear e excluir categorias próprias em **Gerenciar categorias**. Elas valem para todas as listas da conta; excluir uma categoria mantém os desejos como “Sem categoria”.
- Organizar prioridades e acompanhar itens já adquiridos.
- Compartilhar listas por link, trocar esse link ou desativar o acesso.
- Reservar presentes e acompanhar listas de outras pessoas.
- Buscar, filtrar e alternar a apresentação dos itens, com opções de tema.
- Consultar links de busca de produtos; a consulta integrada de ofertas depende de uma chave SerpAPI.
- Criar conta, entrar, sair e trocar a senha.

O objetivo é reunir o que normalmente fica espalhado em mensagens e favoritos. A aplicação roda em um homelab. Os exemplos visuais da página inicial são demonstrativos; contas e listas reais não fazem parte deste repositório.

## Tecnologias

TypeScript, React, Next.js, Tailwind CSS e SQLite. Componentes de interface usam Radix/Base UI e shadcn. As consultas persistentes usam `node:sqlite`; o schema e as migrações ficam em `db/` e `drizzle/`. O lockfile registra as versões utilizadas.

## Executar localmente

Use Node.js 24 e npm. Na raiz:

```bash
git clone https://github.com/tznOG/quero.git
cd quero
npm ci
```

Copie `.env.example` para `.env.local` e mantenha os provedores vazios para conhecer o projeto sem integrações externas.

```bash
npm run dev
```

Abra `http://127.0.0.1:3000`. O banco é criado em `data/entre-nos.sqlite`, ignorado pelo Git. Use dados fictícios em sua instalação de demonstração.

Para executar o build de produção local:

```bash
npm run build
npm start
```

O servidor standalone lê as variáveis do processo; `.env.local` é usado pelo Next em desenvolvimento/build, mas não deve ser considerado um carregador de configuração do `npm start`. Veja [Configuração](docs/CONFIGURACAO.md) para definir a origem antes de iniciar.

## Organização

```text
app/
  WishlistApp.tsx          Interface principal e fluxos das listas
  SecurityForm.tsx         Troca de senha
  ThemePicker.tsx          Escolha do tema
  api/                    Rotas da aplicação e saúde
lib/
  auth.ts                 Contas, sessões e recuperação
  sqlite.ts               Acesso ao banco e migrações
  validation.ts, http.ts   Validação e regras HTTP
  offers.ts               Links de busca e integração de ofertas
db/, drizzle/             Schema e migrações SQL
public/                   Ícones e imagens da demonstração
tests/                    Testes de regras, API e interface
```

O nome interno `entre-nos` foi mantido nos scripts e no banco para preservar a compatibilidade com a instalação existente. O produto apresentado é o Quero.

## Testes e build

```bash
npm run typecheck
npm test
node tests/security-regression.mjs
node tests/proxy-security.mjs
npm run build
npm run test:integration
```

Os testes de integração criam um banco temporário, iniciam uma instância local e desabilitam os provedores externos. Cobrem contas, permissões sobre listas e itens, compartilhamento, reservas e revogação de sessão. Para a interface, instale o Chromium com `npx playwright install chromium` e execute `npm run test:e2e` após o build.

## Estado e limites

**A recuperação por e-mail está desativada na instalação atual**, e a interface informa isso. O código suporta o fluxo com provedor, mas ele só deve ser habilitado após configuração e teste do envio. Deixar `RESEND_API_KEY` e `MAIL_FROM` vazios mantém essa função desativada.

Links compartilhados dão acesso às informações exibidas na lista a quem possuir o endereço. A pessoa proprietária pode trocá-los ou desativá-los. Revogar o link não apaga cópias já feitas por alguém.

SQLite atende à implantação atual em uma instância. Alta disponibilidade e sincronização de dados entre múltiplos servidores não estão implementadas. O código conserva arquivos de uma configuração anterior para Cloudflare/preview; o caminho documentado e validado para este repositório é Next.js com Node e SQLite.

Antes de abrir uma instalação na internet, configure HTTPS, origem canônica, acesso ao proxy e backups privados. As configurações do servidor e os dados reais ficaram fora deste repositório. Capturas adicionais devem usar dados fictícios. A licença do projeto ainda não foi definida nesta revisão privada; avisos de terceiros existentes foram preservados.
