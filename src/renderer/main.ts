import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app/App.vue';
import { i18n } from '@renderer/features/i18n';
import './styles/main.css';

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.mount('#app');
