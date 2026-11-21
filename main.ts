// Hands in the GTA VI trophy guide: copies this repository's app/ and
// screenshots/ into the output directory and writes dossier.json there with
// the vendored make.fun library. Node 22, standard library only; nothing is
// installed before it runs. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's: the dossier text is capped, and the screenshots
// and app/ are capped at the sizes the gate allows, so a build that would be
// refused never writes a dossier that claims otherwise.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);

// Read the dossier back and say how big it is: a quick sanity check that the
// build wrote what it claims, and a number to compare between the two runs.
const dossier = readFileSync(dossierPath, 'utf8');
console.log(`wrote ${dossierPath} (${statSync(dossierPath).size} bytes, ${dossier.length} characters)`);
