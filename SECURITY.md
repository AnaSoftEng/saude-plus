# Politica de Seguranca

## Como Relatar

Nao abra issue publica com dados sensiveis. Envie o relato para o mantenedor do projeto com:

- rota, tela ou arquivo afetado;
- passos para reproduzir;
- impacto esperado;
- evidencias sem dados pessoais reais.

## Regras Minimas

- Nunca versionar `.env`, `backend/data/*.json`, logs, dumps ou backups.
- `JWT_SECRET` deve ter pelo menos 32 caracteres em producao.
- Senhas devem ser armazenadas apenas como hash `scrypt`.
- Toda rota `/api`, exceto login, recuperacao de senha e cadastro publico de paciente, exige sessao valida por cookie HttpOnly ou `Authorization: Bearer <token>` em ambiente controlado.
- O frontend nao deve persistir token de sessao em `localStorage`.
- CORS deve listar origens explicitas em `CORS_ORIGINS`; nao usar `*`.
- Requisicoes de escrita com sessao por cookie devem ter `Origin` permitido.
- Endpoints de autenticacao e recuperacao de senha devem ter limite de tentativas.
- Recuperacao direta por `RECOVERY_SECRET` deve permanecer desabilitada fora de desenvolvimento.
- Resultados de exames devem aceitar apenas tipos permitidos pelo backend: PDF, PNG, JPEG e TXT.
- Contas de teste devem ser rotacionadas antes de qualquer homologacao com dados reais.

## Dados Sensiveis

O projeto local usa repositórios em memoria com persistencia opcional em `backend/data`.
Esses arquivos sao artefatos de desenvolvimento e devem permanecer fora do Git.

## Checklist Antes de Publicar

```bash
npm run backend:check
npm run backend:test
npm run frontend:build
npm run lint
npm run format:check
```

## Escopo Atual

Este projeto implementa recuperacao de senha por e-mail/SMS via webhooks configurados por ambiente.
VAPID privado, banco PostgreSQL e provedores externos devem usar variaveis de ambiente e secrets gerenciados fora do repositorio.
