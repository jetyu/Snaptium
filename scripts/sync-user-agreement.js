import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const wikiRawUrl = 'https://raw.githubusercontent.com/wiki/jetyu/NoteWizard/08_Terms-of-Service.md';
const outputPath = path.join(repoRoot, 'src', 'assets', 'UserAgreement', 'USER_AGREEMENT.txt');

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

async function main() {
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

    const markdown = await response.text();
    const text = markdownToText(markdown) + '\n';
    await fs.writeFile(outputPath, '\ufeff' + text, 'utf8');
    console.log(`Synced USER_AGREEMENT from wiki: ${wikiRawUrl}`);
    return;
  } catch (error) {
    console.warn(`Failed to fetch wiki terms (${error.message}). Keeping local USER_AGREEMENT.`);
    if (!existing) {
      throw new Error('No local USER_AGREEMENT.txt available as fallback.');
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
