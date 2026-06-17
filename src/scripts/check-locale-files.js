import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const localesDir = path.join(__dirname, '../../electron/assets/locales');
const referenceFile = path.join(localesDir, 'zh-CN.json');
const srcDirs = [
  path.join(__dirname, '../../src'),
  path.join(__dirname, '../../electron')
];
const extensions = ['.ts', '.js', '.vue', '.html', '.json'];
const excludePaths = ['node_modules', 'dist', '.git', 'assets/locales'];
const BOM = '\uFEFF';

// --- Helper Functions ---

/**
 * Searches for all source files in given directories
 */
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!excludePaths.some(p => filePath.includes(p))) {
        results = results.concat(walk(filePath));
      }
    } else {
      if (extensions.includes(path.extname(filePath)) && !filePath.includes('zh-CN.json')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

function readJsonFile(filePath) {
  const rawContent = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawContent.startsWith(BOM) ? rawContent.slice(1) : rawContent);
}

function writeJsonFile(filePath, json) {
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
}

// --- Phase 1: Reference Analysis & Pruning ---

console.log('[INFO] Starting codebase scan to identify unused keys in zh-CN.json...');

const zhCN = readJsonFile(referenceFile);
const allKeys = Object.keys(zhCN);

const allSourceFiles = srcDirs.flatMap(dir => walk(dir));
const fileContents = allSourceFiles.map(file => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
});

// Dynamic key prefixes (e.g., t('prefix.' + something))
const dynamicRegexes = [
  /\$t\(\s*['"`]([^'"`]*\.)['"`]\s*[+]/g,
  /t\(\s*['"`]([^'"`]*\.)['"`]\s*[+]/g,
  /\$t\(\s*[`]([^`]*\.)\$\{/g,
  /t\(\s*[`]([^`]*\.)\$\{/g
];

const dynamicPrefixes = new Set();
fileContents.forEach(content => {
  dynamicRegexes.forEach(regex => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      dynamicPrefixes.add(match[1]);
    }
  });
});

console.log(`[INFO] Detected ${dynamicPrefixes.size} dynamic prefixes.`);

// Filter used keys
const usedKeys = allKeys.filter(key => {
  // Check exact usage
  const isExactUsed = fileContents.some(content => content.includes(key));
  if (isExactUsed) return true;

  // Check dynamic usage
  const isDynamicUsed = Array.from(dynamicPrefixes).some(prefix => key.startsWith(prefix));
  if (isDynamicUsed) return true;

  return false;
});

const unusedKeys = allKeys.filter(k => !usedKeys.includes(k));

if (unusedKeys.length > 0) {
  console.log(`[INFO] Found ${unusedKeys.length} unused keys. Pruning zh-CN.json...`);
  const finalZhCN = {};
  usedKeys.sort().forEach(k => {
    finalZhCN[k] = zhCN[k];
  });
  writeJsonFile(referenceFile, finalZhCN);
} else {
  // Ensure zh-CN is sorted even if no pruning needed
  const sortedZhCN = {};
  Object.keys(zhCN).sort().forEach(k => {
    sortedZhCN[k] = zhCN[k];
  });
  writeJsonFile(referenceFile, sortedZhCN);
  console.log('[INFO] No unused keys found in zh-CN.json.');
}

// --- Phase 2: Synchronization ---

const referenceKeys = usedKeys.sort();
const referenceObj = readJsonFile(referenceFile);

const localeFiles = fs.readdirSync(localesDir)
  .filter(file => file.endsWith('.json') && file !== 'zh-CN.json');

console.log(`\n[INFO] Synchronizing ${localeFiles.length} other language files...`);

localeFiles.forEach(file => {
  try {
    const filePath = path.join(localesDir, file);
    const rawContent = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8')
      : '';
    const content = rawContent.startsWith(BOM) ? rawContent.slice(1).trim() : rawContent.trim();

    let currentObj = {};
    if (content) {
      currentObj = JSON.parse(content);
    } else {
      console.log(`[INFO] ${file} is empty or missing. Initializing...`);
    }

    const sortedObj = {};
    let addedCount = 0;
    let prunedCount = 0;

    // Build the new object based on reference keys
    referenceKeys.forEach(key => {
      if (Object.hasOwn(currentObj, key)) {
        sortedObj[key] = currentObj[key];
      } else {
        // Use Chinese as placeholder per user's request
        sortedObj[key] = referenceObj[key];
        addedCount++;
      }
    });

    // Check for extra keys to prune
    const extraKeys = Object.keys(currentObj).filter(key => !referenceKeys.includes(key));
    prunedCount = extraKeys.length;

    // Write back
    writeJsonFile(filePath, sortedObj);
    
    if (addedCount > 0 || prunedCount > 0) {
      console.log(`[SYNC] ${file}: Added ${addedCount} keys, Pruned ${prunedCount} keys.`);
    }

  } catch (error) {
    console.error(`[ERROR] Failed to process ${file}: ${error.message}`);
  }
});

console.log('\n[INFO] All locale files are now synchronized and cleaned.');
console.log('='.repeat(50));
