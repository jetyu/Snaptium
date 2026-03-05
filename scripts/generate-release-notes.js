import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEMPLATE_PATH = resolve('.github/RELEASE_TEMPLATE/release_note.md');
const HISTORY_PATH = resolve('src/assets/changelog/history_en.md');

const BODY_START = '<!-- RELEASE_NOTES_BODY_START -->';
const BODY_END = '<!-- RELEASE_NOTES_BODY_END -->';

const PRE_WARNING_START = '<!-- PRE_RELEASE_WARNING_START -->';
const PRE_WARNING_END = '<!-- PRE_RELEASE_WARNING_END -->';

const FULL_CHANGELOG_START = '<!-- FULL_CHANGELOG_START -->';
const FULL_CHANGELOG_END = '<!-- FULL_CHANGELOG_END -->';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTag() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node scripts/generate-release-notes.js <tag>');
    process.exit(1);
  }

  return raw
    .replace(/^refs\/tags\//, '')
    .trim();
}

function extractSection(history, version) {
  const headingRegex = new RegExp(
    `^### \\[${escapeRegExp(version)}\\](?: - .+)?\\s*$`,
    'm'
  );

  const match = history.match(headingRegex);
  if (!match || match.index === undefined) {
    throw new Error(`Changelog entry not found for version ${version}`);
  }

  const start = match.index + match[0].length;
  const rest = history.slice(start);

  const nextHeading = rest.match(/^\s*### \[/m);
  const end = nextHeading
    ? start + nextHeading.index
    : history.length;

  return history.slice(start, end).trim();
}

function replaceBody(template, body) {
  const regex = new RegExp(
    `(${escapeRegExp(BODY_START)}\\s*)([\\s\\S]*?)(\\s*${escapeRegExp(BODY_END)})`
  );

  if (!regex.test(template)) {
    throw new Error('Missing RELEASE_NOTES body markers.');
  }

  return template.replace(regex, `$1${body}\n$3`);
}

function removeBlock(template, startMarker, endMarker) {
  const regex = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`,
    'm'
  );

  return template.replace(regex, '');
}

function replaceTitle(template, isPreRelease) {
  const titleRegex = /^### NoteWizard.*$/m;

  const newTitle = isPreRelease
    ? '### NoteWizard Pre-Release Notes'
    : '### NoteWizard Release Notes';

  if (!titleRegex.test(template)) {
    throw new Error('Missing expected title line.');
  }

  return template.replace(titleRegex, newTitle);
}

function main() {
  const tag = getTag();
  const version = tag.replace(/^v/, '');
  const baseVersion = version.split('-')[0];
  const isPreRelease = version !== baseVersion;

  const history = readFileSync(HISTORY_PATH, 'utf8');

  let section;
  try {
    section = extractSection(history, version);
  } catch (err) {
    if (isPreRelease) {
      console.log(`Fallback to base version ${baseVersion}`);
      section = extractSection(history, baseVersion);
    } else {
      throw err;
    }
  }

  let template = readFileSync(TEMPLATE_PATH, 'utf8');

  template = replaceTitle(template, isPreRelease);

  let output = replaceBody(
    template,
    section || '_No changes for this release._'
  );

  if (isPreRelease) {
    output = removeBlock(output, FULL_CHANGELOG_START, FULL_CHANGELOG_END);
  } else {
    output = removeBlock(output, PRE_WARNING_START, PRE_WARNING_END);
  }

  if (!output.endsWith('\n')) {
    output += '\n';
  }

  writeFileSync(TEMPLATE_PATH, output, 'utf8');

  console.log(`Release notes generated for ${tag}`);
}

main();