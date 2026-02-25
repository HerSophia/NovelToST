import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStore = defineStore('novelToST/ui', () => {
  const mounted = ref(false);
  const busy = ref(false);
  const statusMessage = ref('就绪');

  const showStopConfirmModal = ref(false);
  const showResetConfirmModal = ref(false);
  const showErrorModal = ref(false);
  const errorDetail = ref('');

  const setMounted = (value: boolean) => {
    mounted.value = value;
  };

  const setBusy = (value: boolean) => {
    busy.value = value;
  };

  const setStatusMessage = (message: string) => {
    statusMessage.value = message;
  };

  const openStopConfirmModal = () => {
    showStopConfirmModal.value = true;
  };

  const closeStopConfirmModal = () => {
    showStopConfirmModal.value = false;
  };

  const openResetConfirmModal = () => {
    showResetConfirmModal.value = true;
  };

  const closeResetConfirmModal = () => {
    showResetConfirmModal.value = false;
  };

  const openErrorModal = (message: string) => {
    errorDetail.value = message;
    showErrorModal.value = true;
  };

  const closeErrorModal = () => {
    showErrorModal.value = false;
  };

  return {
    mounted,
    busy,
    statusMessage,
    showStopConfirmModal,
    showResetConfirmModal,
    showErrorModal,
    errorDetail,

    setMounted,
    setBusy,
    setStatusMessage,
    openStopConfirmModal,
    closeStopConfirmModal,
    openResetConfirmModal,
    closeResetConfirmModal,
    openErrorModal,
    closeErrorModal,
  };
});
