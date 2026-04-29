export {
  securityService,
  normalizeSecurityError,
  type AccessControlStatus,
  type E2eeStatus,
  type SecurityError,
} from './services/security.service';

export { default as AccessControlOverlay } from './components/AccessControlOverlay.vue';
export { default as E2eeUnlockModule } from './components/E2eeUnlockModule.vue';

