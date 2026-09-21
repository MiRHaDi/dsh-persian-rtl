import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dictionaries } from '../src/fa.js';
const { name } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
  .replace("import { dictionaries } from './fa.js';", `const dictionaries = ${JSON.stringify(dictionaries)};`)
  .replaceAll('export const ', 'const ').replaceAll('export function ', 'function ');
mkdirSync(new URL('../lib/', import.meta.url), { recursive: true });
// Official client loader's factory protocol; no runtime dependencies or eval.
writeFileSync(new URL('../lib/client.js', import.meta.url),
  `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory: () => {\n${source}\nreturn {name, inject, apply};\n}});\n`);
