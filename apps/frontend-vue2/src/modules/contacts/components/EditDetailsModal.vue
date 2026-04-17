<template>
  <v-dialog v-model="dialog" width="800" @click:outside="hideModal" @keydown.esc="hideModal">
    <v-card class="card">
      <div class="contact-details div-column gap-15">
        <div class="div-row justify-space-between align-items-center">
          <span class="text-600 font-14 ds-gray-color">{{ $t('title.editContactDetails') }}</span>
          <span class="material-symbols-rounded cursor-pointer close-button icon" @click="hideModal"> close </span>
        </div>
        <div class="div-column gap-10">
          <div class="div-row gap-15">
            <InputDefault
              :name="`${$t('title.name')}`"
              autofocus
              :placeholder="`${$t('input.typeHere')}`"
              @updateInput="updateInput"
              :keyInput="'firstName'"
              max="40"
              class="double-input"
              :modelValue="contactDetails.firstName"
            />
            <InputDefault
              :name="`${$t('title.lastName')}`"
              autofocus
              :placeholder="`${$t('input.typeHere')}`"
              @updateInput="updateInput"
              :keyInput="'lastName'"
              max="40"
              class="double-input"
              :modelValue="contactDetails.lastName"
            />
          </div>
          <InputDefault
            :name="`${$t('title.email')}`"
            autofocus
            :placeholder="`${$t('input.typeHere')}`"
            @updateInput="updateInput"
            :keyInput="'email'"
            max="40"
            class="double-input"
            :modelValue="contactDetails.email"
          />
          <InputDefault
            :name="`${$t('title.phone')}`"
            autofocus
            :placeholder="`${$t('input.typeHere')}`"
            @updateInput="updateInput"
            :keyInput="'phone'"
            max="40"
            :modelValue="contactDetails.phone"
          />
          <div class="div-row gap-15">
            <InputDefault
              :name="`${$t('title.city')}`"
              autofocus
              :placeholder="`${$t('input.typeHere')}`"
              @updateInput="updateInput"
              :keyInput="'city'"
              max="40"
              class="triple-input"
              :modelValue="contactDetails.city"
            />
            <InputDefault
              :name="`${$t('title.region')}`"
              autofocus
              :placeholder="`${$t('input.typeHere')}`"
              @updateInput="updateInput"
              :keyInput="'region'"
              max="40"
              class="triple-input"
              :modelValue="contactDetails.region"
            />
            <InputDefault
              :name="`${$t('title.country')}`"
              autofocus
              :placeholder="`${$t('input.typeHere')}`"
              @updateInput="updateInput"
              :keyInput="'country'"
              max="40"
              class="triple-input"
              :modelValue="contactDetails.country"
            />
          </div>
          <div class="div-column gap-5">
            <label class="ds-gray-color font-12 text-600 mb-0">{{ $t('title.status') }}</label>
            <select
              v-model="contactDetails.status"
              class="form-control mo-select border-color font-12"
              :items="isActive"
              item-text="label"
              item-value="value"
              solo
            >
              <option :value="true">{{ $t('datatable.active') }}</option>
              <option :value="false">{{ $t('datatable.inactive') }}</option>
            </select>
          </div>
        </div>
        <div class="footer-buttons div-row gap-15 align-items-center">
          <input
            class="cancel-button"
            text
            @click="callConfirmLeavingModal"
            type="button"
            :value="`${$t('button.cancel')}`"
          />
          <ButtonDefault :name="`${$t('button.save')}`" @click="saveContactChanges" class="btn btn-c btn-lg button" />
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { ContactsDto } from '../dto/contacts.dto';
import ModalService from '@/services/modal.service';
import ContactService from '../services/contacts.service';

interface ContactDetails {
  id: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | number | null;
  postal: string | number | null;
  address: string;
  complement: string;
  city: string;
  region: string;
  country: string;
  status: boolean;
}

@Component({
  components: { ButtonDefault, InputDefault },
})
export default class EditDetailsModal extends Vue {
  @Prop() dialog!: boolean;
  @Prop() eventType!: string;
  @Prop({ type: Object, required: true }) contactData!: ContactsDto;

  private readonly modalService = new ModalService();
  private readonly contactService = new ContactService();

  hasChanges = false;

  contactDetails = {
    id: null as number | null,
    firstName: '',
    lastName: '',
    email: '',
    phone: null as number | string | null,
    postal: null as number | string | null,
    address: '',
    complement: '',
    city: '',
    region: '',
    country: '',
    status: false,
  };
  isActive = [
    { label: this.$t('datatable.active'), value: true },
    { label: this.$t('datatable.inactive'), value: false },
  ];

  hideModal() {
    this.$emit('hideModal');
  }

  updateInput(value: string | number | boolean | null, key: keyof ContactDetails) {
    this.hasChanges = true;
    if (key === 'id' || key === 'phone' || key === 'postal') {
      this.contactDetails[key] = value as number | null;
    } else if (key === 'status') {
      this.contactDetails[key] = value as boolean;
    } else {
      this.contactDetails[key] = value as string;
    }
  }

  deletePhone() {
    this.contactDetails.phone = null;
  }

  callConfirmLeavingModal(type: string) {
    console.log(type);

    if (this.hasChanges) {
      this.modalService.confirm({
        title: this.$t('button.leave') as string,
        text: this.$t('description.areYouSureLeave') as string,
        confirmLabel: this.$t('button.leave') as string,
        cancelLabel: this.$t('button.stay') as string,
        confirmFunction: () => this.hideModal(),
      });
    } else {
      this.hideModal();
    }
  }

  async saveContactChanges() {
    await this.contactService.updateContact(this.contactDetails);
  }

  @Watch('contactData')
  updateContact() {
    this.contactDetails.id = this.contactData.id as number;
    this.contactDetails.firstName = this.contactData.firstName as string;
    this.contactDetails.lastName = this.contactData.lastName as string;
    this.contactDetails.email = this.contactData.email as string;
    this.contactDetails.phone = this.contactData.phone as string;
    this.contactDetails.postal = this.contactData.postal;
    this.contactDetails.city = this.contactData.city;
    this.contactDetails.region = this.contactData.region;
    this.contactDetails.country = this.contactData.country;
    this.contactDetails.status = this.contactData.isActive as boolean;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.card {
  height: 100%;
  border-radius: 16px;
}

.contact-details {
  padding: 20px;
}

.footer-buttons {
  justify-content: flex-end;
}

.delete-icon {
  align-self: flex-end;
  margin-bottom: 2px;
}

.add-buttons {
  background-color: #0fb75c;
  width: fit-content;
  border-radius: 16px;
  cursor: pointer;
  letter-spacing: 0.05em;
  padding-top: 2px;
  padding-bottom: 2px;
}

.email-input {
  width: 100%;
  height: 36px;
  padding: 0px 5px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 12px;
  outline: none;
}

::v-deep .v-dialog {
  box-shadow: none;
  border-radius: 16px !important;
  display: flex;
  justify-content: center;
  height: fit-content;
}
</style>
