<template>
  <div class="card">
    <iframe class="preview" :srcdoc="renderHtml()" frameborder="0"></iframe>
    <div class="footer-buttons mt-3 mb-3 mr-3">
      <button class="draft-button" type="button" @click="openTemplateImprove()">Selecionar</button>
    </div>

    <div v-if="showTemplateImprove" class="modal-overlay" @click="closeTemplateImprove">
      <div class="modal-container" @click.stop>
        <MessageTemplateImprove
          :content="message.html"
          :messageId="message.id"
          @closeModal="closeTemplateImprove"
          @createdTemplateMessage="createdTemplateMessage"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import MessageTemplateImprove from './MessageTemplateImprove.vue';
import store from '@/store';
import { ActionHandler, mapState } from 'vuex';
import CampaignRuleService from '@/modules/campaigns-rules/services/campaign-rule.service';

@Component({
  components: { ButtonDefault, MessageTemplateImprove },
  props: ['message'],
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class CampaignRuleContentCard extends Vue {
  private readonly campaignRuleService = new CampaignRuleService();
  newCampaign: any = { date: new Date(), ruleId: 0 };
  rules: any = [];
  @Prop() message!: any;

  showTemplateImprove = false;

  renderHtml() {
    if (!this.message) {
      return '';
    }

    return `
      <html>
        <head>
          <style>
            body {
              transform: scale(0.7);
              transform-origin: top left;
              width: 125%; /* compensar o scale para evitar corte lateral */
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${this.message.html}
        </body>
      </html>
    `;
  }

  openTemplateImprove() {
    this.showTemplateImprove = true;
  }

  closeTemplateImprove() {
    this.showTemplateImprove = false;
  }

  handleSaveTemplate(templateData: any) {
    this.closeTemplateImprove();
  }

  createdTemplateMessage(createdMessage: any) {
    this.$emit('createdTemplateMessage', createdMessage);
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview {
  height: 250px;
  border: none;
}

.draft-button {
  width: 100px;
  height: 36px;
  border-radius: 8px;
  border: 2px solid #0057f4;
  font-size: 12px;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: 0.07em;
  color: #0057f4;
  text-transform: uppercase;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #0057f4;
    color: white;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 20px;
}
</style>
