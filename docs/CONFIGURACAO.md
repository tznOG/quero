# Configuração

O modo de desenvolvimento carrega `.env.local` pelo Next.js. Para `npm start`, defina as variáveis do processo antes de iniciar. Exemplo PowerShell:

```powershell
$env:APP_ORIGIN = 'http://127.0.0.1:3000'
$env:DATABASE_PATH = 'data/entre-nos.sqlite'
npm start
```

No Linux/macOS:

```bash
APP_ORIGIN=http://127.0.0.1:3000 DATABASE_PATH=data/entre-nos.sqlite npm start
```

| Variável | Uso |
| --- | --- |
| `APP_ORIGIN` | Origem canônica para links, validação de origem e cookies. |
| `DATABASE_PATH` | Arquivo SQLite; o diretório é criado quando necessário. |
| `ENFORCE_HTTPS` | Redireciona para a origem HTTPS configurada quando `true`. |
| `TRUST_PROXY` | Permite considerar informações de proxy em conjunto com o isolamento da origem. |
| `ORIGIN_PROXY_ONLY` | Declara que a origem só pode ser alcançada pelo proxy confiável. Configure a restrição real de rede antes de ativar. |
| `SERPAPI_KEY` | Habilita consulta integrada de ofertas; pode envolver consumo pago. |
| `RESEND_API_KEY`, `MAIL_FROM` | Habilitam recuperação por e-mail em conjunto. Mantenha vazios nesta fase. |

O Dockerfile disponível compila a aplicação e usa usuário sem privilégios no runtime. A composição de produção, nomes de máquinas, configurações privadas e credenciais não acompanham o projeto. Para sua própria implantação, configure volume para o banco, backups e proxy HTTPS.

Os scripts de teste locais sobrescrevem as chaves dos provedores com valores vazios e usam um banco temporário. Evite executar testes apontando para dados reais. `scripts/backup-sqlite.mjs` é uma ferramenta de manutenção; o destino de backup deve permanecer privado.
