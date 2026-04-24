<template>
  <div class="row profile">
    <v-card class="column background-card-picture">
      <v-col cols="8 p-4 mt-5">
        <v-row>
          <v-col cols="12 px-0">
            <ImageInput v-model="imageFile" :loadImage="currentUser.profile" />
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12 mt-2">
        <ButtonDefault
          :name="`${$t('button.updatePicture')}`"
          @click="buttonSave($event, 'profile', currentUser.profile)"
          :disabled="isPictureButtonDisabled"
        />
      </v-col>
    </v-card>

    <!-- <div class="background-card-picture">
      <div>
        <ImageInput v-model="imageFile" :loadImage="currentUser.profile" />
      </div>
      <ButtonDefault
        :name="`${$t('button.updatePicture')}`"
        @click="buttonSave($event, 'profile', currentUser.profile)"
        :disabled="isPictureButtonDisabled"
      />
    </div> -->

    <form @submit="buttonSave($event)" class="row mt-0 mb-0 pb-0 pt-0">
      <v-card class="row background-card-info">
        <v-col cols="4 p-4">
          <v-row>
            <v-col cols="10">
              <InputDefault
                :name="`${$t('title.name')}`"
                :modelValue="currentUser.name"
                @updateInput="updateInput"
                :keyInput="'name'"
              />
            </v-col>
          </v-row>
        </v-col>
        <v-col cols="4 p-4">
          <v-row>
            <v-col cols="10">
              <InputDefault
                :name="`${$t('title.email')}`"
                :modelValue="currentUser.email"
                @updateInput="updateInput"
                :keyInput="'email'"
              />
            </v-col>
          </v-row>
        </v-col>
        <v-col cols="4" class="language-select">
          <v-row>
            <v-col cols="10">
              <label class="label-title font-12">{{ $t('title.language') }} </label>
              <v-select
                :items="langs"
                v-model="currentUser.settings.language"
                item-text="name"
                item-value="value"
                class="select-padding mt-0 pt-0"
                persistent-hint
                return-object
                single-line
              >
                <template v-slot:selection="{ item }">
                  <img class="language-image" :src="item.image" />{{ item.name }}
                </template>
                <template v-slot:item="{ item }">
                  <img class="language-image" :src="item.image" />{{ item.name }}
                </template>
              </v-select>
            </v-col>
          </v-row>
        </v-col>

        <v-col cols="12">
          <ButtonDefault type="submit" class="float-right" :name="`${$t('button.saveChanges')}`" />
        </v-col>
      </v-card>
    </form>
    <v-card class="row background-card" v-if="currentUser.providerId">
      <v-col cols="12 p-4">
        <v-row>
          <v-col cols="6">
            <InputDefault
              :name="`${$t('title.password')}`"
              size="16"
              auto="true"
              characters="a-z,A-Z,0-9,#"
              :inputIcon="'cached'"
              :password="true"
              :modelValue="currentUser.password"
              @updateInput="updateInput"
              :keyInput="'password'"
              id="pass"
            />
          </v-col>
          <v-col cols="6">
            <InputDefault
              id="confirm_pass"
              :name="`${$t('input.confirmPassword')}`"
              :keyInput="'passwordConfirm'"
              :modelValue="passwordConfirm"
              @updateInput="updateConfirmPassword"
            />
            <div>
              <span id="wrong_pass_alert"></span>
            </div>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12">
        <ButtonDefault
          :disabled="disabledButton"
          :name="`${$t('button.updatePassword')}`"
          class="float-right"
          @click="buttonSave($event, 'password', passwordConfirm)"
      /></v-col>
    </v-card>
  </div>
</template>

<script lang="ts">
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import ToastService from '@/services/toast.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import ProfileService from '@/modules/profile/services/profile.service';
import ImageInput from '@/components/input/ImageInputDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import store from '@/store';

@Component({
  components: { InputDefault, ButtonDefault, ImageInput },
  filters: {},
})
export default class Profile extends Vue {
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();
  private readonly modalService = new ModalService();
  private readonly profileService = new ProfileService();

  currentPassword = '';
  passwordConfirm = '';
  disabledButton = true;
  imageFile: any = null;
  currentUser: any = [];
  isPictureButtonDisabled = true;
  langs = [
    {
      value: 'pt-BR',
      name: 'Português (Brasil)',
      image: 'https://flagicons.lipis.dev/flags/4x3/br.svg',
    },
    {
      value: 'en-US',
      name: 'English',
      image: 'https://flagicons.lipis.dev/flags/4x3/um.svg',
    },
  ];

  async beforeMount() {
    this.currentUser = store.state.currentUser;
  }

  updateInput(event: any, keyInput: any) {
    this.currentUser[keyInput] = event;
    this.currentPassword = this.currentUser.password;
  }

