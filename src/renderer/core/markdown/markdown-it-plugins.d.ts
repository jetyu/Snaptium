declare module 'markdown-it-katex' {
  import type MarkdownIt from 'markdown-it';

  interface MarkdownItKatexOptions {
    throwOnError?: boolean;
    errorColor?: string;
  }

  const plugin: (md: MarkdownIt, options?: MarkdownItKatexOptions) => void;
  export default plugin;
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';

  interface MarkdownItTaskListOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  const plugin: (md: MarkdownIt, options?: MarkdownItTaskListOptions) => void;
  export default plugin;
}
