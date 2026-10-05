import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DraftWorkspace from '../../../apps/web/src/drafts/DraftWorkspace.vue';
import { DraftStore } from '../../../apps/web/src/drafts/store';
import type { Draft } from '../../../apps/web/src/drafts/store';

let factory: IDBFactory;
const wrappers: VueWrapper[] = [];
beforeEach(() => { factory = new IDBFactory(); vi.stubGlobal('indexedDB', factory); });
afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers.length = 0;
  vi.unstubAllGlobals(); document.body.replaceChildren();
});
function render(): VueWrapper {
  const wrapper = mount(DraftWorkspace, { attachTo: document.body }); wrappers.push(wrapper); return wrapper;
}
async function inspect(): Promise<Draft[]> {
  const store = new DraftStore(factory);
  try { await store.open(); return await store.list(); } finally { store.close(); }
}

it('does not persist the example until editing, then saves unsupported source exactly', async () => {
  const wrapper = render();
  await vi.waitFor(() => expect(wrapper.find('.editor-modes button:last-child').attributes('disabled')).toBeUndefined());
  expect(await inspect()).toEqual([]);
  await wrapper.get('.editor-modes button:last-child').trigger('click');
  const source = '<script>中文原稿</script>\n';
  await wrapper.get('textarea').setValue(source);
  await vi.waitFor(() => expect(wrapper.get('.draft-status').text()).toContain('已保存到当前浏览器'));
  expect((await inspect())[0]?.markdown).toBe(source);
  expect((await inspect())[0]?.mode).toBe('source');
  expect(wrapper.find('script').exists()).toBe(false);
});

it('offers explicit recovery and forks the chosen raw source without overwriting it', async () => {
  const store = new DraftStore(factory); await store.open();
  const original: Draft = { id: crypto.randomUUID(), markdown: '<b>未支持原文</b>\r\n', mode: 'source', schemaVersion: 1, scope: 'preview', updatedAt: new Date().toISOString() };
  await store.save(original); store.close();
  const wrapper = render();
  await vi.waitFor(() => expect(wrapper.find('#draft-selection').exists()).toBe(true));
  expect(wrapper.find('textarea').exists()).toBe(false);
  await wrapper.get('.draft-panel > button').trigger('click');
  await vi.waitFor(() => expect(wrapper.find('textarea').exists()).toBe(true));
  // Native textareas normalize CRLF to LF for display; stored recovery copies remain exact.
  expect(wrapper.get('textarea').element.value).toBe(original.markdown.replaceAll('\r\n', '\n'));
  await vi.waitFor(async () => expect(await inspect()).toHaveLength(2));
  expect(await inspect()).toContainEqual(original);
});

it('starts a fresh session without removing an existing draft', async () => {
  const store = new DraftStore(factory); await store.open();
  const original: Draft = { id: crypto.randomUUID(), markdown: '保留我', mode: 'source', schemaVersion: 1, scope: 'preview', updatedAt: new Date().toISOString() };
  await store.save(original); store.close();
  const wrapper = render();
  await vi.waitFor(() => expect(wrapper.find('#draft-selection').exists()).toBe(true));
  await wrapper.get('button:nth-of-type(2)').trigger('click');
  await vi.waitFor(() => expect(wrapper.find('.markdown-workspace').exists()).toBe(true));
  expect(await inspect()).toEqual([original]);
});

it('keeps editing available without storage, shows failure, and warns before leaving', async () => {
  vi.stubGlobal('indexedDB', undefined);
  const wrapper = render();
  await vi.waitFor(() => expect(wrapper.find('.editor-modes button:last-child').attributes('disabled')).toBeUndefined());
  expect(wrapper.get('.draft-status[role="alert"]').text()).toContain('失败');
  await wrapper.get('.editor-modes button:last-child').trigger('click');
  await wrapper.get('textarea').setValue('不能丢失的原文');
  await vi.waitFor(() => expect(wrapper.get('.draft-status[role="alert"]').text()).toContain('失败'));
  const event = new Event('beforeunload', { cancelable: true });
  globalThis.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(wrapper.get('textarea').element.value).toBe('不能丢失的原文');
  await wrapper.get('.draft-panel > button').trigger('click');
  await vi.waitFor(() => expect(wrapper.get('.draft-status[role="alert"]').text()).toContain('失败'));
});
