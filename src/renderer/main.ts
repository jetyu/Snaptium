import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app/App.vue';
import { i18n } from '@renderer/features/i18n';
import './styles/main.css';
import { registerRendererGlobalErrorHandlers } from '@renderer/core/error';
import { createLogger } from '@renderer/features/logger';
import { serializeError } from '@shared/utils/error.utils';
import 'katex/dist/katex.min.css';

const bootstrapLogger = createLogger('RendererBootstrap');

registerRendererGlobalErrorHandlers();

const app = createApp(App);
app.config.errorHandler = (error, instance, info) => {
  const serializedError = serializeError(error);
  bootstrapLogger.error('vue.errorHandler captured', {
    ...serializedError,
    info,
    component: instance?.$options?.name ?? null,
  });
};

app.use(createPinia());
app.use(i18n);
app.mount('#app');
