<template>
  <div class="image-input" :style="{ 'background-image': `url(${imageUrl})` }" @click="chooseImage">
    <v-avatar color="red" class="placeholder" v-if="!imageUrl" size="100">
      <i class="item-icon material-symbols-rounded font-24" aria-hidden="true" alt="ethernet icon">upload</i>
    </v-avatar>
    <input class="file-input" ref="fileInput" type="file" @input="onSelectFile" />
  </div>
</template>

<script lang="js">
// TODO: Refactor using typescript
export default {
  name: 'ImageInput',
  props: { loadImage: String },

  data() {
    return {
      imageUrl: '',
    };
  },

  mounted() {
    this.imageUrl = this.$props.loadImage;
  },

  methods: {
    chooseImage() {
      this.$refs.fileInput.click();
    },

    onSelectFile() {
      const input = this.$refs.fileInput;
      const files = input.files;
      if (files && files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.imageUrl = e.target.result;
        };

        reader.readAsDataURL(files[0]);
        this.$emit('input', files[0]);
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.image-input {
  display: block;
  width: 100px;
  height: 100px;
  cursor: pointer;
  background-size: cover;
  background-position: center center;
  border-radius: 50%;
  background-image: var(--image);
}
.placeholder {
  background: $ds-blue !important;
  color: #e0e0e0 !important;
  justify-content: center !important;
  align-items: center !important;
}

.item-icon {
  font-size: 32px !important;
}
.placeholder:hover {
  background: #e0e0e0;
}
.file-input {
  display: none;
}
</style>
