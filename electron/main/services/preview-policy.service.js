import {
  DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS,
  isTrustedRemoteImageUrl,
  normalizeTrustedRemoteImageHosts,
} from '../../shared/preview-security.constants.js';

const DEV_SERVER_IMAGE_ORIGIN = 'http://127.0.0.1:5173';

const currentPreviewAppearance = {
  allowHtml: true,
  allowInlineSvg: true,
  remoteImageMode: 'trusted',
  trustedRemoteImageHosts: [...DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS],
};

function clonePreviewAppearance() {
  return {
    ...currentPreviewAppearance,
    trustedRemoteImageHosts: [...currentPreviewAppearance.trustedRemoteImageHosts],
  };
}

function normalizePreviewAppearance(config = {}) {
  const remoteImageMode = config.remoteImageMode === 'blocked' ? 'blocked' : 
                         config.remoteImageMode === 'all' ? 'all' : 'trusted';
  return {
    allowHtml: config.allowHtml !== false,
    allowInlineSvg: config.allowInlineSvg !== false,
    remoteImageMode,
    trustedRemoteImageHosts: normalizeTrustedRemoteImageHosts(config.trustedRemoteImageHosts),
  };
}

export const previewPolicyService = {
  updateConfig(config = {}) {
    const previewAppearance = normalizePreviewAppearance(config.previewAppearance ?? config);
    currentPreviewAppearance.allowHtml = previewAppearance.allowHtml;
    currentPreviewAppearance.allowInlineSvg = previewAppearance.allowInlineSvg;
    currentPreviewAppearance.remoteImageMode = previewAppearance.remoteImageMode;
    currentPreviewAppearance.trustedRemoteImageHosts = [...previewAppearance.trustedRemoteImageHosts];
    return clonePreviewAppearance();
  },

  getPreviewAppearance() {
    return clonePreviewAppearance();
  },

  buildContentSecurityPolicy({ isDev = false } = {}) {
    const imageSources = ["'self'", 'data:', 'blob:', 'note-resource:', 'https:'];
    if (isDev) {
      imageSources.push(DEV_SERVER_IMAGE_ORIGIN);
    }

    return [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imageSources.join(' ')}`,
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      "frame-src 'none'",
    ].join('; ');
  },

  isAllowedRemoteImageRequest(url, { isDev = false } = {}) {
    try {
      const parsedUrl = new URL(String(url ?? ''));
      if (isDev && parsedUrl.origin === DEV_SERVER_IMAGE_ORIGIN) {
        return true;
      }

      if (currentPreviewAppearance.remoteImageMode === 'all') {
        return true;
      }

      if (currentPreviewAppearance.remoteImageMode !== 'trusted') {
        return false;
      }

      return isTrustedRemoteImageUrl(parsedUrl.toString(), currentPreviewAppearance.trustedRemoteImageHosts);
    } catch {
      return false;
    }
  },
};
