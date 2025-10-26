import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取 zh-CN.json 作为参考顺序
const localesDir = path.join(__dirname, '../src/locales');
const referenceFile = path.join(localesDir, 'zh-CN.json');

console.log('[INFO] Reading reference Simplified Chinese language file: zh-CN.json');
const referenceContent = fs.readFileSync(referenceFile, 'utf8');
const referenceObj = JSON.parse(referenceContent);

// 获取参考文件的键顺序
const referenceKeys = Object.keys(referenceObj);
console.log(`[INFO] Simplified Chinese language file contains ${referenceKeys.length} translation keys\n`);

// 获取所有语言文件
const localeFiles = fs.readdirSync(localesDir)
  .filter(file => file.endsWith('.json') && file !== 'zh-CN.json');

console.log(`[INFO] Found ${localeFiles.length} language files\n`);

let processedCount = 0;
let errorCount = 0;
const filesWithMissingKeys = [];
const failedFiles = [];

localeFiles.forEach(file => {
  try {
    const filePath = path.join(localesDir, file);
    
    // 读取当前文件
    const content = fs.readFileSync(filePath, 'utf8');
    const currentObj = JSON.parse(content);
    
    // 创建新的有序对象
    const sortedObj = {};
    
    // 按照参考文件的顺序添加键
    referenceKeys.forEach(key => {
      if (currentObj.hasOwnProperty(key)) {
        sortedObj[key] = currentObj[key];
      }
    });
    
    // 检查是否有多余的键（不在参考文件中的）
    const extraKeys = Object.keys(currentObj).filter(key => !referenceKeys.includes(key));
    if (extraKeys.length > 0) {
      console.log(`[WARN] ${file}`);
      console.log(`       Found ${extraKeys.length} extra keys: ${extraKeys.join(', ')}\n`);
      // 将额外的键添加到末尾
      extraKeys.forEach(key => {
        sortedObj[key] = currentObj[key];
      });
    }
    
    // 检查是否有缺失的键
    const missingKeys = referenceKeys.filter(key => !currentObj.hasOwnProperty(key));
    if (missingKeys.length > 0) {
      console.log(`[WARN] ${file}`);
      console.log(`       Missing ${missingKeys.length} keys: ${missingKeys.join(', ')}\n`);
      filesWithMissingKeys.push({
        file,
        count: missingKeys.length,
        keys: missingKeys
      });
    }
    
    // 写回文件，保持格式
    const sortedContent = JSON.stringify(sortedObj, null, 2) + '\n';
    fs.writeFileSync(filePath, sortedContent, 'utf8');
    
    processedCount++;
    
  } catch (error) {
    console.error(`[ERROR] ${file}`);
    console.error(`        Error: ${error.message}\n`);
    failedFiles.push({ file, error: error.message });
    errorCount++;
  }
});

console.log('='.repeat(50));
console.log(`\n[INFO] Processing results:`);
console.log(`       Sorting completed: ${processedCount - errorCount} language files`);
if (errorCount > 0) {
  console.log(`       Sorting failed: ${errorCount} language files`);
}
if (filesWithMissingKeys.length > 0) {
  console.log(`       Translation keys missing: ${filesWithMissingKeys.length} language files`);
}

if (failedFiles.length > 0) {
  console.log(`\n[INFO] The following language files failed to process:`);
  failedFiles.forEach(({ file, error }) => {
    console.log(`       - ${file}: ${error}`);
  });
}

if (filesWithMissingKeys.length > 0) {
  console.log(`\n[INFO] The following language files are missing translation keys:`);
  filesWithMissingKeys.forEach(({ file, count, keys }) => {
    console.log(`       - ${file}: Missing ${count} keys`);
    console.log(`         ${keys.join(', ')}`);
  });
}

if (errorCount === 0 && filesWithMissingKeys.length === 0) {
  console.log(`\n[INFO] Other language files are sorted consistently with Simplified Chinese!\n`);
} else {
  console.log(`\n[INFO] Sorting completed, but language files are missing translation keys that need to be handled\n`);
}
