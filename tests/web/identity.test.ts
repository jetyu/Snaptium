import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapRequestSchema, healthSchema, sessionSchema } from '@snaptium/contracts';
import IdentityPanel from '../../apps/web/src/identity/IdentityPanel.vue';
import { fetchSession, loginAccount } from '../../apps/web/src/api';
import session from '../fixtures/session-authenticated.json';
import identityHealth from '../fixtures/health-identity.json';

const anonymous = { state: 'anonymous', bootstrapRequired: false };
const requestId = '019b7da0-0000-7000-8000-000000000001';
function json(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { status }); }
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Web identity boundary', () => {
  it('accepts shared fixtures without confusing storage or session states', () => {
    expect(healthSchema.parse(identityHealth)).toEqual(identityHealth);
    expect(sessionSchema.parse(session)).toEqual(session);
    expect(sessionSchema.parse(anonymous)).toEqual(anonymous);
    expect(sessionSchema.safeParse({ ...session, csrfToken: 'short' }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...session, account: { ...session.account, id: 'other' } }).success).toBe(false);
    expect(healthSchema.safeParse({ ...identityHealth, mode: 'foundation' }).success).toBe(false);
    expect(bootstrapRequestSchema.safeParse({ login: 'alice', password: '密码'.repeat(600), initializationSecret: session.csrfToken }).success).toBe(false);
    expect(bootstrapRequestSchema.safeParse({ login: 'alice', password: '密码'.repeat(8), initializationSecret: session.csrfToken }).success).toBe(true);
  });
  it('sends credentials in a same-origin POST without redirects or persistent browser storage', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(session));
    vi.stubGlobal('fetch', fetchMock);
    await loginAccount({ login: 'alice', password: 'test password 长度足够' }, new AbortController().signal);
    const [path, init] = fetchMock.mock.calls[0] ?? ['', undefined];
    expect(path).toBe('/api/v1/auth/login');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toMatchObject({ 'X-Snaptium-Request': 'web-v1', 'Content-Type': 'application/json' });
    expect(storageWrite).not.toHaveBeenCalled();
  });
  it('rejects malformed and oversized identity responses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ state: 'authenticated' }))
      .mockResolvedValueOnce(new Response('x'.repeat(4097)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchSession(new AbortController().signal)).rejects.toThrow();
    await expect(fetchSession(new AbortController().signal)).rejects.toThrow('unavailable');
  });
});

describe('identity panel', () => {
  it('initializes an administrator, clears secrets and offers normal login', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ ...anonymous, bootstrapRequired: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json(anonymous));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mount(IdentityPanel);
    await flushPromises();
    await wrapper.get('#identity-login').setValue('alice');
    await wrapper.get('#identity-password').setValue('test password 长度足够');
    await wrapper.get('#identity-secret').setValue(session.csrfToken);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('管理员初始化已完成');
    expect(wrapper.find('#identity-secret').exists()).toBe(false);
    expect(wrapper.get<HTMLInputElement>('#identity-password').element.value).toBe('');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/bootstrap');
    wrapper.unmount();
  });
  it('logs in, keeps tokens out of UI and confirms CSRF logout without another status request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(anonymous)).mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockRejectedValueOnce(new Error('status_unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mount(IdentityPanel);
    await flushPromises();
    await wrapper.get('#identity-login').setValue('alice');
    await wrapper.get('#identity-password').setValue('test password 长度足够');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('已登录');
    expect(wrapper.text()).not.toContain(session.csrfToken);
    await wrapper.get('.primary-button').trigger('click');
    await flushPromises();
    const init: RequestInit | undefined = fetchMock.mock.calls[2]?.[1];
    expect(init?.headers).toMatchObject({ 'X-CSRF-Token': session.csrfToken });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.get<HTMLInputElement>('#identity-password').element.value).toBe('');
    wrapper.unmount();
  });
  it('shows generic failures, clears password and does not render server input', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(anonymous)).mockResolvedValueOnce(json({
      code: 'authentication_rejected', requestId, detail: 'unsafe server echo',
    }, 401));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mount(IdentityPanel);
    await flushPromises();
    await wrapper.get('#identity-login').setValue('alice');
    await wrapper.get('#identity-password').setValue('wrong password');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('账号、密码或初始化权限无效');
    expect(wrapper.text()).not.toContain('unsafe server echo');
    expect(wrapper.get<HTMLInputElement>('#identity-password').element.value).toBe('');
    wrapper.unmount();
  });
  it('documents throttling and permits checking status again', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(anonymous))
      .mockResolvedValueOnce(json({ code: 'authentication_rejected', requestId }, 429)).mockResolvedValueOnce(json(anonymous));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mount(IdentityPanel);
    await flushPromises();
    await wrapper.get('#identity-login').setValue('alice');
    await wrapper.get('#identity-password').setValue('password');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('至少等待一分钟');
    await wrapper.get('.identity-retry').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('clears an expired authenticated state after rejected logout', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(session)).mockResolvedValueOnce(json({ code: 'authentication_rejected', requestId }, 401));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mount(IdentityPanel);
    await flushPromises();
    await wrapper.get('.primary-button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('已登录');
    expect(wrapper.get('[role="alert"]').text()).toContain('会话已失效');
    wrapper.unmount();
  });
  it('aborts in-flight access checks on unmount and ignores late responses', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_path: string, init: RequestInit) => {
      if (init.signal instanceof AbortSignal) signal = init.signal;
      return new Promise<Response>(() => {});
    }));
    const wrapper = mount(IdentityPanel);
    wrapper.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
