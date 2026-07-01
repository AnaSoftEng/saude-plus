# Saude+

Sistema de gestao e agendamento de saude para clinicas, pacientes, medicos e administracao publica. O projeto esta organizado como monorepo, com frontend React e backend Node.js em uma arquitetura separada por camadas.

## Visao Geral

- `frontend/`: aplicacao React com Tailwind CSS, PWA, rotas protegidas e telas por perfil de usuario.
- `backend/`: API HTTP Node.js com casos de uso, entidades de dominio, repositories em memoria e suporte a PostgreSQL.
- `scripts/`: automacoes para iniciar o ambiente local e validar formatacao.

O frontend consome apenas a API HTTP em `/api/*`. Nao ha dados mockados diretamente nas telas.

## Funcionalidades

- Autenticacao com niveis de acesso.
- Cadastro de pacientes.
- Area do paciente com clinicas, consultas, exames, historico, downloads e perfil.
- Agendamento de consultas e exames com horarios disponiveis.
- Area do medico para acompanhar consultas e exames da propria clinica.
- Area do administrador de clinica para gerenciar consultas e exames.
- Area do admin master para gerenciar clinicas, usuarios e relatorios do sistema.
- PWA com service worker, manifest e suporte demonstrativo a notificacoes.
- Integracao opcional com Google Maps nas telas de clinica.

## Perfis

- `paciente`: agenda consultas e exames, acompanha historico e acessa downloads.
- `medico`: visualiza agenda, consultas e exames vinculados a sua clinica.
- `admin_clinica`: administra atendimentos da clinica.
- `admin_master`: administra clinicas, usuarios e relatorios gerais.

## Requisitos

- Node.js 18 ou superior.
- npm.
- PostgreSQL opcional, apenas se `REPOSITORY_DRIVER=postgres`.

## Configuracao

Copie o arquivo de exemplo da raiz e ajuste os valores locais:

```bash
cp .env.example .env
```

Variaveis principais:

```bash
PORT=3333
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
AUTH_RATE_LIMIT_JANELA_MS=900000
AUTH_RATE_LIMIT_MAX_TENTATIVAS=20
JWT_SECRET=substitua-por-um-segredo-local-com-32-caracteres-ou-mais
RECOVERY_SECRET=defina-um-codigo-temporario-apenas-para-desenvolvimento
ALLOW_DIRECT_PASSWORD_RECOVERY=false
PASSWORD_RECOVERY_CODE_TTL_MINUTES=10
PASSWORD_RECOVERY_MAX_ATTEMPTS=5
PASSWORD_RECOVERY_RESEND_INTERVAL_SECONDS=45
PASSWORD_RECOVERY_EMAIL_WEBHOOK_URL=
PASSWORD_RECOVERY_SMS_WEBHOOK_URL=
AUTH_COOKIE_ENABLED=false
REPOSITORY_DRIVER=memory
REACT_APP_BACKEND_URL=http://localhost:3333
REACT_APP_GOOGLE_MAPS_API_KEY=
REACT_APP_VAPID_PUBLIC_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@saude-plus.local
```

Para desenvolvimento simples, use `REPOSITORY_DRIVER=memory`.

Para PostgreSQL, configure:

```bash
REPOSITORY_DRIVER=postgres
DATABASE_URL=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saude_plus
DB_USER=saude_plus_app
DB_PASSWORD=sua_senha
DB_SSL=false
```

## Instalacao

Instale as dependencias da raiz, frontend e backend:

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

## Como Rodar

Na raiz do projeto, inicie frontend e backend juntos:

```bash
npm run iniciar
```

Aliases equivalentes:

```bash
npm run dev
```

Para rodar separadamente:

```bash
npm run backend
npm run frontend
```

