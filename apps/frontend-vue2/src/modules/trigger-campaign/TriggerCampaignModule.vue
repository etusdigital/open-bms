<template>
  <div class="c-cards">
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import LoadingService from '@/services/loading.service';

@Component({
  providers: [LoadingService],
})
export default class TriggerCampaignModule extends Vue {}
</script>
