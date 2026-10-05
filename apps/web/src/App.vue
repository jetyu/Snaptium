<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '@snaptium/i18n';
import { ServiceStatus } from '@snaptium/ui';
import type { Health } from '@snaptium/contracts';
import { fetchHealth } from './api';
import DraftWorkspace from './drafts/DraftWorkspace.vue';
import IdentityPanel from './identity/IdentityPanel.vue';

const status = ref<'checking' | 'available' | 'unavailable'>('checking');
const health = ref<Health | null>(null);
let activeRequest: AbortController | undefined;

async function checkConnection(): Promise<void> {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  status.value = 'checking';
  health.value = null;
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const result = await fetchHealth(controller.signal);
    if (activeRequest !== controller) return;
    health.value = result;
    status.value = 'available';
  } catch {
    if (activeRequest === controller) status.value = 'unavailable';
  } finally {
    clearTimeout(timeout);
  }
}

onMounted(() => { void checkConnection(); });
onBeforeUnmount(() => { activeRequest?.abort(); activeRequest = undefined; });
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a
        class="brand"
        href="/"
        aria-label="Snaptium"
      ><span
        class="brand-mark"
        aria-hidden="true"
      >S</span>Snaptium</a>
      <span class="release-label">{{ t('stage') }}</span>
    </header>
    <main>
      <section
        class="intro"
        aria-labelledby="welcome-title"
      >
        <p class="eyebrow">
          {{ t('eyebrow') }}
        </p>
        <h1 id="welcome-title">
          {{ t('welcome') }}
        </h1>
        <p class="description">
          {{ t('description') }}
        </p>
      </section>
      <section
        class="connection-card"
        aria-labelledby="connection-title"
      >
        <div class="card-heading">
          <div>
            <p class="eyebrow">
              {{ t('connectionEyebrow') }}
            </p><h2 id="connection-title">
              {{ t('connectionTitle') }}
            </h2>
          </div>
          <ServiceStatus :status="status" />
        </div>
        <p class="connection-description">
          {{ t(status === 'unavailable' ? 'connectionFailed' : 'connectionDescription') }}
        </p>
        <dl
          v-if="health"
          class="service-details"
        >
          <div><dt>{{ t('version') }}</dt><dd>{{ health.version }}</dd></div>
          <div><dt>{{ t('serviceMode') }}</dt><dd>{{ t(health.mode === 'identity' ? 'identityMode' : 'foundationMode') }}</dd></div>
        </dl>
        <button
          class="primary-button"
          :disabled="status === 'checking'"
          @click="checkConnection"
        >
          {{ t('retry') }}
        </button>
      </section>
      <IdentityPanel v-if="health?.mode === 'identity'" />
      <DraftWorkspace />
      <section
        class="next-card"
        aria-labelledby="next-title"
      >
        <span
          class="step-number"
          aria-hidden="true"
        >01</span>
        <div>
          <h2 id="next-title">
            {{ t('nextTitle') }}
          </h2><p>{{ t('nextDescription') }}</p>
        </div>
      </section>
      <p class="security-note">
        {{ t('securityNote') }}
      </p>
    </main>
    <footer>{{ t('footer') }}</footer>
  </div>
</template>
