# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Type Support For `.vue` Imports in TS

Since TypeScript cannot handle type information for `.vue` imports, they are shimmed to be a generic Vue component type by default. In most cases this is fine if you don't really care about component prop types outside of templates. However, if you wish to get actual prop types in `.vue` imports (for example to get props validation when using manual `h(...)` calls), you can enable Volar's Take Over mode by following these steps:

1. Run `Extensions: Show Built-in Extensions` from VS Code's command palette, look for `TypeScript and JavaScript Language Features`, then right click and select `Disable (Workspace)`. By default, Take Over mode will enable itself if the default TypeScript extension is disabled.
2. Reload the VS Code window by running `Developer: Reload Window` from the command palette.

You can learn more about Take Over mode [here](https://github.com/johnsoncodehk/volar/discussions/471).

## Auth

After cloning app is necessary create the .env.local file and input props:

```bash
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
```

## ENV

Create the .env.local file and fill it with the following:

```bash
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_CALLBACK_URL=
VITE_APP_REDIRECT_MSGOPS=
VITE_API_MSGOPS=
```

## Como funciona?

Esse projeto se baseia no framework vue3 com typescript utilizando o Vite como a ferramenta principal de compilacao e rollup.

Além disso o projeto possui TailwindCSS como framework CSS configurado para manter o prefixo "tw" em suas classes. Na parte de recomendação de extensões do GitHub `.vscode/extensions.json` é recomendado utilizar Prettier com o Tailwind de uma forma otimizar e corrigir pequenos problemas de ordenação na utilização de classes.

Para facilitar as migrações neste inicio também consta configurado o Vuetify3 para biblioeteca de componentes, com isso deixa a liberdade para os devs porém recomendo fortemente utilizar sempre o Tailwindcss. (Alguns componentes foram criados apenas com o TailwindCSS).

A estrutura do projeto não é modular por dominio e sim por camadas, ou seja, temos uma pasta para cada camada e essa pode se comunicar com qualquer outra camada.

- /foundation: Uma tentativa de tornar acessível um conceito técnico e importante para a construção de aplicações e design system, aqui temos a definição de forma mais pura os valores compartilhados de cores, fonte, tamanho, espaçamentos.
  
- /src
  - /components: Pasta destinada aos components compartilhados, seja entre paginas, entre modulos ou até mesmo entre outros componentes, a forma interna não é uma questão mas recomendo a leitura sobre componentização do bradfrost. O mais correto seria nao ter regra de negocio dentro destes componentes e sim variaveis logicas que podem ou nao mudar o comportamento do componente.

  - /entities: Como estamos trabalhando em um projeto de Typescript é muito comum utilizar do recurso de Types para conseguir definir todas as entidades da nossa aplicacao e relacionar entre elas. Além disso, um erro comum é colocar regra de entidade dentro de tela, por exemplo para criar um usuario x precisa ter as regras Y, se isso ficar na tela de cadastro de usuario, caso queira criar um widget de criacao em outra parte do sistema, precisa de uma refatoração desnecessaria.

  - /gateways: Camada onde conversamos com outros sistemas, sejá uma api interna, um serviço e até mesmo uma sdk, focalizando em uma camada externa podendo realizar testes e de forma isolada até criar mocks especializados.
    - Cada gateway deve ser configurado como uma classe singleton, E ter a exportação de classe já instanciada com seu nome camelCase e outro que é a propria classe sem ser instanciada como PascalCase.

  - /i18n: Configuracao e estrutura da lib vue-i18n, responsavel por tornar nossa aplicacao global.

  - /infra: Responsável por configurar libs estruturais como por exemplo: HttpClient, Auth e etc. Com isso para alterar a aplicacao de uma forma mais responsavel nao ficamos vinculados dependente de nehuma lib.
    - Deve ser aplicado o pattern de Adapter nos recursos de infra, um exemplo é o HttpClient, que no momento possui um adapter do Axios, mas nada impede de utilizar Fetch ou até mesmo testar nova lib sem impactar todos os Gateways, pois podemos instanciar um Gateway passando qualquer Adapter que respeite o HttpClient.

  - /pages: Componentes que são base de roteamento do vue, realmente paginas.

  - /plugins

  - /stores: Estamos utilizando o plinia, com isso toda a store fica definida nesta pasta. Recomendo a leitura do plinia por ter alterado bastante a estrutura mas para o melhor.

Podemos reparar que todo arquivo possui um `index.ts` que é basicamente a raiz da exportação da camada. Para evitar ficar dando nested folders, apenas da raiz da camada poderá importar tudo que a camada exportaria.

Exemplo:

index.ts

```ts
  export type { UserGateway } from './UserGateway.types';
  export { UserHttpGateway, userHttpGateway } from './UserHttpGateway';
```

Apenas um barramento de exportação dos recursos.
