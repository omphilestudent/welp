import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
    join(root, 'src', 'main.jsx'),
    join(root, 'src', 'App.jsx'),
    join(root, 'index.html')
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
    console.error('❌ Frontend smoke test failed. Missing files:');
    missing.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
}

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (!pkg?.scripts?.dev || !pkg?.scripts?.build) {
    console.error('❌ Frontend smoke test failed. Missing dev/build scripts.');
    process.exit(1);
}

console.log('✅ Frontend smoke test passed');
