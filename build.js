import builder from 'electron-builder';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 构建配置
const packageJsonPath = path.join(__dirname, 'package.json');
const config = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).build;

// 清理之前的构建目录
function cleanDist() {
  console.log('Cleaning build directory...');
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  fs.mkdirSync(distPath, { recursive: true });
}

// 构建应用
async function buildApp() {
  console.log('Starting application build...');
  
  try {
    // Install dependencies
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // Build renderer process
    console.log('Building renderer process...');
    // 如果有前端构建步骤，可以在这里添加
    // 例如: execSync('npm run build:renderer', { stdio: 'inherit' });

    // Package application
    console.log('Packaging application...');
    
    // 设置目标平台
    const platform = process.platform === 'win32' ? 'win' : 
                   process.platform === 'darwin' ? 'mac' : 'linux';
    
    console.log(`Target platform: ${platform}`);
    
    // 构建选项
    const buildOptions = {
      config: config,
      [platform]: ['x64'],  // 默认构建 x64 架构
    };
    
    // 如果是 Windows，添加 32 位支持
    if (platform === 'win') {
      buildOptions.win = ['x64', 'ia32'];
    }
    
    // 执行构建
    const platformName = platform === 'win' ? 'WINDOWS' : platform.toUpperCase();
    await builder.build({
      targets: builder.Platform[platformName].createTarget(),
      config: config,
    });

    console.log('Build successful!');
    console.log(`Installer location: ${path.join(__dirname, 'dist')}`);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// 执行构建
async function main() {
  console.log('NoteWizard Build Tool');
  console.log('======================');
  
  cleanDist();
  await buildApp();
}

main();
