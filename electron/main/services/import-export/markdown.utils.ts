import path from 'node:path';

export const MARKDOWN_IMAGE_EXTENSIONS = new Set<string>([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
]);

export interface MarkdownImageReplacerPayload {
  altText: string;
  destination: string;
  rawMatch: string;
}

interface ParsedImageDestination {
  destination: string;
  leadingWhitespace: string;
  trailing: string;
  wrappedByAngleBrackets: boolean;
}

export function normalizeToPosixPath(inputPath: string | null | undefined): string {
  return String(inputPath ?? '').replace(/\\/g, '/');
}

export function isExternalResourcePath(resourcePath: string | null | undefined): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(String(resourcePath ?? '').trim());
}

export function isRelativeResourcePath(resourcePath: string | null | undefined): boolean {
  const value = String(resourcePath ?? '').trim();
  if (!value) {
    return false;
  }
  if (isExternalResourcePath(value)) {
    return false;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  if (/^[a-zA-Z]:[\\/]/.test(value)) {
    return false;
  }
  return true;
}

export function isSupportedMarkdownImagePath(resourcePath: string | null | undefined): boolean {
  const extension = path.extname(String(resourcePath ?? '')).toLowerCase();
  return MARKDOWN_IMAGE_EXTENSIONS.has(extension);
}

export function sanitizeFsName(name: string | null | undefined, fallbackName = 'Untitled'): string {
  const normalized = Array.from(String(name ?? '').trim(), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 32 || /[<>:"/\\|?*]/.test(character)) {
      return '-';
    }
    return character;
  }).join('');

  const collapsed = normalized
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim();

  const safeName = collapsed.length > 0 ? collapsed : fallbackName;
  return safeName.slice(0, 200);
}

export function makeUniqueName(baseName: string, usedNames: Set<string>, startIndex = 2): string {
  let nextName = baseName;
  let index = startIndex;
  while (usedNames.has(nextName)) {
    nextName = `${baseName} (${index})`;
    index += 1;
  }
  usedNames.add(nextName);
  return nextName;
}

export function makeUniqueFileName(
  baseName: string,
  extension: string,
  usedFileNames: Set<string>,
  startIndex = 2,
): string {
  const safeBaseName = sanitizeFsName(baseName, 'Untitled');
  const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;
  let candidate = `${safeBaseName}${safeExtension}`;
  let index = startIndex;
  while (usedFileNames.has(candidate.toLowerCase())) {
    candidate = `${safeBaseName} (${index})${safeExtension}`;
    index += 1;
  }
  usedFileNames.add(candidate.toLowerCase());
  return candidate;
}

function parseImageDestination(innerExpression: string): ParsedImageDestination | null {
  const leadingWhitespaceMatch = /^(\s*)/.exec(innerExpression);
  const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : '';
  const remaining = innerExpression.slice(leadingWhitespace.length);
  if (!remaining) {
    return null;
  }

  if (remaining.startsWith('<')) {
    const closeIndex = remaining.indexOf('>');
    if (closeIndex <= 1) {
      return null;
    }

    return {
      destination: remaining.slice(1, closeIndex),
      leadingWhitespace,
      trailing: remaining.slice(closeIndex + 1),
      wrappedByAngleBrackets: true,
    };
  }

  const destinationMatch = /^([^\s]+)([\s\S]*)$/.exec(remaining);
  if (!destinationMatch) {
    return null;
  }

  return {
    destination: destinationMatch[1],
    leadingWhitespace,
    trailing: destinationMatch[2] ?? '',
    wrappedByAngleBrackets: false,
  };
}

export function replaceMarkdownImageDestinations(
  markdownContent: string | null | undefined,
  replacer: (payload: MarkdownImageReplacerPayload) => string,
): string {
  const pattern = /!\[([^\]]*)\]\(([^)]*)\)/g;

  return String(markdownContent ?? '').replace(
    pattern,
    (fullMatch: string, altText: string, innerExpression: string) => {
      const parsed = parseImageDestination(innerExpression);
      if (!parsed?.destination) {
        return fullMatch;
      }

      const replacement = replacer({
        altText,
        destination: parsed.destination,
        rawMatch: fullMatch,
      });

      if (
        typeof replacement !== 'string'
        || replacement.length === 0
        || replacement === parsed.destination
      ) {
        return fullMatch;
      }

      const shouldUseAngleBrackets = parsed.wrappedByAngleBrackets || /\s/.test(replacement);
      const renderedDestination = shouldUseAngleBrackets ? `<${replacement}>` : replacement;
      return `![${altText}](${parsed.leadingWhitespace}${renderedDestination}${parsed.trailing})`;
    },
  );
}

export function isPathInside(basePath: string, candidatePath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
