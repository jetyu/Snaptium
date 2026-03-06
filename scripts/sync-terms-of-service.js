import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const wikiRawUrl = 'https://raw.githubusercontent.com/wiki/jetyu/NoteWizard/T01_Terms-of-Service.md';
const allowedWikiHost = 'raw.githubusercontent.com';
const maxTermsSizeBytes = 200 * 1024;

const outputPath = path.join(repoRoot, 'src', 'assets', 'terms-of-service', 'local-tos.txt');

function markdownToText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\r\n/g, '\n')
    .trim();
}

function validateSourceUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') {
    throw new Error(`Unexpected protocol for terms source: ${url.protocol}`);
  }

  if (url.hostname !== allowedWikiHost) {
    throw new Error(`Unexpected host for terms source: ${url.hostname}`);
  }

  if (!url.pathname.startsWith('/wiki/jetyu/NoteWizard/')) {
    throw new Error(`Unexpected path for terms source: ${url.pathname}`);
  }
}

function validateResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!/^text\//i.test(contentType)) {
    throw new Error(`Unexpected content type for terms source: ${contentType || 'unknown'}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = Number(contentLengthHeader || 0);
  if (Number.isFinite(contentLength) && contentLength > maxTermsSizeBytes) {
    throw new Error(`Terms source too large: ${contentLength} bytes`);
  }
}

function sanitizeTermsText(text) {
  const normalized = text
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  if (!/terms of service/i.test(normalized)) {
    throw new Error('Downloaded terms content failed validation.');
  }

  if (Buffer.byteLength(normalized, 'utf8') > maxTermsSizeBytes) {
    throw new Error('Downloaded terms content exceeded size limit after processing.');
  }

  return normalized;
}

async function main() {
  validateSourceUrl(wikiRawUrl);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  let existing = '';
  try {
    existing = await fs.readFile(outputPath, 'utf8');
  } catch {
    existing = '';
  }

  try {
    const response = await fetch(wikiRawUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    validateResponse(response);

    const markdown = await response.text();
    const text = sanitizeTermsText(markdownToText(markdown)) + '\n';
    await fs.writeFile(outputPath, '\ufeff' + text, 'utf8');
    console.log(`Synced Terms of Service from wiki: ${wikiRawUrl}`);
    return;
  } catch (error) {
    console.warn(`Failed to fetch wiki terms (${error.message}). Keeping local Terms of Service.`);
    if (!existing) {
      throw new Error('No local Terms of Service file available as fallback.');
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
