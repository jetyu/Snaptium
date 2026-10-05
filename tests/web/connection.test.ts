import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../apps/web/src/App.vue';
import { healthSchema } from '@snaptium/contracts';
import health from '../fixtures/health.json';

afterEach(() => { vi.unstubAllGlobals(); });

describe('service boundary', () => {
  it('accepts the shared fixture and compatible additive fields', () => {
    expect(healthSchema.parse({ ...health, futureField: true })).toEqual(health);
  });
  it('rejects unsupported storage modes and malformed responses', () => {
    expect(healthSchema.safeParse({ ...health, storage: 'ready' }).success).toBe(false);
    expect(healthSchema.safeParse({ status: 'ok' }).success).toBe(false);
  });
  it('shows connection state without claiming note persistence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(health))));
    const wrapper = mount(App);
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('服务已连接'));
    expect(wrapper.text()).toContain('尚未开放笔记保存');
    wrapper.unmount();
  });
  it('handles unavailable or incompatible service and permits retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(health)));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mount(App);
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('服务不可用'));
    await wrapper.get('button').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('服务已连接'));
    wrapper.unmount();
  });
  it('aborts the pending request on unmount', () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_input: unknown, init: RequestInit) => {
      if (init.signal instanceof AbortSignal) requestSignal = init.signal;
      return new Promise<Response>(() => {});
    }));
    const wrapper = mount(App);
    wrapper.unmount();
    expect(requestSignal?.aborted).toBe(true);
  });
});
