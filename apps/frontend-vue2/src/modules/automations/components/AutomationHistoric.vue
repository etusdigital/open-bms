<template>
  <transition name="slide-in">
    <div v-if="showHistoric" class="div-historic">
      <header class="header-historic">
        <h5>{{ $t('button.historic') }}</h5>
        <button class="close-button" @click="closeHistoric">
          <span class="material-symbols-rounded"> close </span>
        </button>
      </header>
      <div v-for="(audit, index) in audits" :key="audit.id">
        <div>
          <div
            class="historic-item"
            :class="[
              !audits[index + 1] ? 'historic-item-last' : '',
              index == 0 ? 'historic-item-first' : '',
              index == 0 && (!historicId || audit.id === historicId) ? 'historic-item-active' : '',
              audit.id === historicId ? 'historic-item-active' : '',
            ]"
            :id="'historic-item' + audit.id"
          >
            <div class="circle"></div>
            <div class="custom-border"></div>
            <div class="data-list">
              <p @click="changeAutomation">
                <span class="actualVersion" v-if="index == 0">{{ $t('button.actualVersion') }}</span>
                {{ audit.createdAt | formatDate(index == 0 ? dateTemplateActualVersion : dateTemplate) }}
              </p>
              <div class="author">
                <div class="circle-photo"></div>
                <p>{{ audit.user ? JSON.parse(audit.user).email : '' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { AuditDto } from '../dtos/audit.dto';
import { areObjectsEqual } from '../../../util/objects';

@Component({
  props: ['showHistoric', 'audits'],
})
export default class AutomationHistoric extends Vue {
  @Prop() showHistoric!: boolean;
  @Prop({ default: [] }) audits!: AuditDto[];

  currentAudit: AuditDto = [] as AuditDto;
  historicId = 0;
  dialog = false;
  dateTemplate = { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  dateTemplateActualVersion = { day: '2-digit', month: 'long', year: 'numeric' };

  beforeMount() {
    this.getValuesUrl();
  }

  closeHistoric() {
    this.$emit('closeHistoric');
  }

  changeAutomation(event: Event) {
    const parentElement = ((event.target as HTMLElement).parentNode as HTMLElement).parentNode as HTMLElement;
    this.historicId = parseInt(parentElement.id.replace('historic-item', ''), 10);
    const isActualVersion = parentElement.classList.contains('historic-item-first') ? true : false;
    document.querySelector('.historic-item-active')?.classList.remove('historic-item-active');
    parentElement.classList.add('historic-item-active');
    this.setValuesUrl();
    this.$emit(
      'changeAutomation',
      this.audits.find((x: any) => x.id === this.historicId),
      isActualVersion
    );
  }

  setValuesUrl() {
    if (!this.historicId) {
      return;
    }

    const query = {
      historicId: this.historicId.toString(),
    };

    if (areObjectsEqual(this.$route.query, query) === false) {
      this.$router.replace({ query });
    }
  }

  getValuesUrl() {
    if (this.$route.query) {
      this.historicId = this.$route.query.historicId ? parseInt(this.$route.query.historicId.toString(), 10) : 0;
    }
  }
}
</script>

<style lang="scss">
@import '@/assets/styles/variables.scss';

.div-historic {
  position: fixed;
  height: 100vh;
  width: 350px;
  right: 0;
  top: 0;
  background: white;
  box-shadow: 0px 4px 6px 0px rgba(0, 0, 0, 0.1), 0px 2px 4px 0px rgba(0, 0, 0, 0.06);
  z-index: 10;
}

.historic-list {
  overflow-y: auto;
  height: 92vh;
  width: 100%;
}

.historic-list::-webkit-scrollbar {
  width: 10px;
  border: none;
}

.historic-list::-webkit-scrollbar-thumb {
  background-color: #a6a6a6;
  border: none;
  border-radius: 8px;
}

.historic-list::-webkit-scrollbar-thumb:hover {
  background-color: #8b8b8b;
  border: none;
}

.historic-list::-webkit-scrollbar-track {
  background-color: transparent;
}

.slide-in-enter-active {
  transition: transform 0.3s;
}
.slide-in-leave-active {
  transition: transform 0.3s;
}

.slide-in-enter {
  transform: translateX(100%);
}
.slide-in-leave-to {
  transform: translateX(100%);
}

.historic-item-first {
  padding: 20px 16px 0px 20px !important;

  .custom-border {
    position: absolute;
    height: 70px;
    width: 1px;
    background: $ds-gray-300;
    margin-top: 10px;
    margin-left: 5px;
  }

  .data-list {
    padding-top: 0px !important;
    border: none !important;

    & > p {
      display: flex;
      flex-direction: row;
      align-items: center;
      height: fit-content;
    }
  }

  .circle {
    top: 26px !important;
    z-index: 10;
  }
}

.historic-item-last {
  .custom-border {
    position: absolute;
    height: 22px !important;
    width: 1px;
    background: $ds-gray-300;
    margin-top: 0;
    margin-left: 5px;
  }

  .data-list {
    border: none !important;
  }
}

.historic-item.historic-item-first.historic-item-last {
  .custom-border {
    display: none;
  }
}

.historic-item {
  position: relative;
  width: 100%;
  padding: 0px 16px 0px 20px;

  &:hover {
    background: $ds-gray-100;
  }
}

.historic-item-active {
  background: $ds-blue-100;
  &:hover {
    background: $ds-blue-100 !important;
  }

  .circle {
    background: $ds-blue !important;
  }

  .data-list {
    & > p {
      font-weight: 600;
    }

    .author {
      p {
        color: $ds-gray;
      }
    }
  }
}

.data-list {
  border-left: $ds-gray-300 1.5px solid;
  padding-bottom: 16px;
  padding-top: 20px;
  margin-left: 5px;

  & > p {
    font-size: 16px;
    color: $ds-blue;
    margin-bottom: 10px !important;
    margin-left: 20px;
  }

  & > p:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.circle {
  position: absolute;
  top: 22px;
  left: 21px;
  width: 10px;
  height: 10px;
  background: $ds-gray-300;
  border-radius: 50%;
}

.actualVersion {
  color: white;
  background: $ds-blue;
  padding: 3px 6px;
  font-size: 10px;
  border-radius: 20px;
  margin-right: 5px;
  font-weight: normal !important;
}

.author {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  margin: 16px 0px 5px 20px;

  p {
    font-size: 16px;
    margin-bottom: 0 !important;
    color: #a6a6a6;
    margin-left: 10px;
  }
}

.circle-photo {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: $ds-gray-300;
}

.header-historic {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 10px 20px 20px;

  h5 {
    margin-bottom: 0 !important;
    color: $ds-gray;
    font-weight: 600;
    font-size: 16px;
  }
}

.close-button {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 36px !important;
  width: 36px !important;
  border-radius: 18px;

  &:hover {
    background-color: #a6a6a617;
  }
}

.close {
  color: #a6a6a6 !important;
}
</style>
