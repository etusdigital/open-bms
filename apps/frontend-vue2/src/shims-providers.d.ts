// Augment the Vue component options so `providers: [...]` (used by
// vue-typescript-inject) type-checks in @Component decorators across the app.
import 'vue/types/options';

declare module 'vue/types/options' {
  interface ComponentOptions<V> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providers?: any[];
  }
}
