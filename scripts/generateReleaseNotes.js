import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TEMPLATE_PATH = resolve('.github/template/RELEASE_NOTES.md');
const BODY_START_MARKER = '<!-- RELEASE_NOTES_BODY_START -->';
const BODY_END_MARKER = '<!-- RELEASE_NOTES_BODY_END -->';

function getVersionFromArgs() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node scripts/generateReleaseNotes.js <tag>');
    process.exitCode = 1;
    return null;
  }
  return raw.trim();
}

function extractSection(historyContent, versionWithoutPrefix) {
  const headingPattern = new RegExp(`^### \\[${escapeRegExp(versionWithoutPrefix)}\\](?: - .+)?$`, 'm');
  const headingMatch = historyContent.match(headingPattern);
  if (!headingMatch || headingMatch.index === undefined) {
    throw new Error(`Unable to find changelog entry for version ${versionWithoutPrefix}`);
  }

  const headingLine = headingMatch[0];
  const afterHeadingIndex = headingMatch.index + headingLine.length;
  const remaining = historyContent.slice(afterHeadingIndex);
  const nextHeadingIndex = remaining.search(/\n### \[/);
  const sectionBody = (nextHeadingIndex === -1 ? remaining : remaining.slice(0, nextHeadingIndex)).trim();

  return sectionBody;
}

function buildReleaseNotes({ templateContent, sectionBody }) {
  const body = sectionBody.trim() || '_No changes for this release._';
  const pattern = new RegExp(
    `(${escapeRegExp(BODY_START_MARKER)}\\s*)([\\s\\S]*?)(${escapeRegExp(BODY_END_MARKER)})`
  );

  if (!pattern.test(templateContent)) {
    throw new Error('Release notes template is missing body markers.');
  }

  const nextContent = templateContent.replace(pattern, `$1${body}\n\n$3`);
  return nextContent.endsWith('\n') ? nextContent : `${nextContent}\n`;
}

function main() {
  const tag = getVersionFromArgs();
  if (!tag) {
    return;
  }

  const version = tag.replace(/^v/, '');
  const historyPath = resolve('src/assets/changelog/history_en.md');
  const historyContent = readFileSync(historyPath, 'utf8');

  const sectionBody = extractSection(historyContent, version);
  const templateContent = readFileSync(TEMPLATE_PATH, 'utf8');
  const notes = buildReleaseNotes({ templateContent, sectionBody });

  writeFileSync(TEMPLATE_PATH, notes, 'utf8');
  console.log(`Generated release notes for ${tag}`);
}

main();
