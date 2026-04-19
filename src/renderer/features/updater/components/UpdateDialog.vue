<template>
  <div class="update-dialog">
    <UpdateNotification v-if="showNotification" :state="notificationState" :update-info="updateInfo" :error="error"
      @download="handleDownloadClick" @close="showNotification = false" @retry="handleRetry" />

    <UpdateProgressDialog :visible="showProgressDialog" :progress="downloadProgress" :error="error?.message"
      :cancellable="false" @retry="handleRetryDownload" />

    <UpdateInstallDialog :visible="showInstallDialog" :update-info="updateInfo" @install="handleInstall"
      @later="showInstallDialog = false" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import UpdateNotification from './UpdateNotification.vue';
import UpdateProgressDialog from './UpdateProgressDialog.vue';
import UpdateInstallDialog from './UpdateInstallDialog.vue';
import { useUpdater } from '../composables/useUpdater';

const {
  updateInfo,
  downloadProgress,
  error,
  showNotification,
  showProgressDialog,
  showInstallDialog,
  notificationState,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  initMainProcessListeners,
} = useUpdater();

const handleDownloadClick = () => {
  downloadUpdate();
};

const handleRetryDownload = () => {
  error.value = null;
  downloadUpdate();
};

const handleRetry = () => {
  checkForUpdates(false);
};

const handleInstall = () => {
  installUpdate();
};

let removeMenuListener = () => { };
onMounted(() => {
  removeMenuListener = initMainProcessListeners();
});

onUnmounted(() => {
  removeMenuListener();
});
</script>
