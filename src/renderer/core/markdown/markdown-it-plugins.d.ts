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
