<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '@snaptium/i18n';
import type { MessageKey } from '@snaptium/i18n';
import type { WebSession } from '@snaptium/contracts';
import { bootstrapAdmin, fetchSession, IdentityApiError, loginAccount, logoutAccount } from '../api';

const session = ref<WebSession | null>(null);
const busy = ref(false);
const error = ref<MessageKey | null>(null);
const initialized = ref(false);
const login = ref('');
const password = ref('');
const secret = ref('');
let active: AbortController | undefined;
let activeTimeout: ReturnType<typeof setTimeout> | undefined;
const errorMessages: Record<IdentityApiError['code'], MessageKey> = {
  authentication_rejected: 'identityRejected', csrf_rejected: 'identityCsrfRejected',
  invalid_request: 'identityInvalid', throttled: 'identityThrottled', unavailable: 'identityUnavailable',
};

async function run(action: (signal: AbortSignal) => Promise<WebSession>): Promise<void> {
  active?.abort();
  clearTimeout(activeTimeout);
  const controller = new AbortController();
  active = controller;
  const timeout = setTimeout(() => controller.abort(), 10000);
  activeTimeout = timeout;
  busy.value = true;
  error.value = null;
  try {
    const result = await action(controller.signal);
    if (active === controller) session.value = result;
  } catch (failure: unknown) {
    if (active !== controller) return;
    error.value = failure instanceof IdentityApiError ? errorMessages[failure.code] : 'identityUnavailable';
    // An expired/revoked session cannot remain presented as signed in.
    if (session.value?.state === 'authenticated' && failure instanceof IdentityApiError && failure.code === 'authentication_rejected') session.value = null;
  } finally {
    clearTimeout(timeout);
    if (activeTimeout === timeout) activeTimeout = undefined;
    if (active === controller) { busy.value = false; password.value = ''; secret.value = ''; }
  }
}
async function refresh(): Promise<void> { await run(fetchSession); }
async function submit(): Promise<void> {
  const input = { login: login.value, password: password.value };
  const initializationSecret = secret.value;
  const bootstrap = session.value?.state === 'anonymous' && session.value.bootstrapRequired;
  await run(async signal => {
    if (bootstrap) {
      await bootstrapAdmin({ ...input, initializationSecret }, signal);
      const result = await fetchSession(signal);
      initialized.value = true;
      return result;
    }
    return loginAccount(input, signal);
  });
}
async function logout(): Promise<void> {
  const current = session.value;
  if (current?.state !== 'authenticated') return;
  await run(async signal => {
    await logoutAccount(current.csrfToken, signal);
    // A confirmed logout must not depend on a second network request.
    return { state: 'anonymous', bootstrapRequired: false };
  });
}
onMounted(() => { void refresh(); });
onBeforeUnmount(() => { active?.abort(); active = undefined; clearTimeout(activeTimeout); activeTimeout = undefined; password.value = ''; secret.value = ''; session.value = null; });
</script>

<template>
  <section
    class="identity-panel"
    aria-labelledby="identity-title"
  >
    <h2 id="identity-title">
      {{ t('identityTitle') }}
    </h2>
    <p>{{ t('identityNotice') }}</p>
    <p
      v-if="busy"
      aria-live="polite"
    >
      {{ t('identityWorking') }}
    </p>
    <p
      v-if="error"
      class="editor-error"
      role="alert"
    >
      {{ t(error) }}
    </p>
    <template v-if="session?.state === 'authenticated'">
      <p>{{ t('identitySignedIn') }} · {{ t(session.account.isAdmin ? 'identityAdministrator' : 'identityMember') }}</p>
      <button
        class="primary-button"
        :disabled="busy"
        @click="logout"
      >
        {{ t('identityLogout') }}
      </button>
    </template>
    <form
      v-else-if="session?.state === 'anonymous'"
      @submit.prevent="submit"
    >
      <p v-if="initialized">
        {{ t('identityInitialized') }}
      </p>
      <label for="identity-login">{{ t('identityLoginName') }}</label>
      <input
        id="identity-login"
        v-model="login"
        name="username"
        autocomplete="username"
        required
        minlength="3"
        maxlength="64"
        pattern="[a-z0-9._\-]+"
        :disabled="busy"
        aria-describedby="identity-login-hint"
      >
      <p id="identity-login-hint">
        {{ t('identityLoginHint') }}
      </p>
      <label for="identity-password">{{ t('identityPassword') }}</label>
      <input
        id="identity-password"
        v-model="password"
        name="password"
        type="password"
        :autocomplete="session.bootstrapRequired ? 'new-password' : 'current-password'"
        required
        maxlength="1024"
        :disabled="busy"
        :aria-describedby="session.bootstrapRequired ? 'identity-password-hint' : undefined"
      >
      <p
        v-if="session.bootstrapRequired"
        id="identity-password-hint"
      >
        {{ t('identityPasswordHint') }}
      </p>
      <template v-if="session.bootstrapRequired">
        <label for="identity-secret">{{ t('identitySecret') }}</label>
        <input
          id="identity-secret"
          v-model="secret"
          type="password"
          autocomplete="off"
          required
          minlength="64"
          maxlength="64"
          pattern="[0-9a-f]{64}"
          :disabled="busy"
          aria-describedby="identity-secret-hint"
        >
        <p id="identity-secret-hint">
          {{ t('identitySecretHint') }}
        </p>
      </template>
      <button
        class="primary-button"
        type="submit"
        :disabled="busy"
      >
        {{ t(session.bootstrapRequired ? 'identityBootstrap' : 'identityLogin') }}
      </button>
    </form>
    <button
      v-if="!busy"
      class="identity-retry"
      @click="refresh"
    >
      {{ t('identityRetry') }}
    </button>
  </section>
</template>
