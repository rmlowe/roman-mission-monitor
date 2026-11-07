import { copyFile, mkdir } from 'node:fs/promises';

// Copy the exact collection snapshot embedded in this build, never a live
// repository URL: a failed deployment must leave the published snapshot old.
const dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
await copyFile(new URL('../data/collection-health.json', import.meta.url), new URL('health.json', dist));
