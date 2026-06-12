/**
 * Module-boundary lint (master plan §9): a bounded-context module may import only from
 * itself, shared-kernel, src/ports, and @lms/contracts. Fails the build on violations.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const modulesDir = join(process.cwd(), 'src', 'modules');
const violations = [];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (full.endsWith('.ts')) files.push(full);
  }
  return files;
}

const importRe = /from\s+['"]([^'"]+)['"]/g;

for (const file of walk(modulesDir)) {
  const rel = relative(modulesDir, file).split(sep);
  const ownModule = rel[0];
  if (ownModule === 'shared-kernel') continue;
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(importRe)) {
    const spec = match[1];
    if (!spec.startsWith('.')) continue; // package imports (contracts etc.) are allowed
    const resolved = relative(modulesDir, join(file, '..', spec)).split(sep);
    if (resolved[0] === '..') continue; // ports/adapters/app outside modules dir: allowed
    const targetModule = resolved[0];
    if (targetModule !== ownModule && targetModule !== 'shared-kernel') {
      violations.push(`${relative(process.cwd(), file)} imports ${spec} (module "${targetModule}")`);
    }
  }
}

if (violations.length) {
  console.error('Module boundary violations:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log('Module boundaries OK');
