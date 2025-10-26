import icongen from 'icon-gen';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  type: 'png',
  modes: ['icns', 'ico'],
  names: {
    icns: 'app-logo',
    ico: 'app-logo'
  },
  report: true
};

const input = path.join(__dirname, '../src/assets/logo/app-logo-512.png');
const output = path.join(__dirname, '../src/assets/logo');

console.log('Generating icon files...');
console.log('Input file:', input);
console.log('Output directory:', output);

icongen(input, output, options)
  .then((results) => {
    console.log('Icon generation successful!');
    results.forEach(result => {
      console.log('  -', result);
    });
  })
  .catch((err) => {
    console.error('Icon generation failed:', err);
    process.exit(1);
  });
