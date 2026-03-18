<template>
  <aside class="sidebar">
    <!-- 侧边栏顶部操作区 -->
    <div class="sidebar-header">
      <span class="sidebar-title">{{ $t('notes') }}</span>
      <button class="btn-new-note" :title="$t('newNote')" @click="createNote()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 笔记列表 -->
    <ul class="note-list">
      <li
        v-for="note in sortedNotes"
        :key="note.id"
        class="note-item"
        :class="{ active: note.id === activeNoteId }"
        @click="selectNote(note.id)"
      >
        <span class="note-item-title">{{ note.title }}</span>
        <span class="note-item-date">{{ formatDate(note.updatedAt) }}</span>
      </li>
    </ul>

    <!-- 无笔记时的空状态 -->
    <div v-if="notes.length === 0" class="sidebar-empty">
      <p>{{ $t('noNotes') || '还没有笔记' }}</p>
      <button class="btn-create-first" @click="createNote()">{{ $t('newNote') }}</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useWorkspace } from '@renderer/features/workspace';

const { 
  notes, 
  sortedNotes, 
  activeNoteId, 
  selectNote, 
  createNote 
} = useWorkspace();

const { t, locale } = useI18n();

// 格式化时间戳为相对时间
function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { n: minutes });
  if (hours < 24) return t('hoursAgo', { n: hours });
  if (days < 7) return t('daysAgo', { n: days });

  return new Date(ts).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
}
</script>