  updateConfirmPassword(event: any, keyInput: any) {
    this.passwordConfirm = event;
  }

  @Watch('currentPassword')
  watchCurrentPassword() {
    this.validatePassword();
  }

  @Watch('passwordConfirm')
  watchPasswordConfirm() {
    this.validatePassword();
  }

  @Watch('imageFile')
  watchImageFile() {
    this.isPictureButtonDisabled = !this.imageFile;
  }

  validatePassword() {
    const pass = this.currentPassword;
    const confirm_pass = this.passwordConfirm;

    if (pass !== confirm_pass) {
      this.disabledButton = true;
      (document.getElementById('wrong_pass_alert') as HTMLInputElement).style.color = 'red';
      (document.getElementById('wrong_pass_alert') as HTMLInputElement).innerHTML = this.$t(
        'description.invalidPasswords'
      ) as string;
      (document.getElementById('create') as HTMLInputElement).disabled = true;
      (document.getElementById('create') as HTMLInputElement).style.opacity = '0.4';
    } else {
      this.disabledButton = false;
      (document.getElementById('wrong_pass_alert') as HTMLInputElement).style.color = 'green';
      (document.getElementById('wrong_pass_alert') as HTMLInputElement).innerHTML = this.$t(
        'description.validPasswords'
      ) as string;
      (document.getElementById('create') as HTMLInputElement).disabled = false;
      (document.getElementById('create') as HTMLInputElement).style.opacity = '1';
    }
  }

  async buttonSave(e: Event, key?: any, value?: any) {
    try {
      this.loadingService.show();
      let response: any;
      let images: any;

      if (e?.type === 'submit') {
        e.preventDefault();
      }

      if (key === 'profile' && this.imageFile) {
        images = await this.profileService.uploadImages([
          {
            userId: this.currentUser.id,
            data: '' + (await this.getBase64(this.imageFile)),
            name: this.imageFile.name,
            pathExternal: 'users/profile_images',
          },
        ]);

        this.imageFile = null;
        this.currentUser.profile = images?.data[0].link;
        response = await this.profileService.updateUser({
          id: this.currentUser.id,
          profile: images?.data[0].link,
        });
      } else if (key === 'password') {
        response = await this.profileService.updateUserPassword({
          id: this.currentUser.id,
          providerId: this.currentUser.providerId,
          [key]: value,
        });
      } else {
        response = await this.profileService.updateUser({
          id: this.currentUser.id,
          name: this.currentUser.name,
          email: this.currentUser.email,
          settings: { ...this.currentUser.settings, language: this.currentUser.settings.language.value },
        });

        this.$i18n.locale = this.currentUser.settings.language.value;
        store.commit('setUserLanguage', this.currentUser.settings.language.value);
      }

      this.loadingService.hide();
      if (response && response.data) {
        store.commit('setUser', response.data);
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.profile-updated') as string,
        });
        this.$router.push(`/profile`);
      }
    } catch (error) {
      this.loadingService.hide();
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.profile-updated-error') as string,
      });
    }
  }

  getBase64(file: any) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
    });
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.language-select {
  padding-top: 19px;
}
.select-padding {
  padding-bottom: 19px;
  max-width: fit-content;
}
.background-card {
  background-color: #ffffff;
  margin-top: 24px;
  margin-bottom: 24px;
  border-radius: 14px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  margin-left: 20px;
  width: fit-content;
}
.background-card-picture {
  background-color: #ffffff;
  margin-top: 24px;
  margin-bottom: 24px;
  border-radius: 14px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  margin-left: 20px;
  width: fit-content;
  text-align: -webkit-center;
}

.background-card-info {
  background-color: #ffffff;
  margin-top: 24px;
  margin-bottom: 24px;
  border-radius: 14px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  margin-left: 20px;
  width: fit-content;
}
::v-deep.profile {
  margin-right: 18px;
  padding-left: 8px;
}
.lang-menu-activator {
  width: 64px;
  cursor: pointer;
}

.lang-menu-item {
  cursor: pointer;
  background-color: #fafafa;
}

::v-deep.theme--light.v-icon {
  color: $ds-blue !important;
}

.profile-title {
  font-weight: 800;
  letter-spacing: -0.025em;
  font-size: 1.875rem;
  line-height: 2.25rem;
}
.card-section {
  .card-icon {
    margin-right: 0.5rem;
  }

  .card-title {
    line-height: 1.5rem;
    font-weight: 600;
    font-size: 1.3rem;
    color: rgb(17 24 39 / var(--tw-text-opacity));
  }

  .card-description {
    font-size: 0.9rem;
  }

  .card-info {
    margin-bottom: 1rem;
  }
}

img {
  width: 50px !important;
  margin-right: 10px;
}

.wrong_pass_alert {
  margin-bottom: 1rem;
}
</style>
