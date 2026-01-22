export function createMarkdownRenderer(options = {}) {
    const defaults = {
        html: true,
        breaks: true,
        linkify: true,
        highlight: function (str, lang) {
            let modeName = lang;
            let mime = lang;

            // 1. Try to find by Name or Alias (e.g. 'js', 'javascript')
            if (window.CodeMirror.findModeByName) {
                const found = window.CodeMirror.findModeByName(lang);
                if (found) {
                    modeName = found.mode;
                    mime = found.mime || found.mode;
                }
            }

            // 2. Fallback: Try to find by Extension (e.g. 'py', 'sh', 'h')
            if (modeName === lang && window.CodeMirror.findModeByExtension) {
                const found = window.CodeMirror.findModeByExtension(lang);
                if (found) {
                    modeName = found.mode;
                    mime = found.mime || found.mode;
                }
            }

            // 3. Fallback: Try to find by MIME (e.g. 'text/x-python')
            if (modeName === lang && window.CodeMirror.findModeByMIME) {
                const found = window.CodeMirror.findModeByMIME(lang);
                if (found) {
                    modeName = found.mode;
                    mime = found.mime || found.mode;
                }
            }

            // Fallback to plain text if mode is not loaded
            // We check if the implementing mode (e.g. 'clike') is loaded
            if (!window.CodeMirror.modes[modeName] && window.CodeMirror.modes[lang]) {
                modeName = lang;
                mime = lang;
            }

            if (window.CodeMirror.modes[modeName] || window.CodeMirror.modes[lang]) {
                // If the specific mode logic is loaded, run using the MIME type 
                // (MIME is specific, e.g. text/x-java vs clike basic)
                const finalMode = window.CodeMirror.modes[modeName] ? mime : lang;
                let html = '';
                window.CodeMirror.runMode(str, finalMode, (text, style) => {
                    let className = style ? 'cm-' + style.replace(/ +/g, ' cm-') : '';
                    html += className ? '<span class="' + className + '">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' : text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
                });
                return '<pre class="cm-s-default"><code>' + html + '</code></pre>';
            }

            const escapeHtml = (unsafe) => {
                return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
            };

            return '<pre class="cm-s-default"><code>' + escapeHtml(str) + '</code></pre>';


        }
    };

    const config = { ...defaults, ...options };

    if (typeof window.markdownit !== 'function') {
        console.error('markdown-it is not loaded in window object');
        return { render: (text) => text };
    }

    const md = window.markdownit(config);

    const defaultRenderToken = md.renderer.renderToken.bind(md.renderer);
    md.renderer.renderToken = function (tokens, idx, options) {
        const token = tokens[idx];
        if (token.level === 0 && token.map && token.map[0] >= 0) {
            token.attrJoin('data-source-line', String(token.map[0]));
        }
        return defaultRenderToken(tokens, idx, options);
    };

    return md;
}
