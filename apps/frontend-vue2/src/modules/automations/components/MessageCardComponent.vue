<template>
  <div class="view-message-card card-info" :class="{ 'step-validate-error': stepError }">
    <div v-if="step.type === 'testAB'">
      <div class="message-header align-items-center d-flex justify-space-between">
        <div
          class="message-title d-flex cursor-pointer"
          @click="step.settings.status === 'notStarted' || !step.settings.status ? editCard(step) : () => {}"
        >
          <div class="div-icon-email" :class="step.settings.status === 'finished' ? 'div-icon-winner' : ''">
            <span
              class="material-symbols-rounded font-24 icon-email icon-color"
              v-if="step.settings.status === 'finished'"
            >
              {{ renderIcon(step.type + 'Winner') }}
            </span>
            <img class="img-icon" src="@/assets/campaign_test_ab.svg" alt="test a/b icon" v-else />
          </div>
          <span class="ml-1 mt-1 text-info-color" v-if="step.settings.status !== 'finished'"
            >{{ $t('datatable.send') }} {{ $t('datatable.testAB') }}</span
          >
          <span class="ml-1 text-winner-color" v-else>
            <p class="text-winner-color">{{ $t('datatable.sendWinnerMessage') }}</p>
            <p class="text-winner-title">{{ winnerMessage.title }}</p>
          </span>
        </div>
        <div v-if="step.settings.status === 'notStarted'">
          <button type="button" class="view-button" @click="editCard(step)">
            <span class="material-symbols-rounded ds-white-color">edit</span>
          </button>
        </div>
        <div v-if="step.settings.status === 'finished'">
          <button type="button" class="view-button" @click="viewMessage(winnerMessage.id)">
            <span class="material-symbols-rounded ds-white-color">visibility</span>
          </button>
        </div>
        <div class="mt-1" v-else-if="step.settings.status === 'running'">
          <img src="@/assets/scheduled_fill.svg" alt="scheduled icon" class="mr-2" />
          <span class="time-left" :title="step.settings.endDate | formatDateTime">
            {{ $t('title.timeLeft') }}: {{ getTimeLeft(new Date(step.settings.endDate)) }}
          </span>
        </div>
      </div>
      <template v-if="step.settings.status !== 'finished'">
        <div style="display: flex; align-items: baseline">
          <label class="label-title-small mb-0 mt-4 mr-1">{{ $t('datatable.winnerCriteria') }}: </label>
          <p class="mb-0 winner-criteria">{{ $t(`input.${step.settings.winnerCriteria}Rate`) }}</p>
        </div>
        <div>
          <div v-for="(message, index) in step.settings.messages" class="d-flex mt-3" style="gap: 8px" :key="index">
            <div class="message">
              <div class="message-content">
                <h4>{{ $t('datatable.message') }} {{ numberToLetter(index + 1) }}: {{ message.title }}</h4>
                <p class="mb-0">{{ $t('datatable.subject') }}: {{ message.subject }}</p>
              </div>
              <button type="button" class="view-button" @click="viewMessage(message.id, index)">
                <span class="material-symbols-rounded ds-light-gray-color">visibility</span>
              </button>
            </div>
            <div
              class="rate"
              :class="{
                'rate-winner':
                  step.settings.status !== 'notStarted' && index === getWinnerValueIndex(step.settings.winnerCriteria),
                'rate-loser':
                  step.settings.status !== 'notStarted' && index !== getWinnerValueIndex(step.settings.winnerCriteria),
              }"
            >
              <div class="d-flex" style="gap: 4px">
                <span class="material-symbols-rounded icon font-16" v-if="step.settings.winnerCriteria === 'click'">
                  web_traffic
                </span>
                <span class="material-symbols-rounded icon font-16" v-else>drafts</span>
                <p class="mb-0 statistic-name">{{ $t(`title.${step.settings.winnerCriteria}`) }}</p>
              </div>
              <div class="div-row align-items-baseline gap-5">
                <p class="font-16 text-600 mb-0">
                  {{
                    calculatePercentage(
                      testABStatistics[index][step.settings.winnerCriteria],
                      testABStatistics[index][get2ParamForCalculatePercentage(step.settings.winnerCriteria)]
                    ) || formatNumber
                  }}%
                </p>
                <p class="mb-0">
                  {{ numberFormat(testABStatistics[index][step.settings.winnerCriteria]) || 0 }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-5 d-flex justify-space-between align-items-center">
          <div class="total-delivered div-row align-items-center">
            <span class="material-symbols-rounded ds-gray-color font-20">mail</span>
            <h4 class="mb-0 ds-gray-color">{{ $t('datatable.totalDelivered') }}: {{ totalDelivered }}</h4>
          </div>
          <div class="d-flex">
            <button
              class="button-outlined default-button background-white"
              @click="
                () => {
                  showMoreStatistics = true;
                }
              "
            >
              {{ $t('button.moreStatistics') }}
            </button>
            <button v-if="$store.getters.can('infra:manage')" class="default-button btn-red ml-2" @click="finishTest">
              {{ $t('button.finishTest') }}
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="message-content mt-3 mb-5">
          <div class="message-content mt-3 mb-5">
            <span class="font-12 text-600">{{ $t('datatable.subject') }}: {{ winnerMessage.subject }}</span>
            <div
              v-if="winnerMessage.links && winnerMessage.links.length"
              :class="[isWinnerLinks ? 'div-column' : 'div-row gap-5 w-100']"
            >
              <span class="ds-gray-color font-12 text-600">Link(s):</span>
              <div
                class="div-column font-12"
                :class="[!isWinnerLinks || winnerMessage.links.length === 1 ? 'single-link' : 'w-100']"
              >
                <a
                  v-for="(links, index) in winnerLinks"
                  :key="'ctaLink' + index"
                  :href="`${links}`"
                  target="_blank"
                  class="ds-blue-color links-decoration"
                >
                  {{ links }}
                </a>
              </div>
            </div>
            <button
              class="open-links text-600 font-10 mt-1"
              v-on:click="isWinnerLinks = !isWinnerLinks"
              v-if="winnerMessage.links && winnerMessage.links.length > 1"
            >
              {{ isWinnerLinks ? $t('input.showLess') : $t('input.showMore') }}
            </button>
          </div>
        </div>
        <div class="statistics">
          <div class="d-flex" style="width: fit-content; gap: 8px" v-if="Object.keys(internalStatistics).length">
            <div
              v-for="(statisticOption, statisticIndex) in statisticsOptions"
              class="rate"
              style="width: 135px !important"
              :key="statisticIndex"
            >
              <div class="d-flex mb-2" style="gap: 4px">
                <span class="material-symbols-rounded font-12" v-if="statisticOption.isMaterial">{{
                  statisticOption.icon
                }}</span>
                <img :src="statisticOption.icon" class="icon" v-else />
                <p class="mb-0 statistic-name font-10">{{ statisticOption.value }}</p>
              </div>
              <div class="div-row align-items-baseline gap-5">
                <p class="font-16 text-600 mb-0" v-if="statisticOption.name !== 'delivered'">
                  {{
                    calculatePercentage(
                      winnerMessage.statistics[statisticOption.name !== 'CTOR' ? statisticOption.name : 'click'],
                      winnerMessage.statistics[get2ParamForCalculatePercentage(statisticOption.name)]
                    ) || formatNumber
                  }}%
                </p>
                <p v-if="statisticOption.name === 'delivered'" class="font-16 text-600 mb-0">
                  {{ step.type === 'email' ? totalDelivered : numberFormat(winnerMessage.statistics.delivered) }}
                </p>
                <p
                  class="mb-0 font-12 text-400"
                  v-if="statisticOption.name !== 'delivered' && statisticOption.name !== 'CTOR'"
                >
                  {{ numberFormat(winnerMessage.statistics[statisticOption.name]) || 0 }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <button
          class="default-button mt-5 btn-blue"
          @click="
            () => {
              showMoreStatistics = true;
            }
          "
        >
          {{ $t('button.viewTestAB') }}
        </button>
      </template>
    </div>
    <div v-if="step.type === 'randomMessage' || step.type === 'randomWebPush' || step.type === 'randomMobilePush'">
      <div class="message-header d-flex align-items-center justify-space-between">
        <div class="d-flex cursor-pointer align-items-center gap-5" @click="editCard(step)">
          <div class="div-icon-email-messages">
            <span class="material-symbols-rounded font-24 icon-email">{{ renderIcon(step.type) }}</span>
          </div>
          <div>
            <span class="text-info-color-header">{{
              step.type === 'randomMessage'
                ? $t('automation.randomEmail')
                : step.type === 'randomWebPush'
                  ? $t('automation.randomWebPush')
                  : $t('automation.randomMobilePush')
            }}</span>
          </div>
        </div>
        <div class="div-row gap-10">
          <button type="button" class="view-button" @click="editCard(step)">
            <span class="material-symbols-rounded ds-white-color">edit</span>
          </button>
        </div>
      </div>
      <div class="message-content mt-3 mb-5">
        <div v-for="(message, index) in step.settings.messages" :key="index" class="message w-100 mt-2">
          <div class="message-content">
            <h4>{{ $t('datatable.message') }} {{ numberToLetter(index + 1) }}: {{ message.title }}</h4>
            <p class="mb-0">{{ $t('datatable.subject') }}: {{ message.subject }}</p>
          </div>
          <button type="button" class="view-button" @click="viewMessage(message.id, index)">
            <span class="material-symbols-rounded ds-light-gray-color">visibility</span>
          </button>
        </div>
      </div>
      <div class="d-flex justify-content-end">
        <button
          class="button-outlined default-button background-white"
          @click="
            () => {
              showMoreStatistics = true;
            }
          "
        >
          {{ $t('button.moreStatistics') }}
        </button>
      </div>
    </div>
    <div v-if="['email', 'webPush', 'mobilePush', 'sms', 'whatsapp'].includes(step.type)">
      <div class="d-flex message-header justify-space-between">
        <div class="d-flex cursor-pointer" @click="editCard(step)">
          <div class="div-icon-email-messages">
            <span class="material-symbols-rounded font-24 icon-email"> {{ renderIcon(step.type) }} </span>
          </div>
          <div>
            <span class="ml-1 text-info-color-header">{{ $t(`automation.${step.type}`) }}</span>
            <p class="ml-1 cursor-pointer text-info-color" @click="editCard(step)">{{ step.settings.title }}</p>
          </div>
        </div>
        <div class="div-row gap-10">
          <button type="button" class="view-button" @click="editCard(step)">
            <span class="material-symbols-rounded ds-white-color">edit</span>
          </button>
          <button type="button" class="view-button" @click="viewMessage(step.settings.id)">
            <span class="material-symbols-rounded ds-white-color">visibility</span>
          </button>
        </div>
      </div>
      <template>
        <div class="message-content mt-3 mb-5 font-12">
          <span class="text-600 ds-gray-color" v-if="step.settings.subject"
            >{{ $t('datatable.subject') }}: {{ step.settings.subject }}</span
          >
          <div
            v-if="step.settings.links && step.settings.links.length && step.settings.links[0] !== null"
            :class="[isMultipleLinks ? 'div-column' : 'div-row gap-5 w-100']"
          >
            <span class="ds-gray-color text-600">Link(s):</span>
            <a
              v-if="['webPush', 'sms', 'whatsapp'].includes(step.type)"
              class="ds-blue-color links-decoration"
              :href="step.settings.links"
              target="_blank"
              >{{ step.settings.links[0] }}</a
            >
            <div
              v-if="step.type === 'email'"
              class="div-column"
              :class="[!isMultipleLinks || step.settings.links.length === 1 ? 'single-link' : 'w-100']"
            >
              <a
                v-for="(links, index) in visibleLinks"
                :key="'ctaLink' + index"
                :href="`${links}`"
                target="_blank"
                class="ds-blue-color links-decoration"
              >
                {{ links }}
              </a>
            </div>
          </div>
          <button
            class="open-links text-600 font-10 mt-1"
            v-on:click="isMultipleLinks = !isMultipleLinks"
            v-if="step.settings.links && step.settings.links.length > 1 && step.type === 'email'"
          >
            {{ isMultipleLinks ? $t('input.showLess') : $t('input.showMore') }}
          </button>
        </div>
        <div v-if="Object.keys(internalStatistics).length" class="statistics-cards">
          <div class="d-flex gap-8 values-email">
            <div class="element-statistics div-column" v-if="['webPush', 'mobilePush'].includes(step.type)">
              <div class="div-row gap-5 mb-2">
                <span class="material-symbols-rounded font-12">check_circle</span>
                <label>{{ $t('datatable.totalSent') }}</label>
              </div>
              <div v-tooltip.top="internalStatistics.sent | formatNumber" class="div-row align-items-baseline gap-5">
                <p class="text-600 mb-0 font-16">
                  {{ numberFormat(internalStatistics.sent) }}
                </p>
              </div>
            </div>
            <div class="element-statistics div-column" v-if="['webPush', 'mobilePush', 'email'].includes(step.type)">
              <div class="div-row gap-5 mb-2">
                <span class="material-symbols-rounded font-12">check_circle</span>
                <label>{{ step.type === 'email' ? $t('datatable.totalDelivered') : $t('datatable.delivered') }}</label>
              </div>
              <div
                v-tooltip.top="internalStatistics.delivered | formatNumber"
                class="div-row align-items-baseline gap-5"
              >
                <p v-if="['webPush', 'mobilePush'].includes(step.type)" class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.delivered, internalStatistics.sent) }}%
                </p>
                <p :class="step.type === 'email' ? 'text-600 mb-0 font-16' : 'text-400 mb-0 font-12'">
                  {{ numberFormat(internalStatistics.delivered) }}
                </p>
              </div>
            </div>
            <div class="element-statistics div-column" v-if="step.type === 'email'">
              <div class="div-row gap-5 mb-2">
                <span class="material-symbols-rounded font-12">drafts</span>
                <label class="mb-0">{{ $t('datatable.open') }}</label>
              </div>
              <div v-tooltip.top="internalStatistics.open | formatNumber" class="div-row align-items-baseline gap-5">
                <p class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.open, internalStatistics.delivered) }}%
                </p>
                <p class="mb-0 font-12">{{ numberFormat(internalStatistics.open) }}</p>
              </div>
            </div>
            <div class="element-statistics div-column" v-if="step.type === 'email'">
              <div class="div-row gap-5 label-icon mb-2">
                <img src="@/assets/circled-drafts.svg" class="bounce-icon" alt="" />
                <label class="mb-0">{{ $t('datatable.unique_opens') }}</label>
              </div>
              <div
                v-tooltip.top="internalStatistics.unique_open | formatNumber"
                class="div-row align-items-baseline gap-5"
              >
                <p class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.unique_open, internalStatistics.delivered) }}%
                </p>
                <p class="mb-0 font-12">{{ numberFormat(internalStatistics.unique_open) }}</p>
              </div>
            </div>
            <div class="element-statistics div-column">
              <div class="div-row label-icon mb-2">
                <span class="material-symbols-rounded font-12">web_traffic</span>
                <label class="mb-0">{{ $t('datatable.click') }}</label>
              </div>
              <div v-tooltip.top="internalStatistics.click | formatNumber" class="div-row align-items-baseline gap-5">
                <p class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.click, internalStatistics.delivered) }}%
                </p>
                <p class="mb-0 font-12">{{ numberFormat(internalStatistics.click) }}</p>
              </div>
            </div>
            <div class="element-statistics div-column">
              <div class="div-row label-icon mb-2">
                <img src="@/assets/circled-arrow.svg" class="bounce-icon" alt="" />
                <label class="mb-0">{{ $t('datatable.unique_clicks') }}</label>
              </div>
              <div
                v-tooltip.top="internalStatistics.unique_click | formatNumber"
                class="div-row align-items-baseline gap-5"
              >
                <p class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.unique_click, internalStatistics.delivered) }}%
                </p>
                <p class="mb-0 font-12">{{ numberFormat(internalStatistics.unique_click) }}</p>
              </div>
            </div>
            <div class="element-statistics div-column" v-if="step.type === 'email'">
              <div class="div-row label-icon mb-2">
                <span class="material-symbols-rounded font-12">left_click</span>
                <label class="mb-0">CTOR</label>
              </div>
              <p class="text-600 font-16 ctor-value">
                {{ calculatePercentage(internalStatistics.click, internalStatistics.open) }}%
              </p>
            </div>
            <div class="element-statistics div-column" v-if="step.type === 'email'">
              <div class="div-row label-icon mb-2">
                <span class="material-symbols-rounded font-12">unsubscribe</span>
                <label class="subscription mb-0">{{ $t('datatable.unsubscribe') }}</label>
              </div>
              <div
                v-tooltip.top="internalStatistics.unsubscribe | formatNumber"
                class="div-row align-items-baseline gap-5"
              >
                <p class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.unsubscribe, internalStatistics.delivered) }}%
                </p>
                <p class="mb-0 font-12">{{ numberFormat(internalStatistics.unsubscribe) }}</p>
              </div>
            </div>
            <div class="element-statistics div-column" v-if="step.type === 'email'">
              <div class="div-row label-icon mb-2">
                <img src="@/assets/bounce-icon.svg" class="bounce-icon" alt="" />
                <label class="subscription mb-0">Bounces</label>
              </div>
              <div v-tooltip.top="internalStatistics.bounce | formatNumber" class="div-row align-items-baseline gap-5">
                <p class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.bounce, internalStatistics.delivered) }}%
                </p>
                <p class="mb-0 font-12">{{ numberFormat(internalStatistics.bounce) }}</p>
              </div>
            </div>
            <div class="element-statistics div-column" v-if="step.type === 'webPush'">
              <div class="div-row label-icon mb-2">
                <span class="material-symbols-rounded font-12">close-circle</span>
                <label class="subscription mb-0">{{ $t('title.close') }}</label>
              </div>
              <div v-tooltip.top="internalStatistics.close | formatNumber" class="div-row align-items-baseline gap-5">
                <p class="text-600 font-16 mb-0">
                  {{ calculatePercentage(internalStatistics.close, internalStatistics.delivered) }}%
                </p>
                <p class="mb-0 font-12">{{ numberFormat(internalStatistics.close) }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-2 total-delivered div-row align-items-end" v-if="Object.keys(internalStatistics).length">
          <router-link
            :to="`/messages/${messagesTypes[step.type]}/statistics?messages=${step.settings.id}`"
            class="button-view-statistics"
            target="_blank"
          >
            {{ $t('button.moreStatistics') }}
          </router-link>
        </div>
      </template>
    </div>

    <v-dialog v-model="showMessagePreview">
      <MessagePreview
        :messageId="step.type === 'testAB' ? allTestABMessages : allRandomMessages"
        :type="step.type"
        :messageIndex="messageIndex"
        @closeMessagePreview="closeMessagePreview"
      />
    </v-dialog>
    <v-dialog v-model="showMoreStatistics">
      <div
        class="dialog-more-statistics"
        style="height: fit-content; max-height: 700px; overflow-y: auto; min-width: 800px"
      >
        <template v-if="step.type === 'testAB'">
          <header class="d-flex justify-space-between align-center mb-3">
            <h3>{{ $t('title.testABStatistics') }}</h3>
            <button
              class="close-button"
              @click="
                () => {
                  showMoreStatistics = false;
                }
              "
            >
              <span class="material-symbols-rounded"> close </span>
            </button>
          </header>
          <div class="d-flex" style="flex-direction: column; gap: 16px; height: fit-content">
            <div
              v-for="(message, index) in step.settings.messages"
              class="d-flex"
              style="flex-direction: column; height: fit-content; gap: 8px"
              :key="index"
            >
              <div class="message" style="width: 100%">
                <div class="message-content">
                  <h4>{{ $t('datatable.message') }} {{ numberToLetter(index + 1) }}: {{ message.title }}</h4>
                  <p class="mb-0">{{ $t('datatable.subject') }}: {{ message.subject }}</p>
                </div>
                <button type="button" class="view-button" @click="viewMessage(message.id, index)">
                  <span class="material-symbols-rounded ds-light-gray-color">visibility</span>
                </button>
              </div>
              <div class="div-column gap-5">
                <div class="div-row over-flow-cards pb-1 w-100 h-100 gap-10">
                  <div
                    v-for="(statisticOption, statisticIndex) in statisticsOptions"
                    class="rate value-more"
                    width="12%"
                    :key="statisticIndex"
                    :class="{
                      'rate-winner':
                        step.settings.winnerCriteria === statisticOption.name &&
                        index === getWinnerValueIndex(step.settings.winnerCriteria),
                      'rate-loser':
                        step.settings.winnerCriteria === statisticOption.name &&
                        index !== getWinnerValueIndex(step.settings.winnerCriteria),
                    }"
                  >
                    <div class="d-flex" style="gap: 4px">
                      <span class="material-symbols-rounded font-16 icon" v-if="statisticOption.isMaterial">
                        {{ statisticOption.icon }}
                      </span>
                      <img :src="statisticOption.icon" class="icon" v-else />
                      <p class="mb-0 statistic-name">{{ statisticOption.value }}</p>
                    </div>
                    <div class="div-row align-items-baseline gap-5" v-if="step.settings.status !== 'finished'">
                      <p class="font-16 text-600 mb-0" v-if="statisticOption.name !== 'delivered'">
                        {{
                          calculatePercentage(
                            testABStatistics[index][statisticOption.name !== 'CTOR' ? statisticOption.name : 'click'],
                            testABStatistics[index][get2ParamForCalculatePercentage(statisticOption.name)]
                          ) || formatNumber
                        }}%
                      </p>
                      <p class="mb-0 font-12 text-400" v-if="statisticOption.name !== 'CTOR'">
                        {{ numberFormat(testABStatistics[index][statisticOption.name]) || 0 }}
                      </p>
                    </div>
                    <div class="div-row align-items-baseline gap-5" v-else>
                      <p class="font-16 text-600 mb-0" v-if="statisticOption.name !== 'delivered'">
                        {{
                          calculatePercentage(
                            message.statistics[statisticOption.name !== 'CTOR' ? statisticOption.name : 'click'],
                            message.statistics[get2ParamForCalculatePercentage(statisticOption.name)]
                          ) || formatNumber
                        }}%
                      </p>
                      <p
                        :class="
                          statisticOption.name === 'delivered' ? 'font-16 text-600 mb-0' : 'font-12 text-400 mb-0'
                        "
                        v-if="statisticOption.name !== 'CTOR'"
                      >
                        {{ numberFormat(message.statistics[statisticOption.name]) || 0 }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template
          v-else-if="step.type === 'randomMessage' || step.type === 'randomWebPush' || step.type === 'randomMobilePush'"
        >
          <div class="d-flex justify-space-between align-center mb-3">
            <h3>
              {{
                step.type === 'randomMessage'
                  ? $t('title.randomEmailStatistics')
                  : step.type === 'randomWebPush'
                    ? $t('title.randomWebPushStatistics')
                    : $t('title.randomMobilePushStatistics')
              }}
            </h3>
            <button
              class="close-button"
              @click="
                () => {
                  showMoreStatistics = false;
                }
              "
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div
            v-for="(message, index) in step.settings.messages"
            class="d-flex"
            style="flex-direction: column; height: fit-content; gap: 8px"
            :key="index"
          >
            <div class="message" style="width: 100%">
              <div class="message-content">
                <h4>{{ $t('datatable.message') }} {{ numberToLetter(index + 1) }}: {{ message.title }}</h4>
                <p class="mb-0">{{ $t('datatable.subject') }}: {{ message.subject }}</p>
              </div>
              <button type="button" class="view-button" @click="viewMessage(message.id, index)">
                <span class="material-symbols-rounded ds-light-gray-color">visibility</span>
              </button>
            </div>

            <div class="div-column gap-5">
              <div class="div-row over-flow-cards pb-5 w-100 h-100 gap-10">
                <div
                  v-for="(statisticOption, statisticIndex) in statisticsOptions"
                  class="rate value-more"
                  width="12%"
                  :key="statisticIndex"
                >
                  <div class="d-flex" style="gap: 4px">
                    <span class="material-symbols-rounded font-16 icon" v-if="statisticOption.isMaterial">
                      {{ statisticOption.icon }}
                    </span>
                    <img :src="statisticOption.icon" class="icon" v-else />
                    <p class="mb-0 statistic-name">{{ statisticOption.value }}</p>
                  </div>
                  <div class="div-row align-items-baseline gap-5" v-if="step.type === 'randomMessage'">
                    <p class="font-16 text-600 mb-0" v-if="statisticOption.name !== 'delivered'">
                      {{
                        calculatePercentage(
                          randomMessageStatistics[index][
                            statisticOption.name !== 'CTOR' ? statisticOption.name : 'click'
                          ],
                          randomMessageStatistics[index][get2ParamForCalculatePercentage(statisticOption.name)]
                        ) || formatNumber
                      }}%
                    </p>
                    <p
                      :class="statisticOption.name === 'delivered' ? 'font-16 text-600 mb-0' : 'font-12 text-400 mb-0'"
                      v-if="statisticOption.name !== 'CTOR'"
                    >
                      {{ numberFormat(randomMessageStatistics[index][statisticOption.name]) || 0 }}
                    </p>
                  </div>
                  <div class="div-row align-items-baseline gap-5" v-else>
                    <p class="font-16 text-600 mb-0" v-if="statisticOption.name !== 'sent'">
                      {{
                        calculatePercentage(
                          randomMessageStatistics[index][statisticOption.name],
                          randomMessageStatistics[index][get2ParamForCalculatePercentage(statisticOption.name)]
                        ) || formatNumber
                      }}%
                    </p>
                    <p class="font-12 text-400 mb-0" :class="{ 'font-16 text-600': statisticOption.name === 'sent' }">
                      {{ numberFormat(randomMessageStatistics[index][statisticOption.name]) || 0 }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import MessagesService from '@/modules/messages/services/messages.service';
import ModalService from '@/services/modal.service';
import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
import MessagePreview from '@/components/common/MessagePreview.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

@Component({
  props: ['step', 'statistics', 'automationId', 'message', 'stepError'],
  components: { MessagePreview, ButtonDefault },
})
export default class MessageCardComponent extends Vue {
  @Prop() campaignId!: number;
  @Prop() public stepError!: boolean;
  @Prop() public readonly statistics: any;
  @Prop() public readonly step: any;
  @Prop() public readonly automationId!: any;
  private readonly modalService = new ModalService();
  private readonly messsagesService = new MessagesService();

  showMessagePreview = false;
  allTestABMessages: any = [];
  allRandomMessages: any = [];
  internalStatistics: any = {};
  statisticsEmailOptions = [
    { name: 'delivered', value: this.$t('datatable.totalDelivered'), icon: 'check_circle', isMaterial: true },
    { name: 'open', value: this.$t('datatable.open'), icon: 'drafts', isMaterial: true },
    {
      name: 'unique_open',
      value: this.$t('datatable.unique_opens'),
      icon: require('@/assets/circled-drafts.svg'),
      isMaterial: false,
    },
    { name: 'click', value: this.$t('datatable.click'), icon: 'web_traffic', isMaterial: true },
    {
      name: 'unique_click',
      value: this.$t('datatable.unique_clicks'),
      icon: require('@/assets/circled-arrow.svg'),
      isMaterial: false,
    },
    { name: 'CTOR', value: 'CTOR', icon: 'left_click', isMaterial: true },
    { name: 'unsubscribe', value: this.$t('datatable.unsubscribe'), icon: 'unsubscribe', isMaterial: true },
    { name: 'bounce', value: 'Bounce', icon: require('@/assets/bounce-icon.svg'), isMaterial: false },
  ];
  statisticsOptionsPush = [
    { name: 'sent', value: this.$t('datatable.sent'), icon: 'send', isMaterial: true },
    { name: 'delivered', value: this.$t('datatable.delivered'), icon: 'check_circle', isMaterial: true },
    { name: 'click', value: this.$t('datatable.click'), icon: 'web_traffic', isMaterial: true },
    { name: 'close', value: this.$t('datatable.close'), icon: 'unsubscribe', isMaterial: true },
  ];
  showMoreStatistics = false;
  testABStatistics: any = [];
  randomMessageStatistics: any = [];
  message: any;
  winnerMessage: any = {};
  showMore = false;
  showMoreText = this.$t('input.showMore');
  messageIndex = -1;
  isMultipleLinks = false;
  isWinnerLinks = false;
  messagesTypes: any = {
    email: 'email',
    webPush: 'web-push',
    mobilePush: 'mobile-push',
  };

  beforeMount() {
    if (this.step.type === 'testAB') {
      this.changeStatistics();
    }
  }

  get visibleLinks() {
    return this.isMultipleLinks ? this.step.settings.links : this.step.settings.links.slice(0, 1);
  }

  get winnerLinks() {
    return this.isWinnerLinks ? this.winnerMessage.links : this.winnerMessage.links.slice(0, 1);
  }

  get statisticsOptions() {
    if (this.step.type === 'randomMessage' || this.step.type === 'testAB') {
      return this.statisticsEmailOptions;
    }
    if (this.step.type === 'randomWebPush') {
      return this.statisticsOptionsPush;
    }
    if (this.step.type === 'randomMobilePush') {
      return this.statisticsOptionsPush.filter((option: any) => option.name !== 'close');
    }
  }

  calculatePercentage(dividend: number, divider: number) {
    if (!dividend || !divider || Number(dividend) === 0 || Number(divider) === 0) {
      return '0.0';
    }
    return ((dividend / divider) * 100).toFixed(1);
  }
  numberFormat(number: number) {
    if (!number || isNaN(number)) {
      return '0';
    }
    return new Intl.NumberFormat('pt-BR').format(number);
  }
  editCard(step: any) {
    this.$emit('editCard', step);
  }

  closeMessagePreview() {
    this.showMessagePreview = false;
  }

  renderIcon(type: string) {
    switch (type) {
      case 'email':
        return 'email';
      case 'webPush':
        return 'computer';
      case 'mobilePush':
        return 'smartphone';
      case 'sms':
        return 'sms';
      case 'whatsapp':
        return 'phone';
      case 'testABWinner':
        return 'emoji_events';
      case 'randomMessage':
        return 'stacked_email';
      case 'randomWebPush':
        return 'computer';
      case 'randomMobilePush':
        return 'smartphone';
    }
  }

  getFormattedContent() {
    const content = this.message.content;
    return content.replace(/<a /g, '<a target="_blank" ');
  }

  numberToLetter(number: number) {
    const baseCharCode = 'A'.charCodeAt(0) - 1;
    const letterCode = baseCharCode + number;

    return String.fromCharCode(letterCode);
  }

  getTimeLeft(endDate: Date) {
    const diffMinutes = Math.floor(Math.abs(endDate.getTime() - new Date().getTime()) / 60000);
    const days = Math.floor(diffMinutes / 1440);
    const hours = Math.floor((diffMinutes % 1440) / 60);
    const minutes = Math.floor(diffMinutes % 60);
    if (days) {
      return `${days} ${(this.$t('title.day') as string).toLowerCase()}(s)`;
    }
    if (hours) {
      return `${hours} ${this.$t('title.hours')}`;
    }
    if (minutes) {
      return `${minutes} ${this.$t('title.minutes')}`;
    }
    return `0 ${(this.$t('title.hour') as string).toLowerCase()}s`;
  }

  viewMessage(id: number, index?: number) {
    if (typeof index === 'number') {
      this.messageIndex = index;
      this.allTestABMessages = this.step?.settings?.messages?.map((x: any) => {
        return {
          messageId: x.id,
          winner: x.winnerMessage ? x.winnerMessage : false,
        };
      });
      this.allRandomMessages = this.step?.settings?.messages?.map((x: any) => x.id);
    }
    if (index === undefined || index === null) {
      this.allTestABMessages = id;
      this.allRandomMessages = id;
    }
    this.showMessagePreview = true;
  }

  get2ParamForCalculatePercentage(firstParam: string): string {
    if (['open', 'click', 'unsubscribe', 'bounce', 'close', 'unique_open', 'unique_click'].includes(firstParam)) {
      return 'delivered';
    } else if (firstParam === 'CTOR') {
      return 'open';
    } else if (firstParam === 'delivered') {
      return 'sent';
    }
    return '';
  }

  get totalDelivered() {
    let totalDelivered = 0;
    this.testABStatistics?.forEach((x: any) => {
      totalDelivered += parseInt(x.delivered, 10);
    });
    return totalDelivered;
  }

  getWinnerValueIndex(winnerCriteria: string) {
    const index = this.testABStatistics
      .map((statistic: any) => statistic[winnerCriteria] / statistic.delivered)
      .reduce((maxIndex: string | number, currentValue: any, currentIndex: any, array: any) => {
        if (currentValue > array[maxIndex]) {
          return currentIndex;
        } else {
          return maxIndex;
        }
      }, 0);
    return index;
  }

  @Watch('statistics', { immediate: true, deep: true })
  filterStatistics() {
    this.changeStatistics();
  }

  @Watch('step', { immediate: true, deep: true })
  filterStep(newValue: any, oldValue: any) {
    if (newValue.id !== oldValue.id) {
      this.changeStatistics();
    }
  }

  changeStatistics() {
    if (this.step.type === 'email') {
      this.internalStatistics = this.statistics[this.step.settings.id] || {};
    } else if (this.step.type === 'testAB') {
      this.testABStatistics = this.step.settings.messages.map((message: any) => {
        this.allTestABMessages.push(message.id);
        return (
          this.statistics[message.id] || {
            delivered: 0,
            open: 0,
            click: 0,
            CTOR: 0,
            unsubscribe: 0,
            bounce: 0,
          }
        );
      });
      this.internalStatistics = this.testABStatistics;
      if (this.step.settings.status === 'finished') {
        this.winnerMessage = this.step.settings.messages.find((message: any) => message.winnerMessage === true);
        const statisticWinner = this.testABStatistics.find(
          (message: any) => parseInt(message.message_id, 10) === this.winnerMessage.id
        );
        this.winnerMessage.statistics = statisticWinner ? statisticWinner : this.winnerMessage.statistics;
      }
    } else if (
      this.step.type === 'randomMessage' ||
      this.step.type === 'randomWebPush' ||
      this.step.type === 'randomMobilePush'
    ) {
      this.randomMessageStatistics = this.step.settings.messages.map((message: any) => {
        this.allRandomMessages.push(message.id);
        return (
          this.statistics[message.id] || {
            delivered: 0,
            open: 0,
            click: 0,
            CTOR: 0,
            unsubscribe: 0,
            bounce: 0,
            sent: 0,
            close: 0,
          }
        );
      });
      this.internalStatistics = this.randomMessageStatistics;
    } else {
      this.internalStatistics = this.statistics[this.step.settings.id] || {};
    }
  }

  async finishTest() {
    await this.messsagesService.finishTest({ ...this.step, automationId: this.automationId });
    window.location.reload();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.link-cta-bms a {
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0em;
  text-align: left;
  color: #0057f4;
}

.message-header {
  background-color: $ds-blue;
  width: 550px;
  height: 48px;
  border-radius: 15px 15px 0px 0px;
  margin: -20px -20px 0px -20px;
  padding: 8px 20px 8px 20px;
}

.message-title {
  margin-left: 30px;
}

.card-info {
  background-color: white;
  padding: 20px;
  border-radius: 15px;
  box-shadow:
    0px 3px 1px -2px rgb(0 0 0 / 20%),
    0px 2px 2px 0px rgb(0 0 0 / 14%),
    0px 1px 5px 0px rgb(0 0 0 / 12%);
  width: 550px;
}
.element-statistics {
  padding: 12px;
  border-radius: 12px;
  width: 135px;
  border: 0.5px solid #d9d9d9;
  gap: 6px;
  label {
    color: #5c5c5c;
    font-size: 10px;
  }
  p {
    font-size: 16px;
    color: #5c5c5c;
  }
}

.ctor-value {
  margin-bottom: 3px;
}

.subscription {
  white-space: nowrap !important;
}

.div-icon-email {
  margin-left: -31px;
  height: 27px;
  width: 27px;
  border-radius: 14px;
  background-color: $ds-blue;
  display: flex;
  align-items: center;
  justify-content: center;
}
.div-icon-email-messages {
  height: 27px;
  width: 27px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-email {
  font-size: 20px;
  color: white;
}
.text-info-color {
  color: white;
  font-weight: 600;
  font-size: 12px;
}

.text-info-color-header {
  color: white;
  font-weight: 600;
  font-size: 12px;
}
.text-winner-color {
  color: white !important;
  line-height: 0px;
  margin-top: 3px;
}
.total-sent-info {
  font-weight: 600;
  font-size: 14px;
  line-height: 150%;
  color: $ds-gray;
  span {
    font-size: 14px;
  }
}
.icon-color {
  color: $neutral-gray-700;
}

.processing {
  color: $ds-purple;
  font-size: 14px;
  font-weight: bold;
  white-space: nowrap;
  margin-top: 2px;
  margin-bottom: 0px !important;
}

.time-left {
  color: white;
  font-size: 10px;
  font-weight: 600;
}

.label-title-small {
  font-size: 14px;
  font-weight: bold;
  color: $ds-gray;
}
.winner-criteria {
  font-size: 14px;
  color: $ds-gray;
}

.preview-email-iframe {
  position: relative;
  width: 100%;
  border: none;
  height: 300px;
  iframe {
    position: absolute !important;
  }
}

.img-icon {
  height: 20px;
  width: 20px;
  filter: invert(100%) sepia(94%) saturate(20%) hue-rotate(245deg) brightness(164%) contrast(100%);
}

.message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 70%;
  background: $ds-gray-100;
  border-radius: 8px;
  padding: 14px 12px;
  gap: 8px;
}

.message-content {
  h4 {
    font-size: 14px;
    font-weight: 600;
    line-height: 130%;
    color: $ds-gray;
  }

  p {
    font-size: 14px;
    line-height: 130%;
    color: $ds-gray;
  }
}

.view-button {
  z-index: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  outline: none;
}

.view-icon {
  height: 24px;
  filter: invert(75%) sepia(52%) saturate(13%) hue-rotate(333deg) brightness(100%) contrast(79%);
}

.view-icon-testab {
  height: 24px;
}

.view-icon:hover {
  cursor: pointer;
  filter: none;
}

.rate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  width: 30%;
  border-radius: 12px;
  border: 1px $ds-gray-300 solid;
  justify-content: space-between;

  .icon {
    width: 14px;
    height: 14px;
    color: $ds-gray !important;
  }
}

.value-more {
  gap: 20px !important;
}

.rate-winner {
  border-color: #0fb75c;
  background: #f2fff8;

  .icon {
    color: #0fb75c !important;
  }

  p {
    color: #0fb75c;
  }

  h4 {
    color: #0fb75c;
  }
}

.rate-loser {
  border-color: $ds-red;
  background: #fff0f0;

  .icon {
    color: $ds-red !important;
  }

  p {
    color: $ds-red;
  }

  h4 {
    color: $ds-red;
  }
}

.total-delivered {
  gap: 8px;

  img {
    width: 20px;
    height: 20px;
  }

  h4 {
    font-size: 14px;
    font-weight: bold;
  }
}

.default-button {
  display: flex;
  align-items: center;
  color: $ds-blue;
  text-transform: uppercase;
  border-radius: 8px;
  font-size: 12px;
  font-weight: bold;
  height: 26px !important;
  padding: 15px !important;
  text-align: center;
  border: 1px solid $ds-blue;
  place-self: end;
}

.background-white {
  background: white !important;
}

.btn-red {
  background: $ds-red;
  border: $ds-red 2px solid;
  color: white;
  &:hover {
    background: $neutral-error-red;
  }
}

.dialog-more-statistics {
  background: white;
  padding: 20px;

  h3 {
    color: $ds-blue;
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 0px !important;
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

.statistics {
  width: 100%;
  padding-bottom: 10px;
  overflow-x: auto;
}

.statistics::-webkit-scrollbar,
.statistics-cards::-webkit-scrollbar {
  height: 8px !important;
}

.btn-cancel {
  color: $ds-red !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-red;
  padding: 14px !important;
}

.btn-cancel:hover {
  background-color: #ffffff !important;
}

.bounce-icon {
  width: 12px;
  height: 12px;
}

.label-icon {
  gap: 3px;
}

.statistics-cards {
  width: 100%;
  padding-bottom: 10px;
  overflow-x: auto;
  padding-top: 10px;
}

.values-email {
  width: fit-content;
}

.icon-color {
  color: #ffc500;
}

.text-winner-title {
  line-height: 0px;
  color: white;
  font-weight: 600;
}

.single-link {
  max-width: 90%;
}

.links-decoration {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.open-links {
  outline: none;
  white-space: nowrap;
  color: $ds-blue;
  text-transform: uppercase;
  display: flex;
  justify-content: flex-start;

  &:hover {
    color: $ds-blue-dark;
  }
}

.button-view-statistics {
  min-width: 136px;
  height: 26px;
  left: 305px;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  gap: 10px;
  font-size: 10px;
  font-weight: 700;
  line-height: 10px;
  letter-spacing: 0.07em;
  text-align: center;
  color: #ffffff;
  background: $ds-blue !important;
  opacity: 1 !important;
  text-transform: uppercase;

  &:hover {
    background: $ds-blue-dark !important;
    text-decoration: none;
  }
}

.over-flow-cards {
  max-width: 100%;
  overflow-y: auto;
}

::v-deep .v-dialog {
  border-radius: 16px;
  box-shadow: none;
  width: fit-content;
}
</style>
