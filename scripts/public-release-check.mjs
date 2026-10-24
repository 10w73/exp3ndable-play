import {execFileSync} from 'node:child_process';
import {readFileSync, lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const GAME_FILES = Object.freeze([
  'arsenal.js', 'art.js', 'creatures.js', 'creature-art.js', 'audio.js', 'dialogue.js', 'engine.js', 'fx.js',
  'game.js', 'icon.svg', 'index.html', 'manifest.webmanifest', 'records.js',
  'style.css', 'sw.js'
]);
export function checkPublicText(name, content) {
  const rules = [
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['provider token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{15,}|[rs]k_live_[A-Za-z0-9]{15,}|\d{7,12}:[A-Za-z0-9_-]{30,})\b/],
    ['JWT', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/],
    ['email address', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
    ['private deployment identifier', /chatgpt\.site|appgprj_[A-Za-z0-9]+/i],
    ['personal path', /\/(?:Users|home|workspace)\//],
    ['credential assignment', /(?:password|passwd|api[_-]?key|access[_-]?token|bot[_-]?token|client[_-]?secret)["']?\s*[:=]\s*["'][^"'\s]{6,}["']/i],
    ['external URL', /https?:\/\/(?!www\.w3\.org\/2000\/svg(?:["'\s>]|$)|10w73\.github\.io\/exp3ndable-play\/)[^\s"'<>]+/i]
  ];
  if (Buffer.byteLength(content) > 512 * 1024 || content.includes('\0')) {
    throw new Error(`Publication blocked: unexpected size or binary content in ${name}`);
  }
  for (const [category, pattern] of rules) {
    if (pattern.test(content)) throw new Error(`Publication blocked: ${category} in ${name}; values omitted`);
  }
}

export const PUBLIC_FILES = Object.freeze([
  ...GAME_FILES, '.nojekyll', 'README.md',
  'scripts/public-release-check.mjs', '.github/workflows/public-release.yml'
]);
const root = fileURLToPath(new URL('../', import.meta.url));

export function checkPublicTree(repository = root) {
  const entries = execFileSync('git', ['ls-files', '--stage', '-z'], {cwd: repository, encoding: 'utf8'})
    .split('\0').filter(Boolean);
  const names = entries.map(entry => {
    const [metadata, name] = entry.split('\t');
    if (!metadata.startsWith('100644 ') || !metadata.endsWith(' 0')) throw new Error('Public release contains a non-regular or conflicted file');
    return name;
  });
  if (JSON.stringify(names.sort()) !== JSON.stringify([...PUBLIC_FILES].sort())) {
    throw new Error('Public release differs from the reviewed file allowlist');
  }
  for (const name of names) {
    const path = resolve(repository, name);
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error(`Public release contains a non-regular file: ${name}`);
    const content = new TextDecoder('utf-8', {fatal: true}).decode(readFileSync(path));
    checkPublicText(name, content);
    if (/\.m?js$/.test(name)) {
      try {
        execFileSync(process.execPath, ['--input-type=module', '--check'], {input: content, cwd: repository, stdio: ['pipe', 'pipe', 'pipe']});
      } catch { throw new Error(`Public release contains invalid JavaScript: ${name}`); }
    }
  }
  return names;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(`Public release checks passed for ${checkPublicTree().length} approved files.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
