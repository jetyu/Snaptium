import { computed } from 'vue';
import type { LicensedFeature } from '@shared/license.constants';
import { useLicenseStore } from '../store/license.store';
import { useLicenseDialog } from './useLicenseDialog';

export function useLicenseGate(feature?: LicensedFeature) {
  const store = useLicenseStore();
  const { openLicenseDialog } = useLicenseDialog();

  const allowed = computed<boolean>(() => {
    if (!feature) {
      return true;
    }

    return store.canUse(feature);
  });

  function canUseFeature(nextFeature: LicensedFeature): boolean {
    return store.canUse(nextFeature);
  }

  function requestAccess(nextFeature?: LicensedFeature): boolean {
    const target = nextFeature ?? feature;
    if (!target) {
      return true;
    }

    const granted = store.canUse(target);
    if (!granted) {
      openLicenseDialog();
    }
    return granted;
  }

  return {
    allowed,
    canUseFeature,
    requestAccess,
  };
}

