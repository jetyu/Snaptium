import {
  Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx,
  rootCtx, serializerCtx, remarkStringifyOptionsCtx,
} from '@milkdown/kit/core';
import { commonmark, imageSchema } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose, getMarkdown, insert, replaceAll } from '@milkdown/kit/utils';
import { t } from '@snaptium/i18n';
import { canonicalLineEndings, MarkdownValidationError, validateMarkdown } from './markdown';
import type { MarkdownIssue } from './markdown';

export interface EditorOptions {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
  onReject?: (issue: MarkdownIssue) => void;
}

export function readMarkdown(editor: Editor): string {
  return canonicalLineEndings(editor.action(getMarkdown()));
}

export function replaceMarkdown(editor: Editor, markdown: string): void {
  validateMarkdown(markdown);
  editor.action(replaceAll(markdown));
}

export async function createMarkdownEditor(root: HTMLElement, options: EditorOptions): Promise<Editor> {
  validateMarkdown(options.initialMarkdown);
  const guard = $prose((ctx) => new Plugin({
    view: () => ({
      update(view, previous) {
        if (!view.state.doc.eq(previous.doc)) {
          options.onChange?.(canonicalLineEndings(ctx.get(serializerCtx)(view.state.doc)));
        }
      },
    }),
    filterTransaction(transaction) {
      if (!transaction.docChanged) return true;
      try {
        validateMarkdown(ctx.get(serializerCtx)(transaction.doc));
        return true;
      } catch (error: unknown) {
        options.onReject?.(error instanceof MarkdownValidationError ? error.code : 'editorUnavailable');
        return false;
      }
    },
    props: {
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData('text/plain');
        if (text === undefined || text === '') return true;
        try {
          validateMarkdown(text);
          insert(text)(ctx);
        } catch (error: unknown) {
          options.onReject?.(error instanceof MarkdownValidationError ? error.code : 'editorUnavailable');
        }
        // Do not let arbitrary clipboard HTML reach the DOM parser.
        return true;
      },
      handleDrop() { return true; },
      handleClick(_view, _position, event) {
        if (event.target instanceof Element && event.target.closest('a')) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  }));
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, options.initialMarkdown);
      ctx.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        attributes: { role: 'textbox', 'aria-label': t('editorBody'), 'aria-multiline': 'true' },
      }));
      ctx.set(remarkStringifyOptionsCtx, {
        ...ctx.get(remarkStringifyOptionsCtx), bullet: '-', emphasis: '*', strong: '*', fences: true, listItemIndent: 'one', rule: '-',
      });
      ctx.update(imageSchema.key, (previous) => (context) => ({
        ...previous(context),
        parseMarkdown: {
          match: (node) => node.type === 'image',
          runner(state, node, type) {
            const src: unknown = node.url;
            const alt: unknown = node.alt;
            const title: unknown = node.title;
            if (typeof src !== 'string') throw new MarkdownValidationError('unsafeUrl');
            state.addNode(type, {
              src,
              alt: typeof alt === 'string' ? alt : '',
              title: typeof title === 'string' ? title : '',
            });
          },
        },
        toDOM(node) {
          const alt: unknown = node.attrs.alt;
          return ['span', { class: 'editor-image-placeholder', contenteditable: 'false' },
            typeof alt === 'string' && alt ? `${t('imagePlaceholder')} · ${alt}` : t('imagePlaceholder')];
        },
      }));
    })
    .use(commonmark).use(gfm).use(history).use(guard)
    .create();
}

export function focusEditor(editor: Editor): void {
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
}