Enderecos locais:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3333`
- API via proxy do frontend: `/api/*`

## Scripts

Scripts da raiz:

- `npm run iniciar`: inicia backend e frontend juntos.
- `npm run dev`: alias para iniciar o ambiente de desenvolvimento.
- `npm run frontend`: inicia somente o React.
- `npm run frontend:build`: gera build de producao em `frontend/build`.
- `npm run frontend:test`: roda os testes do frontend.
- `npm run backend`: inicia a API.
- `npm run backend:check`: valida sintaxe do backend.
- `npm run backend:test`: roda os testes do backend.
- `npm run lint`: executa ESLint no backend, frontend e scripts.
- `npm run format:check`: valida formatacao.
- `npm run compilar`: alias para `npm run frontend:build`.
- `npm run testar`: roda testes do backend e frontend.
- `npm run vercel:function:check`: valida o handler serverless usado no Vercel.
- `npm run deploy:check`: roda a bateria recomendada antes de publicar.

Scripts do backend:

- `npm --prefix backend run db:migrate`: executa migrations SQL.
- `npm --prefix backend run user:password -- email@saudeplus.com NovaSenhaForte`: redefine senha local de um usuario seed.

## Recuperacao De Senha

O fluxo real usa duas chamadas publicas:

- `POST /api/auth/recuperar-senha/solicitar` com `{ "email": "usuario@dominio.com", "canal": "email" }` ou `{ "email": "usuario@dominio.com", "canal": "sms" }`.
- `POST /api/auth/recuperar-senha/confirmar` com `{ "email": "usuario@dominio.com", "codigoRecuperacao": "123456", "novaSenha": "NovaSenhaForte" }`.

O codigo fica vinculado ao email da conta, armazenado como hash temporario, expira por `PASSWORD_RECOVERY_CODE_TTL_MINUTES`, bloqueia apos `PASSWORD_RECOVERY_MAX_ATTEMPTS` tentativas e limita novos envios a cada `PASSWORD_RECOVERY_RESEND_INTERVAL_SECONDS` segundos. Em desenvolvimento, sem webhook configurado, o codigo aparece no console do backend. Em producao, configure `PASSWORD_RECOVERY_EMAIL_WEBHOOK_URL` e/ou `PASSWORD_RECOVERY_SMS_WEBHOOK_URL` para integrar com o provedor de email/SMS.

## Banco De Dados

Em desenvolvimento, o sistema pode usar repositories em memoria:

```bash
REPOSITORY_DRIVER=memory
```

Para usar PostgreSQL:

1. Crie o banco e o usuario configurados no `.env`.
2. Defina `REPOSITORY_DRIVER=postgres`.
3. Execute as migrations:

```bash
npm --prefix backend run db:migrate
```

As migrations ficam em `backend/migrations/`.

## Deploy No Vercel

### Passo a passo rapido (CLI)

1. Instale o Vercel CLI e autentique:

```bash
npm i -g vercel
vercel login
```

2. Na raiz do monorepo, vincule o projeto:

```bash
vercel link
```

3. Configure as variaveis de ambiente de `Production` no painel da Vercel (Project Settings > Environment Variables) usando a lista deste README.

4. Rode os checks locais antes de publicar:

```bash
npm run deploy:check
```

5. Publique em preview:

```bash
vercel
```

6. Publique em producao:

```bash
vercel --prod
```

### Passo a passo rapido (Dashboard)

1. Crie um novo projeto na Vercel e importe este repositorio.
2. Mantenha `Root Directory` como a raiz do repositorio e confirme os comandos detectados pelo `vercel.json`.
3. Cadastre as variaveis de ambiente de producao antes do primeiro deploy.
4. Clique em **Deploy** e valide `/api/health` apos a publicacao.

O projeto ja inclui `vercel.json`, `.vercelignore` e uma Function em `api/[...path].js` para adaptar a API Node ao runtime serverless do Vercel. O frontend e compilado para `frontend/build`, e as rotas do React usam fallback para `index.html`.

Configuracao esperada no Vercel:

- Framework Preset: `Create React App` ou configuracao detectada pelo `vercel.json`.
- Root Directory: raiz do repositorio.
- Install Command: definido em `vercel.json`.
- Build Command: `npm run frontend:build`.
- Output Directory: `frontend/build`.
- API: `/api/*`.
- Health check: `/api/health` ou `/health`.

Variaveis de ambiente recomendadas para producao:

```bash
NODE_ENV=production
REPOSITORY_DRIVER=postgres
DATABASE_URL=sua_url_postgres
JWT_SECRET=um_segredo_forte_com_32_caracteres_ou_mais
RECOVERY_SECRET=outro_segredo_forte_com_32_caracteres_ou_mais
ALLOW_DIRECT_PASSWORD_RECOVERY=false
PASSWORD_RECOVERY_CODE_TTL_MINUTES=10
PASSWORD_RECOVERY_MAX_ATTEMPTS=5
PASSWORD_RECOVERY_RESEND_INTERVAL_SECONDS=45
PASSWORD_RECOVERY_EMAIL_WEBHOOK_URL=https://seu-provedor/email
PASSWORD_RECOVERY_SMS_WEBHOOK_URL=https://seu-provedor/sms
CORS_ORIGINS=https://seu-dominio.vercel.app
AUTH_RATE_LIMIT_JANELA_MS=900000
AUTH_RATE_LIMIT_MAX_TENTATIVAS=20
AUTH_COOKIE_ENABLED=true
COOKIE_SECURE=true
COOKIE_SAMESITE=Lax
REACT_APP_VAPID_PUBLIC_KEY=sua_chave_publica
VAPID_PUBLIC_KEY=sua_chave_publica
VAPID_PRIVATE_KEY=sua_chave_privada
VAPID_SUBJECT=mailto:admin@saude-plus.local
REACT_APP_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

Antes do deploy:

```bash
npm run deploy:check
```

Depois de configurar PostgreSQL, execute as migrations no ambiente que aponta para o banco de producao:

```bash
npm --prefix backend run db:migrate
```

Observacao: em producao, use PostgreSQL. O modo `memory` funciona para desenvolvimento, mas nao preserva dados entre execucoes serverless.

## Usuarios De Teste

Emails demonstrativos disponiveis nos seeds locais:

- `paciente@saudeplus.com`
- `admin@saudeplus.com`
- `master@saudeplus.com`
- `medico@saudeplus.com`

Senha comum das contas de teste: `teste12345`.

As senhas dos seeds ficam armazenadas como hash. Para definir uma senha local:

```bash
npm --prefix backend run user:password -- paciente@saudeplus.com teste12345
```

## Rotas Principais

Rotas publicas:

- `/login`
- `/cadastro`

Rotas do paciente:

- `/paciente/inicio`
- `/paciente/agendar`
- `/paciente/agendar-exame`
- `/paciente/consultas`
- `/paciente/exames`
- `/paciente/clinicas/:id`
- `/paciente/historico`
- `/paciente/downloads`
- `/paciente/perfil`

Rotas do medico:

- `/medico/agenda`
- `/medico/consultas`
- `/medico/exames`

Rotas do admin de clinica:

- `/admin/painel`
- `/admin/painel/consultas`
- `/admin/painel/exames`

Rotas do admin master:

- `/admin/master`
- `/admin/master/clinicas`
- `/admin/master/usuarios`
- `/admin/master/relatorios`

## PWA E Notificacoes

O frontend registra `/sw.js`, usa `/manifest.json` e pode ser instalado como PWA. Ao entrar em uma rota autenticada, o app exibe um modal explicando as notificacoes antes de solicitar a permissao do navegador.

Para subscriptions push reais, configure a chave publica VAPID no frontend e o par completo no backend:

```bash
REACT_APP_VAPID_PUBLIC_KEY=sua_chave_publica
VAPID_PUBLIC_KEY=sua_chave_publica
VAPID_PRIVATE_KEY=sua_chave_privada
VAPID_SUBJECT=mailto:admin@saude-plus.local
```

A chave privada VAPID deve ficar apenas no backend. Com as chaves configuradas, o backend usa `web-push` para enviar notificacoes remotas quando consultas e exames sao agendados.

## Google Maps

A tela de detalhes da clinica usa Google Maps quando ha chave configurada:

```bash
REACT_APP_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

Habilite Maps JavaScript API e geocodificacao no Google Cloud. Sem essa variavel, o sistema usa iframe/link do Google Maps como fallback para desenvolvimento.

## Arquitetura

Fluxo operacional:

1. Usuario interage com o frontend.
2. Frontend chama a API HTTP em `/api/*`.
3. API valida entrada, sessao e permissao.
4. API aciona casos de uso do backend.
5. Casos de uso aplicam regras de dominio.
6. Repositories consultam memoria local ou PostgreSQL.
7. Backend devolve o resultado para a API.
8. API responde ao frontend.
9. Frontend atualiza a tela.

Camadas principais:

```text
frontend/src/
  app/
  presentation/
  application/
  domain/
  infrastructure/

backend/src/
  application/
  domain/
  infrastructure/
  main/
```

## Testes E Validacao

Comandos uteis antes de abrir um PR ou publicar:

```bash
npm run backend:test
npm run frontend:test -- --watchAll=false --runInBand
npm run frontend:build
npm run lint
npm run vercel:function:check
npm run format:check
```

Para validar tudo em uma sequencia:

```bash
npm run testar
```

Para validar o pacote de deploy:

```bash
npm run deploy:check
```

## Seguranca

- Nunca versione `.env` com segredos reais.
- Use `JWT_SECRET` forte fora do desenvolvimento.
- Configure `RECOVERY_SECRET` fora do repositorio.
- Em producao, revise `CORS_ORIGINS` e use cookie HttpOnly/Secure para sessao.
- Nao persista token de sessao em `localStorage`.
- Mantenha `ALLOW_DIRECT_PASSWORD_RECOVERY=false` fora de desenvolvimento.
- Ajuste `AUTH_RATE_LIMIT_*` para limitar tentativas de login e recuperacao de senha.
- Anexos de resultados de exames aceitam apenas PDF, PNG, JPEG e TXT no MVP atual.
- Arquivos em `backend/data/*.json`, logs e builds sao artefatos locais.
- Consulte [SECURITY.md](./SECURITY.md) para regras de operacao segura e relato de vulnerabilidades.
