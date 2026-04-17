<template>
  <div class="div-column gap-10 px-4 pt-2 pb-4 generate-links-dialog">
    <div class="div-row justify-content-between align-items-center">
      <span class="font-14 text-600">{{ $t('button.uploadImage') }}</span>
      <button class="d-flex align-items-center" @click="closeUploadImageDialog">
        <span class="material-symbols-rounded ds-light-gray-color text-600 close-icon trash-can-icon">
          close_small
        </span>
      </button>
    </div>
    <div
      :class="['dropZone dash-blue', dragging ? 'dropZone-over' : '']"
      @dragenter="dragging = true"
      @dragleave="dragging = false"
      @dragover.prevent
      @drop="onDrop"
    >
      <span class="dropZone-title text-600 font-12 ds-blue-color">{{ $t('title.uploadImage') }}</span>
      <input
        class="file-drag"
        type="file"
        ref="inputFile"
        @change="onFileSelect"
        multiple
        accept="image/png, image/jpeg"
        :disabled="isMessageInUse"
      />
    </div>
    <div class="div-column gap-10 files-to-upload p-3" v-if="selectedFiles.length > 0">
      <span class="font-12 text-600">{{ $t('title.filesToUpload') }} ({{ selectedFiles.length }})</span>
      <div class="selected-files-list div-column">
        <div
          class="div-row justify-content-between align-items-center file-item p-3"
          v-for="(file, index) in selectedFiles"
          :key="index"
        >
          <div class="div-column">
            <span class="font-12 text-600">{{ file.name }}</span>
            <span class="font-10 ds-gray-color">{{ formatFileSize(file.size) }}</span>
          </div>
          <button class="remove-file-btn" @click="removeSelectedFile(index)" :disabled="isLoadingImage">
            <span class="material-symbols-rounded font-24">delete</span>
          </button>
        </div>
      </div>
    </div>
    <div class="div-column gap-10 files-to-upload p-3" v-if="uploadedImages.length > 0">
      <span class="font-12 text-600">{{ $t('title.uploadedImages') }} ({{ uploadedImages.length }})</span>
      <div class="selected-files-list div-column">
        <div
          class="div-row justify-content-between align-items-center p-2 files-to-upload"
          v-for="(image, index) in uploadedImages"
          :key="index"
        >
          <div class="div-row align-items-center gap-10">
            <img class="image-size" :src="image.data" alt="Image" />
            <span
              class="font-12 ds-blue-color text-600 text-truncate image-link-text cursor-pointer"
              @click="copyToClipboard(image.link, 'imageLink')"
              >{{ image.link }}</span
            >
          </div>
          <button
            class="d-flex align-items-center justify-content-center font-20 ds-gray-color material-symbols-rounded copy-icon unfilled-icon cursor-pointer"
            @click="copyToClipboard(image.link, 'imageLink')"
            v-tooltip="'Copy link'"
          >
            content_copy
          </button>
        </div>
      </div>
    </div>
    <div class="div-row align-items-center w-100">
      <div v-if="isLoadingImage" class="div-row align-items-center gap-10 ds-blue-color">
        <span class="material-symbols-rounded rotate-icon">progress_activity</span>
        <span class="font-12 text-600">
          {{ $t('title.uploading') }} {{ uploadProgress.current }} {{ $t('title.of') }}
          {{ uploadProgress.total }}...</span
        >
      </div>
      <div v-if="selectedFiles.length > 0" class="div-row align-items-center gap-10 ml-auto">
        <ButtonDefault
          :name="`${$t('button.clearFilters')} (${selectedFiles.length})`"
          @click="clearAllFiles"
          class="btn btn-c btn-light btn-light-c"
          :disabled="isLoadingImage"
          v-if="selectedFiles.length > 0"
        />
        <ButtonDefault
          :name="`${selectedFiles.length > 1 ? $t('button.uploadImages') : $t('button.uploadImage')} (${
            selectedFiles.length
          })`"
          @click="uploadAllImages"
          data-cy="button-upload-image"
          class="btn btn-c btn-lg btn-success btn-success-c"
          :disabled="isLoadingImage || isMessageInUse"
          :loading="isLoadingImage"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import ApiService from '@/services/api.service';
import ToastService from '@/services/toast.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

@Component({
  components: {
    ButtonDefault,
  },
  props: ['isMessageInUse', 'messageId'],
})
export default class ImageUpload extends Vue {
  @Prop() isMessageInUse!: boolean;
  @Prop() messageId!: number;

  private readonly apiService = new ApiService();
  private readonly toastService = new ToastService();

  selectedFiles: File[] = [];
  uploadedImages: { file: File; link: string; data: string }[] = [];
  isLoadingImage = false;
  dragging = false;
  uploadProgress = { current: 0, total: 0 };

  onFileSelect(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files || []);

    this.addFilesToSelection(files);
    target.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;

    const files = Array.from(event.dataTransfer?.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length !== files.length) {
      this.toastService.show({
        type: 'warning',
        text: this.$t('alert.ignoredNonImageFiles', { count: files.length - imageFiles.length }) as string,
      });
    }

    this.addFilesToSelection(imageFiles);
  }

  addFilesToSelection(files: File[]) {
    const validFiles = files.filter((file) => {
      const isDuplicate = this.selectedFiles.some(
        (existingFile) => existingFile.name === file.name && existingFile.size === file.size
      );

      if (isDuplicate) {
        this.toastService.show({
          type: 'warning',
          text: this.$t('alert.fileAlreadySelected', { name: file.name }) as string,
        });
        return false;
      }

      if (!file.type.startsWith('image/')) {
        this.toastService.show({
          type: 'error',
          text: this.$t('alert.invalidImageFile', { name: file.name }) as string,
        });
        return false;
      }

      return true;
    });

    this.selectedFiles.push(...validFiles);
  }

  async uploadAllImages() {
    if (this.selectedFiles.length === 0) {
      return;
    }

    this.isLoadingImage = true;
    this.uploadProgress = { current: 0, total: this.selectedFiles.length };

    try {
      const uploadPromises = this.selectedFiles.map(async (file, index) => {
        try {
          const imageData = await this.getBase64(file);

          const uploadData = [
            {
              messageId: this.messageId || 0,
              isAutomatedMessage: true,
              data: imageData,
              name: file.name,
            },
          ];

          const response = await this.apiService.uploadImages(uploadData);
          const link = response?.data[0]?.link;

          if (link) {
            this.uploadProgress.current++;
            return { file, link, data: imageData };
          } else {
            throw new Error(this.$t('alert.noLinkReturnedFromServer') as string);
          }
        } catch (error) {
          this.toastService.show({
            type: 'error',
            text: this.$t('alert.failedToUpload', { name: file.name, error }) as string,
          });
          throw error;
        }
      });

      const results = await Promise.allSettled(uploadPromises);

      const successfulUploads = results
        .filter(
          (result): result is PromiseFulfilledResult<{ file: File; link: string; data: string }> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);

      this.uploadedImages.push(...successfulUploads);

      this.selectedFiles = [];

      const successCount = successfulUploads.length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        this.toastService.show({
          type: 'success',
          text: this.$t('alert.imageUploadedSuccessfully', { count: successCount }) as string,
        });
      }

      if (failCount > 0) {
        this.toastService.show({
          type: 'warning',
          text: this.$t('alert.imageFailedToUpload', { count: failCount }) as string,
        });
      }
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: this.$t('alert.errorDuringBatchUpload') as string,
      });
    } finally {
      this.isLoadingImage = false;
      this.uploadProgress = { current: 0, total: 0 };
      this.clearAllFiles();
    }
  }

  async getBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  removeSelectedFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  clearAllFiles() {
    this.selectedFiles = [];
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  copyToClipboard(link: string | string[], type: string) {
    if ((Array.isArray(link) && link.every((item) => item === '')) || link === '') {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.noLink') as string,
      });
    } else if (type === 'linksList') {
      navigator.clipboard.writeText(JSON.stringify(link));
      this.toastService.show({
        type: 'success',
        text: this.$t('toast.linksCopied') as string,
      });
    } else if (type === 'imageLink') {
      navigator.clipboard.writeText(link as string);
      this.toastService.show({
        type: 'success',
        text: this.$t('toast.imageLinkCopied') as string,
      });
    }
  }

  closeUploadImageDialog() {
    this.$emit('closeUploadImageDialog');
    this.clearAllFiles();
    this.uploadedImages = [];
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/bs-layout.scss';
@import '@/assets/styles/variables.scss';

.generate-links-dialog {
  width: 600px;
  background-color: $neutral-basic-white;
  border-radius: 16px;
}

.trash-can-icon:hover {
  color: $ds-gray;
}

.close-icon {
  font-size: 36px;
  margin-right: -6px;
}

.image-link-container {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  background-color: $neutral-basic-white;
}

.image-inputs {
  height: 36px;
  padding: 10px;
}

.links-list {
  width: 95%;
}

@keyframes rotateRight {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.copy-icon {
  width: 5%;
  text-align: end;
}

.image-size {
  width: 50px;
  height: 50px;
  object-fit: contain;
}

.dropZone {
  height: 60px;
  justify-content: center;
  display: flex;
  align-items: center;
  flex-direction: column;
  outline: 1px dashed $ds-blue;
  border-radius: 4px;
  position: relative;
  transition: margin 0.15s ease-in-out, height 0.15s ease-in-out, background-color 0.15s linear;
}

.dash-blue:hover .dropZone-title {
  color: $ds-blue-dark !important;
}

.dropZone input {
  cursor: pointer !important;
  top: 0px;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  position: absolute;
}

.dropZone-over {
  margin: 3px;
  height: 54px;
  background-color: #f4f8ff;
  border-radius: 8px;
}

.files-to-upload {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
}

.selected-files-list {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 5px;
  margin-right: -5px;
  gap: 8px;
}

.file-item {
  border: 1px solid $ds-gray-200;
  border-radius: 6px;
}

.remove-file-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: $ds-gray-400;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: $ds-gray;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.image-list {
  max-height: 300px;
  overflow-y: auto;
  width: 100%;
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  background-color: $neutral-basic-white;
}

.image-links {
  width: 100%;
  border-bottom: 1px solid $ds-gray-300;
  &:last-child {
    border-bottom: none;
  }
}

.image-link-text {
  width: 42rem;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.preview-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: $ds-gray-400;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: $ds-blue-100;
    color: $ds-blue;
  }
}

.rotate-icon {
  animation: rotateRight 2s linear infinite;
}

.buttons-container {
  align-self: flex-end;
}
</style>
