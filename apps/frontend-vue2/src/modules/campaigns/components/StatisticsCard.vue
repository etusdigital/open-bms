<template>
  <v-card class="statistics-card d-flex justify-center col-6">
    <div>
      <div>
        <div class="d-flex align-center">
          <span class="material-symbols-rounded icon" size="25" :style="`--color: ${color}`"> {{ icon }} </span>
          <p class="card-title title">{{ title }}</p>
        </div>
      </div>
      <div class="d-flex mt-5 justify-center">
        <p class="card-description">{{ value ? value : 0 }}</p>
      </div>
    </div>
  </v-card>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';

@Component({
  props: ['title', 'icon', 'value', 'color'],
})
export default class StatisticsCard extends Vue {
  title = '';
  value = 0;
  icon = '';
  color = '';

  beforeMount() {
    this.title = this.$props.title;
    this.value = this.$props.value;
    this.icon = this.$props.icon;
    this.color = this.$props.color;
  }
}
</script>

<style scoped lang="scss">
.statistics-card {
  max-width: 100% !important;
  height: 110px !important;
  border-radius: 16px;
}

.card-title {
  font-size: 20px;
  text-align: center;
  margin: 0px !important;
  margin-left: 5px !important;
}

.card-description {
  font-size: 24px;
}

::v-deep.theme--light.v-icon {
  color: var(--color) !important;
}
</style>
