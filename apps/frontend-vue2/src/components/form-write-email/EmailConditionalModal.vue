<template>
  <div class="view-conditional-modal">
    <div class="conditional">
      <div class="row">
        <div class="col-12">
          <label>{{ $t('modal.tutorial') }}</label>
          <div class="conditional_sample">
            <div class="d-flex justify-end conditional_sample__copy">
              <div v-tooltip.right="showCopyedMessage ? $t('datatable.exampleCopied') : $t('datatable.copyExample')">
                <span
                  class="material-symbols-rounded ds-gray-color font-20 cursor-pointer"
                  @mouseleave="onClipboardLeave"
                  @click="copyToCLipboard()"
                >
                  content_copy
                </span>
              </div>
            </div>
            {{ conditional }}
          </div>
          <label>
            {{ $t('modal.availableFields') }} <strong>customFields</strong>(Ex:
            {{ $t('datatable.negatedCustomFiled') }}) {{ $t('datatable.and') }} <strong>tags</strong>(Ex:
            {{ $t('datatable.negatedTag') }})
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({
  components: {},
})
export default class EmailConditionalModal extends Vue {
  showCopyedMessage = false;

  conditional = ` {{#if customFields.negativado}}
    <p>${this.$t('datatable.negated')}</p>
  {{else}}
    <p>${this.$t('datatable.notNegated')}</p>
  {{/if}}`;

  closeModal() {
    this.$emit('emitData');
  }

  onClipboardLeave() {
    this.showCopyedMessage = false;
  }

  copyToCLipboard() {
    navigator.clipboard.writeText(this.conditional);
    this.showCopyedMessage = true;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.view-conditional-modal {
  .dialog-button {
    width: 100%;
  }
  .dialog-buttons button:first-child {
    margin: 0 !important;
  }
}

.conditional_sample {
  margin: 1em 0;
  padding: 0.5em;
  background: #e7e7e7;
  white-space: pre;
  position: relative;
}

.conditional_sample__copy {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
}
</style>
