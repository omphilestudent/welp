import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const shouldSkip =
    process.env.SKIP_ESBUILD_INSTALL === '1' ||
    process.env.SKIP_ESBUILD_INSTALL === 'true' ||
    process.platform === 'win32';

if (shouldSkip) {
    console.log('[prebuild] Skipping esbuild install step');
    process.exit(0);
}

const installScript = path.resolve(process.cwd(), 'node_modules', 'esbuild', 'install.js');

if (!fs.existsSync(installScript)) {
    console.log('[prebuild] esbuild install script not found, skipping');
    process.exit(0);
}

const result = spawnSync(process.execPath, [installScript], {
    stdio: 'inherit'
});

if (result.error) {
    console.warn(`[prebuild] esbuild install error: ${result.error.message}`);
}

if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
}
