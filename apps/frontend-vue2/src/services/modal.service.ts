import Modal from '@/components/common/Modal.vue';
import Vue from 'vue';
export default class ModalService extends Vue {
  confirm(options: {
    confirmFunction?: any;
    cancelFunction?: any;
    title?: string;
    text?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: string;
    showClose?: boolean;
    width?: number;
    view?: boolean;
    disabledCancel?: boolean;
    disabledConfirm?: boolean;
    disabledClose?: boolean;
    isConfirm?: boolean;
  }) {
    this.$modal.show(
      {
        render(h: any) {
          const modalSelf: any = this;
          return h(Modal, {
            props: {
              title: options.title,
              text: options.text,
              confirmLabel: options.confirmLabel,
              cancelLabel: options.cancelLabel,
              confirmFunction: options.confirmFunction,
              cancelFunction: options.cancelFunction,
              type: options.type,
              custom: false,
              showClose: options.showClose,
              view: options.view,
              disabledCancel: options.disabledCancel,
              disabledConfirm: options.disabledConfirm,
              disabledClose: options.disabledClose,
              isConfirm: options.isConfirm,
            },
            on: {
              onConfirm() {
                if (options.confirmFunction) {
                  options.confirmFunction();
                }
                modalSelf.$emit('close');
              },
              onCancel() {
                if (options.cancelFunction) {
                  options.cancelFunction();
                }
                modalSelf.$emit('close');
              },
              onClose() {
                modalSelf.$emit('close');
              },
            },
          });
        },
      },
      {},
      {
        name: 'ConfirmDialog',
        width: options.width ? options.width : 398,
        height: 'auto',
        adaptive: true,
        focusTrap: true,
      }
    );
  }

  customDialog(options: {
    title: string;
    customComponent: any;
    confirmButtons?: boolean;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmFunction?: any;
    width?: number;
    data?: any;
    onEmitDataFunction?: any;
    showClose?: boolean;
    customTitleClass?: string;
  }) {
    this.$modal.show(
      {
        render(h: any) {
          const modalSelf: any = this;
          return h(Modal, {
            props: {
              title: options.title,
              confirmLabel: options.confirmLabel,
              cancelLabel: options.cancelLabel,
              customComponent: options.customComponent,
              confirmButtons: options.confirmButtons,
              custom: true,
              data: options.data,
              onEmitDataFunction: options.onEmitDataFunction,
              showClose: options.showClose,
              customTitleClass: options.customTitleClass,
            },
            on: {
              onConfirm() {
                if (options.confirmFunction) {
                  options.confirmFunction();
                }
                modalSelf.$emit('close');
              },
              onCancel() {
                modalSelf.$emit('close');
              },
              onClose() {
                modalSelf.$emit('close');
              },
              onEmitDataFunction(event: any) {
                if (options.onEmitDataFunction) {
                  options.onEmitDataFunction(event);
                }
                modalSelf.$emit('close');
              },
            },
          });
        },
      },
      {},
      {
        name: 'CustomDialog',
        width: options.width ? options.width : 398,
        height: 'auto',
        adaptive: true,
      }
    );
  }

  hide() {
    this.$modal.hide('ConfirmDialog');
    this.$modal.hide('CustomDialog');
  }
}
