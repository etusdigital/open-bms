# Guia de Migração: Vue.js 2 e Vuetify 2 para Vue.js 3 e Vuetify 3

Este documento serve como orientação para a migração do projeto atual de **Vue.js 2** e **Vuetify 2** para **Vue.js 3** e **Vuetify 3**. Ele é elaborado para que desenvolvedores externos possam entender o projeto e auxiliar no processo de migração de forma eficiente e organizada.

## Índice

1. [Pré-Requisitos](#pré-requisitos)
2. [Backup e Controle de Versão](#backup-e-controle-de-versão)
3. [Atualização do Ambiente de Desenvolvimento](#atualização-do-ambiente-de-desenvolvimento)
4. [Atualização das Dependências](#atualização-das-dependências)
5. [Migração para Vue.js 3](#migração-para-vuejs-3)
6. [Migração para Vuetify 3](#migração-para-vuetify-3)
7. [Refatoração de Componentes](#refatoração-de-componentes)
8. [Atualização de Filtros](#atualização-de-filtros)
9. [Ajustes no TypeScript](#ajustes-no-typescript)
10. [Atualização das Configurações Globais](#atualização-das-configurações-globais)
11. [Atualização de Testes Automatizados](#atualização-de-testes-automatizados)
12. [Testes e Validação](#testes-e-validação)
13. [Remoção do Modo de Compatibilidade](#remoção-do-modo-de-compatibilidade)
14. [Considerações Finais](#considerações-finais)
15. [Referências](#referências)

---

## 1. Pré-Requisitos

Antes de iniciar a migração, certifique-se de que o ambiente de desenvolvimento atende aos seguintes requisitos:

- **Node.js**: Versão 14.x ou superior.
- **NPM ou Yarn**: Gerenciador de pacotes instalado.
- **Git**: Controle de versão utilizando Git.
- **Editor de Código**: Preferencialmente [Visual Studio Code](https://code.visualstudio.com/) com extensões recomendadas (Vetur, ESLint, Prettier).

## 2. Backup e Controle de Versão

1. **Clone o Repositório**: Assegure-se de ter uma cópia local do repositório.

    ```bash
    git clone https://github.com/seu-usuario/seu-repo.git
    cd seu-repo
    ```

2. **Crie uma Nova Branch**: Isolar as mudanças em uma branch dedicada.

    ```bash
    git checkout -b migration/vue3-vuetify3
    ```

## 3. Atualização do Ambiente de Desenvolvimento

1. **Atualize o Vue CLI**: Garanta que o Vue CLI está na versão mais recente que suporta Vue 3.

    ```bash
    npm install --global @vue/cli
    ```

2. **Considere Migrar para Vite**: Vite é altamente recomendado para projetos Vue 3 devido à sua performance e simplicidade.

    ```bash
    npm install vite @vitejs/plugin-vue --save-dev
    ```

    - **Configuração Básica do Vite** (`vite.config.js`):

      ```typescript:vite.config.js
      import { defineConfig } from 'vite';
      import vue from '@vitejs/plugin-vue';

      export default defineConfig({
        plugins: [vue()],
      });
      ```

    - **Atualize os Scripts no `package.json`**:

      ```json:package.json
      {
        "scripts": {
          "dev": "vite",
          "build": "vite build",
          "serve": "vite preview",
          "test": "vue-cli-service test:unit",
          "lint": "eslint --ext .ts,.tsx,.vue src/",
          "format": "prettier --write src/"
        }
      }
      ```

## 4. Atualização das Dependências

Atualize as dependências no `package.json` para versões compatíveis com Vue 3 e Vuetify 3.

### a. **Dependências Principais**

Atualize para versões que suportam Vue 3:

```json:package.json
{
  "dependencies": {
    "vue": "^3.2.0",
    "vue-router": "^4.0.0",
    "vuex": "^4.0.0",
    "vue-i18n": "^9.0.0",
    "vuetify": "^3.0.0",
    "vue-json-compare": "^3.0.0",
    "vue-multiselect": "^3.0.0" // Verifique a compatibilidade ou substitua se necessário
    // outras dependências...
  },
  "devDependencies": {
    "@vue/cli-plugin-babel": "^5.0.0",
    "@vue/cli-plugin-typescript": "^5.0.0",
    "@vue/cli-plugin-unit-jest": "^5.0.0",
    "@vue/cli-service": "^5.0.0",
    "@vue/runtime-dom": "^3.4.10",
    "@vue/test-utils": "^2.0.0", // Atualizado para suportar Vue 3
    "cypress": "^9.0.0", // Atualize para versão compatível
    "eslint": "^8.31.0",
    "eslint-config-prettier": "^8.6.0",
    "eslint-plugin-prettier": "^4.2.1",
    "eslint-plugin-sonarjs": "^0.5.0",
    "eslint-plugin-vue": "^9.8.0",
    "husky": "^8.0.3"
    // outras devDependencies...
  }
}
```

### b. **Instale as Dependências Atualizadas**

Após atualizar o `package.json`, instale as dependências:

```bash
npm install
```

### c. **Verifique a Compatibilidade de Outras Dependências**

Algumas dependências podem não ter versões compatíveis com Vue 3. Verifique cada uma e atualize ou substitua conforme necessário. Por exemplo:

- **vue-property-decorator**: Considere migrar para a API Composition do Vue 3 para reduzir a dependência de decoradores.
- **vue-cloak**: Verifique a necessidade ou substitua por alternativas nativas do Vue 3.

## 5. Migração para Vue.js 3

### a. **Instalar o Vue 3**

Remova o Vue 2 e instale o Vue 3:

```bash
npm uninstall vue
npm install vue@^3.2.0
```

### b. **Utilizar o Migration Build**

Para facilitar a migração, especialmente se planeja atualizar gradualmente seus componentes, utilize o **Migration Build** do Vue. Isso ajudará a identificar e resolver incompatibilidades durante o processo.

```bash
npm install @vue/compat
```

Em seu **main.ts**, configure o modo de compatibilidade:

```typescript:src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import store from './store';
import router from './router';
import vuetify from './plugins/vuetify'; // Certifique-se de criar conforme seção 6
import i18n from './i18n'; // Se estiver usando

const app = createApp(App);

// Plugins
app.use(router);
app.use(store);
app.use(vuetify);
app.use(i18n);

// Configuração de Compatibilidade Vue 2
app.config.compatConfig = { MODE: 3 };

// Montar a aplicação
app.mount('#app');
```

**Nota:** O uso de `Vue.use()` foi substituído pela API de plugins do Vue 3.

### c. **Resolver Avisos e Erros**

Utilizando o Migration Build, execute a aplicação e observe os avisos no console. Refatore o código conforme as recomendações do [Vue.js 3 Migration Guide](https://v3.vuejs.org/guide/migration/introduction.html) para resolver incompatibilidades.

## 6. Migração para Vuetify 3

### a. **Desinstalar o Vuetify 2**

Remova a versão antiga do Vuetify:

```bash
npm uninstall vuetify
```

### b. **Instalar o Vuetify 3**

Instale a versão mais recente do Vuetify compatível com o Vue 3:

```bash
npm install vuetify@^3.0.0
```

### c. **Configurar o Vuetify 3**

Crie um arquivo de configuração para o Vuetify (por exemplo, `src/plugins/vuetify.ts`):

```typescript:src/plugins/vuetify.ts
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

const vuetify = createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#0FB75C',
          secondary: '#FFC500',
          // Adicione outras cores conforme necessário
        },
      },
      dark: {
        colors: {
          primary: '#0FB75C',
          secondary: '#FFC500',
          // Adicione outras cores conforme necessário
        },
      },
    },
  },
});

export default vuetify;
```

### d. **Atualizar o Arquivo Principal para Utilizar o Vuetify 3**

Atualize o `main.ts` para incluir o Vuetify 3:

```typescript:src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import store from './store';
import router from './router';
import vuetify from './plugins/vuetify';
import i18n from './i18n'; // Se estiver usando

const app = createApp(App);

// Plugins
app.use(router);
app.use(store);
app.use(vuetify);
app.use(i18n);

// Configuração de Compatibilidade Vue 2
app.config.compatConfig = { MODE: 3 };

// Montar a aplicação
app.mount('#app');
```

### e. **Refatorar Componentes Vuetify**

A estrutura e as propriedades dos componentes do Vuetify 3 podem diferir da versão 2. Atualize seus componentes seguindo a [documentação oficial do Vuetify 3](https://vuetifyjs.com/en/getting-started/quick-start/) para ajustar a sintaxe e as funcionalidades conforme necessário.

**Exemplo de Atualização de um Botão:**

*Antes (Vuetify 2):*

```vue:src/App.vue
<template>
  <v-btn color="primary">Clique Aqui</v-btn>
</template>

<script lang="ts">
export default {
  name: 'App',
};
</script>
```

*Depois (Vuetify 3):*

```vue:src/App.vue
<template>
  <VBtn color="primary">Clique Aqui</VBtn>
</template>

<script setup lang="ts">
import { VBtn } from 'vuetify/components';
</script>
```

## 7. Refatoração de Componentes

### a. **Migrar para a API de Composition (Opcional, Mas Recomendado)**

A API de Composition oferece maior flexibilidade e melhor organização do código.

**Antes (Options API):**

```vue:src/components/ExampleComponent.vue
<template>
  <div>{{ message }}</div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      message: 'Olá Vue 2!',
    };
  },
};
</script>
```

**Depois (Composition API):**

```vue:src/components/ExampleComponent.vue
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const message = ref('Olá Vue 3!');
</script>
```

### b. **Atualizar Diretivas e Métodos Obsoletos**

Substitua ou remova diretivas que não são mais suportadas no Vue 3. Por exemplo, se você estiver usando filtros, considere substituí-los por **computed properties** ou **métodos**, conforme detalhado na seção [Atualização de Filtros](#atualização-de-filtros).

### c. **Atualizar Componentes Personalizados**

Refatore componentes que utilizam APIs específicas do Vue 2 para suas contrapartes do Vue 3.

**Exemplo: Atualização de um Componente com `beforeMount`**

*Antes (Vue 2):*

```typescript:src/modules/settings/components/PushConfig.vue
beforeMount() {
  this.pushStyle = this.pushConfigs?.pushStyle || {
    // estilos...
  };
}
```

*Depois (Vue 3):*

```typescript:src/modules/settings/components/PushConfig.vue
<script setup lang="ts">
import { ref, onBeforeMount } from 'vue';

const pushConfigs = ref(/* ... */);
const pushStyle = ref({
  logo: require('../../../assets/default-logo.png'),
  push: {
    position: 'fixed',
    display: 'flex',
    'flex-direction': 'column',
    'justify-content': 'flex-start',
    'align-items': 'flex-end',
    width: 'fit-content',
    top: '0',
    right: '50%',
    padding: '20px',
    background: '#ffffff',
    'border-radius': '0px',
    border: 'none',
    transform: 'translate(50%replaceForComma 0)',
    'z-index': 999999999,
    'box-shadow': ' 0px 1px 3px #0000001a',
  },
  // demais estilos...
});

onBeforeMount(() => {
  pushStyle.value = pushConfigs.value?.pushStyle || pushStyle.value;
});
</script>
```

## 8. Atualização de Filtros

Os filtros (`Vue.filter`) não são suportados no Vue 3. Utilize **computed properties** ou **métodos** para substituí-los.

**Antes (Vue 2):**

```typescript:src/main.ts
Vue.filter('formatDate', (value: any, options: any) => {
  if (value) {
    return new Date(value).toLocaleDateString(store.state.userLanguage, {
      ...(store.state.currentAccountTimezone && {
        timeZone: store.state.currentAccountTimezone,
      }),
      ...options,
    });
  } else {
    return '';
  }
});
```

**Depois (Vue 3):**

```vue:src/components/DateFormatter.vue
<template>
  <div>{{ formatDate(value) }}</div>
</template>

<script setup lang="ts">
import { useStore } from 'vuex';
import { computed, ref } from 'vue';

const store = useStore();
const value = ref('2023-10-01T12:00:00Z');

const formatDate = (date: string) => {
  if (date) {
    return new Date(date).toLocaleDateString(store.state.userLanguage, {
      ...(store.state.currentAccountTimezone && {
        timeZone: store.state.currentAccountTimezone,
      }),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } else {
    return '';
  }
};
</script>
```

## 9. Ajustes no TypeScript

1. **Atualize o `tsconfig.json`** para garantir compatibilidade com Vue 3:

    ```json:tsconfig.json
    {
      "compilerOptions": {
        "target": "esnext",
        "module": "esnext",
        "strict": true,
        "jsx": "preserve",
        "importHelpers": true,
        "moduleResolution": "node",
        "esModuleInterop": true,
        "sourceMap": true,
        "baseUrl": ".",
        "paths": {
          "@/*": ["src/*"]
        },
        "types": ["vite/client"]
      },
      "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
      "exclude": ["node_modules"]
    }
    ```

2. **Atualize as Tipagens**:

    - Certifique-se de que todas as interfaces e tipos são compatíveis com Vue 3.
    - Remova ou atualize declarações que utilizam APIs antigas de Vue 2.

3. **Remova `Vue.extend` e `Vue.component`**:

    Utilize `defineComponent` ou a API de Composition no lugar.

    **Antes (Vue 2):**

    ```typescript:src/components/OldComponent.vue
    <script lang="ts">
    import Vue from 'vue';

    export default Vue.extend({
      // opções do componente
    });
    </script>
    ```

    **Depois (Vue 3):**

    ```typescript:src/components/NewComponent.vue
    <script setup lang="ts">
    import { defineComponent } from 'vue';

    export default defineComponent({
      // opções do componente
    });
    </script>
    ```

## 10. Atualização das Configurações Globais

### a. **Plugins Globais**

Substitua `Vue.use()` pela nova API de plugins do Vue 3.

**Antes (Vue 2):**

```typescript:src/main.ts
Vue.use(VueTypeScriptInject);
Vue.use(VModal, { dialog: true });
```

**Depois (Vue 3):**

```typescript:src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import VueTypeScriptInject from 'vue-typescript-inject';
import VModal from 'vue-js-modal';

const app = createApp(App);

app.use(VueTypeScriptInject);
app.use(VModal, { dialog: true });
```

### b. **Remover Filtros Vue**

Como os filtros não são suportados no Vue 3, remova todas as declarações de filtros e substitua por métodos ou computed properties nos componentes individuais. Consulte a seção [Atualização de Filtros](#atualização-de-filtros) para mais detalhes.

### c. **Atualizar Filtros Personalizados**

Se houver funcionalidades customizadas que dependem de filtros, refatore-as para utilizar métodos ou funções auxiliares.

## 11. Atualização de Testes Automatizados

### a. **Atualize o Cypress**

Certifique-se de que o Cypress está atualizado para suportar Vue 3.

```bash
npm install cypress@latest --save-dev
```

### b. **Ajuste as Interceptações e Seletores**

Verifique se as URLs das APIs e os seletores de elementos HTML não foram alterados durante a migração. Atualize os testes conforme necessário.

**Exemplo: Atualização de um Teste Cypress**

*Antes (Vue 2):*

```typescript:cypress/integration/automations/write-email.spec.ts
describe('WriteEmail', () => {
  before(() => {
    //@ts-ignore
    cy.identityServerAPILogin();
  });

  it('deve ser possível escolher o tipo de automação', () => {
    cy.get('[data-cy=automation-link]').click();
    cy.get('[data-cy=automation-email]').click();
    cy.get('[data-cy=btn-confirm]').click();
    cy.get('[data-cy=add-automation-message-btn]').click();
  });

  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:5000/audiences/activecampaign', {
      name: 'quiz_answer_last30d_creditoimediato',
      id: '62279',
    });
    cy.intercept('GET', 'http://localhost:5000/automations/messages', {
      id: 1,
      title: 'Message',
      subject: 'SAAD',
      content: 'SVD',
      fromMail: 'SCS',
      fromName: 'CSDK',
      isTested: false,
      createdAt: '2021-03-10T13:37:29.189Z',
      updatedAt: '2021-03-10T13:37:29.189Z',
      deletedAt: null,
    });
    cy.intercept('GET', 'http://localhost:5000/automations', []);
  });

  it('deve ser exibido input Titulo da mensagem', () => {
    cy.get('[data-cy=automation-message-title]').should('be.visible');
  });

  it('deve ser exibido um tooltip ao lado do Titulo da Mensagem ', () => {
    cy.get('[data-cy=automation-message-title-info]').trigger('mouseenter');

    cy.get('[data-cy=automation-message-title-tooltip]').should('be.visible');
  });
});
```

*Depois (Vue 3):*

```typescript:cypress/integration/automations/write-email.spec.ts
describe('WriteEmail', () => {
  before(() => {
    // @ts-ignore
    cy.identityServerAPILogin();
  });

  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:5000/audiences/activecampaign', {
      name: 'quiz_answer_last30d_creditoimediato',
      id: '62279',
    }).as('getActiveCampaign');

    cy.intercept('GET', 'http://localhost:5000/automations/messages', {
      id: 1,
      title: 'Message',
      subject: 'SAAD',
      content: 'SVD',
      fromMail: 'SCS',
      fromName: 'CSDK',
      isTested: false,
      createdAt: '2021-03-10T13:37:29.189Z',
      updatedAt: '2021-03-10T13:37:29.189Z',
      deletedAt: null,
    }).as('getAutomationMessages');

    cy.intercept('GET', 'http://localhost:5000/automations', []).as('getAutomations');

    cy.visit('/automations');
    cy.wait(['@getActiveCampaign', '@getAutomationMessages', '@getAutomations']);
  });

  it('deve ser possível escolher o tipo de automação', () => {
    cy.get('[data-cy=automation-link]').click();
    cy.get('[data-cy=automation-email]').click();
    cy.get('[data-cy=btn-confirm]').click();
    cy.get('[data-cy=add-automation-message-btn]').click();
  });

  it('deve ser exibido input Titulo da mensagem', () => {
    cy.get('[data-cy=automation-message-title]').should('be.visible');
  });

  it('deve ser exibido um tooltip ao lado do Titulo da Mensagem ', () => {
    cy.get('[data-cy=automation-message-title-info]').trigger('mouseenter');

    cy.get('[data-cy=automation-message-title-tooltip]').should('be.visible');
  });
});
```

### c. **Atualize o Vue Test Utils**

Atualize o Vue Test Utils para a versão compatível com Vue 3:

```bash
npm install @vue/test-utils@^2.0.0 --save-dev
```

### d. **Ajuste os Testes Unitários**

Refatore os testes unitários para utilizar a nova API do Vue 3.

**Exemplo: Atualização de um Teste Unitário**

*Antes (Vue 2):*

```typescript:tests/unit/ExampleComponent.spec.ts
import { shallowMount } from '@vue/test-utils';
import ExampleComponent from '@/components/ExampleComponent.vue';

describe('ExampleComponent.vue', () => {
  it('renders props.msg when passed', () => {
    const msg = 'new message';
    const wrapper = shallowMount(ExampleComponent, {
      propsData: { msg },
    });
    expect(wrapper.text()).toMatch(msg);
  });
});
```

*Depois (Vue 3):*

```typescript:tests/unit/ExampleComponent.spec.ts
import { shallowMount } from '@vue/test-utils';
import ExampleComponent from '@/components/ExampleComponent.vue';

describe('ExampleComponent.vue', () => {
  it('renders props.msg when passed', () => {
    const msg = 'new message';
    const wrapper = shallowMount(ExampleComponent, {
      props: { msg },
    });
    expect(wrapper.text()).toContain(msg);
  });
});
```

## 12. Testes e Validação

### a. **Execute Todos os Testes Automatizados**

Rode todos os testes disponíveis para identificar possíveis quebras decorrentes da migração.

```bash
npm run test
npm run cypress:open
```

### b. **Teste Manualmente as Principais Funcionalidades**

Percorra a aplicação manualmente para identificar quaisquer comportamentos inesperados ou erros não capturados pelos testes automatizados.

### c. **Verifique a Performance**

Compare a performance da aplicação antes e depois da migração para garantir que não houve regressões.

## 13. Remoção do Modo de Compatibilidade

Após resolver todas as incompatibilidades e garantir que a aplicação está funcionando corretamente no Vue 3 e Vuetify 3:

### a. **Remova o Migration Build**

Atualize o `main.ts` para não utilizar o modo de compatibilidade.

```typescript:src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import store from './store';
import router from './router';
import vuetify from './plugins/vuetify';
import i18n from './i18n'; // Se estiver usando
import VueTypeScriptInject from 'vue-typescript-inject';
import VModal from 'vue-js-modal';

const app = createApp(App);

// Plugins
app.use(VueTypeScriptInject);
app.use(VModal, { dialog: true });
app.use(vuetify);
app.use(router);
app.use(store);
app.use(i18n);

app.mount('#app');
```

### b. **Remova o `@vue/compat`**

```bash
npm uninstall @vue/compat
```

### c. **Finalize a Migração**

- **Remova quaisquer dependências não utilizadas.**
- **Atualize componentes para utilizar plenamente as funcionalidades do Vue 3 e Vuetify 3.**
- **Aprimore o código conforme as melhores práticas para Vue 3.**

## 14. Considerações Finais

A migração de **Vue.js 2** para **Vue.js 3** e de **Vuetify 2** para **Vuetify 3** proporciona melhorias significativas em performance, modularidade e acesso a novas funcionalidades. Embora o objetivo seja realizar a migração de forma simples e com o mínimo de alterações, algumas adaptações de código e reestruturações serão necessárias para garantir a compatibilidade e a otimização do projeto.

**Dicas Adicionais:**

- **Leia os Avisos do Migration Build**: Eles ajudarão a identificar áreas problemáticas no código.
- **Atualize Gradualmente**: Se possível, migre componentes de forma incremental em vez de tentar atualizar tudo de uma vez.
- **Utilize a Documentação Oficial**: As guias de migração do [Vue.js 3](https://v3.vuejs.org/guide/migration/introduction.html) e do [Vuetify 3](https://vuetifyjs.com/en/getting-started/quick-start/) são recursos valiosos.
- **Comunique-se**: Mantenha uma linha aberta de comunicação com a equipe para resolver dúvidas e compartilhar progressos.

## 15. Referências

1. [Vue.js 3 Migration Guide](https://v3.vuejs.org/guide/migration/introduction.html)
2. [Vuetify 3 Documentation](https://vuetifyjs.com/en/getting-started/quick-start/)
3. [Vite - Next Generation Frontend Tooling](https://vitejs.dev/)
4. [Vue Router 4 Documentation](https://next.router.vuejs.org/)
5. [Vuex 4 Documentation](https://next.vuex.vuejs.org/)
6. [Vue I18n 9 Documentation](https://vue-i18n.intlify.dev/)
7. [TypeScript Migration](https://v3.vuejs.org/guide/typescript-support.html)
8. [Cypress Documentation](https://docs.cypress.io/)
9. [Vue CLI Documentation](https://cli.vuejs.org/)
10. [Vue 2 EOL Announcement](https://v2.vuejs.org/v2/guide/migration-overview.html)

---

**Nota:** Este guia foi elaborado com base nos snippets de código e documentação fornecidos. Ajustes específicos podem ser necessários dependendo das particularidades do projeto. Em caso de dúvidas ou dificuldades durante a migração, consulte a documentação oficial ou procure assistência adicional.
