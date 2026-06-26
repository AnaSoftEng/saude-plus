# Clean Architecture simulada

Esta reorganizacao separa o app em camadas para deixar dependencias e responsabilidades mais claras.

## Camadas

- `app`: composicao da aplicacao, ponto de entrada visual e rotas.
- `presentation`: telas e componentes React. Deve depender de `application`, nunca de detalhes de API diretamente.
- `application`: casos de uso do sistema, como autenticar usuario, listar agenda e montar relatorios.
- `domain`: regras puras e conceitos centrais, como niveis de acesso e montagem de consultas locais.
- `infrastructure`: detalhes externos, como APIs HTTP, sessao do navegador e PWA.

## Fluxo de dependencia

`presentation -> application -> domain`

`application -> infrastructure`

Na pratica, as telas chamam casos de uso. Os casos de uso aplicam regras e usam adaptadores de infraestrutura quando precisam falar com API ou storage.

## Fluxo de execucao

`Usuario -> frontend -> API HTTP -> backend/application -> repositories -> banco de dados`

A resposta volta no caminho inverso: banco de dados, repositories, backend/application, API HTTP, frontend. So entao a tela atualiza a acao do usuario.

## Proximos passos naturais

- Evoluir os repositories do backend para PostgreSQL sem alterar as telas.
- Criar testes unitarios para `domain` e `application`.
- Extrair formularios maiores das paginas para componentes menores quando o projeto crescer.
