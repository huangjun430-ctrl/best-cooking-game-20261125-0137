// Ember & Oak Kitchen — make.fun submission entrypoint (Node 22).
//
// What this program does: it takes the offline game bundle in game/ and the
// real browser screenshots in screenshots/, copies both into the output
// directory, and writes a dossier.json describing the entry. The dossier is
// built by the kit's vendor/makefun-game.ts, so the scorer can reproduce it
// byte for byte from the same inputs.
//
// Everything here is deterministic: entries are copied in sorted order,
// dotfiles are skipped, and nothing depends on the clock or on randomness.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Gate limits from the bounty. text_max_bytes shapes the dossier bytes;
// the other caps only refuse, so passing them makes this program fail
// exactly where the scorer would.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Plain code-unit ordering, so the copy order is the same on every run.
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Copy one directory tree into another, wiping the destination first.
// Entries are visited in sorted order and dotfiles are left behind, so the
// result does not depend on filesystem order or on hidden files.
function copyTree(from: string, to: string): void {
  if (existsSync(to)) {
    rmSync(to, { recursive: true, force: true });
  }
  mkdirSync(to, { recursive: true });

  for (const name of readdirSync(from).sort(compareStrings)) {
    if (name.startsWith('.')) {
      continue;
    }
    const source = join(from, name);
    const target = join(to, name);
    if (statSync(source).isDirectory()) {
      copyTree(source, target);
    } else {
      copyFileSync(source, target);
    }
  }
}

function main(): void {
  // The repo root is the directory holding this file.
  const root = dirname(fileURLToPath(import.meta.url));
  // The scorer sets MAKEFUN_OUTPUT_DIR; default to /output for local runs.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const gameDir = join(root, 'game');
  const shotsDir = join(root, 'screenshots');
  if (!existsSync(gameDir)) {
    throw new Error(`game directory not found: ${gameDir}`);
  }
  if (!existsSync(shotsDir)) {
    throw new Error(`screenshots directory not found: ${shotsDir}`);
  }

  mkdirSync(outDir, { recursive: true });
  copyTree(gameDir, join(outDir, 'game'));
  copyTree(shotsDir, join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
