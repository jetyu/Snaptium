type MermaidRuntime = typeof import('mermaid').default;

const MERMAID_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

let mermaidRuntimePromise: Promise<MermaidRuntime> | null = null;

async function getMermaidRuntime() {
  if (!mermaidRuntimePromise) {
    mermaidRuntimePromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        fontFamily: MERMAID_FONT_FAMILY,
        themeVariables: {
          fontFamily: MERMAID_FONT_FAMILY,
          fontSize: '14px',
        },
      });
      return mermaid;
    });
  }

  return mermaidRuntimePromise;
}

export async function renderMarkdownEnhancements(root: HTMLElement | null) {
  if (!root) {
    return;
  }

  const mermaidNodes = root.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed="true"])');
  if (mermaidNodes.length === 0) {
    return;
  }

  const mermaid = await getMermaidRuntime();
  await mermaid.run({
    nodes: mermaidNodes,
    suppressErrors: true,
  });
}
