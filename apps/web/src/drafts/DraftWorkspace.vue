<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '@snaptium/i18n';
import { DraftStore } from './store';
import type { Draft, DraftMode } from './store';
import { DraftWriter } from './writer';
import type { SaveState } from './writer';

const MarkdownEditor = defineAsyncComponent(() => import('@snaptium/editor').then((module) => module.MarkdownEditor));
const store = new DraftStore(globalThis.indexedDB);
const candidates = ref<Draft[]>([]);
const loading = ref(true);
const choosing = ref(false);
const selected = ref('');
const initial = ref(t('editorSample'));
const initialMode = ref<DraftMode>('rich');
const state = ref<SaveState>('draftIdle');
const failed = computed(() => state.value === 'draftStorageFailed');
let id = '';
let disposed = false;
const writer = new DraftWriter((draft) => store.save(draft), (value) => { if (!disposed) state.value = value; });

function save(snapshot: { markdown: string; mode: DraftMode }): void {
  writer.submit({ ...snapshot, id, scope: 'preview', schemaVersion: 1, updatedAt: new Date().toISOString() });
}

function start(recovered?: Draft): void {
  id = globalThis.crypto.randomUUID();
  choosing.value = false;
  if (recovered) {
    initial.value = recovered.markdown;
    initialMode.value = recovered.mode;
    save({ markdown: recovered.markdown, mode: recovered.mode });
  }
}

function restore(): void {
  const recovered = candidates.value.find((draft) => draft.id === selected.value);
  if (recovered) start(recovered);
}

function warnBeforeUnload(event: BeforeUnloadEvent): void {
  if (writer.dirty) { event.preventDefault(); event.returnValue = ''; }
}

onMounted(async () => {
  globalThis.addEventListener('beforeunload', warnBeforeUnload);
  try {
    await store.open();
    const drafts = await store.list();
    if (disposed) return;
    candidates.value = drafts;
    choosing.value = drafts.length > 0;
    selected.value = drafts[0]?.id ?? '';
  } catch { if (!disposed) state.value = 'draftStorageFailed'; }
  finally {
    if (!disposed) { loading.value = false; if (!choosing.value) start(); }
    else store.close();
  }
});

onBeforeUnmount(() => {
  disposed = true;
  globalThis.removeEventListener('beforeunload', warnBeforeUnload);
  void writer.settled().then(() => store.close());
});
</script>

<template>
  <section
    class="draft-panel"
    :aria-label="t('draftTitle')"
  >
    <p
      v-if="loading"
      role="status"
    >
      {{ t('draftLoading') }}
    </p>
    <template v-else-if="choosing">
      <h2>{{ t('draftRecoveryTitle') }}</h2>
      <p>{{ t('draftRecoveryDescription') }}</p>
      <label for="draft-selection">{{ t('draftSelection') }}</label>
      <select
        id="draft-selection"
        v-model="selected"
      >
        <option
          v-for="draft in candidates"
          :key="draft.id"
          :value="draft.id"
        >
          {{ draft.updatedAt }}
        </option>
      </select>
      <button
        type="button"
        @click="restore"
      >
        {{ t('draftRestore') }}
      </button>
      <button
        type="button"
        @click="start()"
      >
        {{ t('draftStartFresh') }}
      </button>
    </template>
    <template v-else>
      <p
        :role="failed ? 'alert' : 'status'"
        class="draft-status"
      >
        {{ t(state) }}
      </p>
      <button
        v-if="failed && writer.dirty"
        type="button"
        @click="writer.retry()"
      >
        {{ t('draftRetry') }}
      </button>
      <MarkdownEditor
        :initial-markdown="initial"
        :initial-mode="initialMode"
        :notice="t('draftNotice')"
        @draft="save"
      />
    </template>
  </section>
</template>
