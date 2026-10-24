import {inflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {readFileSync, lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const GAME_FILES = Object.freeze([
  'arsenal.js', 'art.js', 'creatures.js', 'creature-art.js', 'audio.js', 'dialogue.js', 'engine.js', 'fx.js',
  'game.js', 'renderer.js', 'difficulty.js', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon.svg', 'index.html', 'manifest.webmanifest', 'records.js',
  'style.css', 'sw.js'
]);
export const ICON_SIZES=Object.freeze({'apple-touch-icon.png':180,'icon-192.png':192,'icon-512.png':512});
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
/** Validate reviewed opaque icons or scan UTF-8 source without exposing sensitive values. */
export function checkPublicAsset(name,content) {
  if(!Object.hasOwn(ICON_SIZES,name))return checkPublicText(name,new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(content)));
  const bytes=Buffer.from(content),size=ICON_SIZES[name],fail=()=>{throw new Error(`Publication blocked: invalid opaque PNG icon ${name}`);};
  if(bytes.length>65536||bytes.length<57||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail();
  let offset=8,header=false,ended=false;const data=[];
  while(offset<bytes.length){
    if(ended||offset+12>bytes.length)fail();const length=bytes.readUInt32BE(offset),end=offset+length+12;
    if(end>bytes.length)fail();const kind=bytes.toString('ascii',offset+4,offset+8),chunk=bytes.subarray(offset+8,end-4);
    if(crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))fail();
    if(kind==='IHDR'){
      if(header||offset!==8||length!==13||chunk.readUInt32BE(0)!==size||chunk.readUInt32BE(4)!==size||!chunk.subarray(8).equals(Buffer.from([8,2,0,0,0])))fail();header=true;
    }else if(kind==='IDAT'){if(!header)fail();data.push(chunk);}
    else if(kind==='IEND'){if(length||!data.length)fail();ended=true;}
    else fail(); // No text, profiles, private metadata or arbitrary binary payloads.
    offset=end;
  }
  if(!ended)fail();const expected=size*(1+size*3);let pixels;
  try{pixels=inflateSync(Buffer.concat(data),{maxOutputLength:expected+1});}catch{fail();}
  if(pixels.length!==expected)fail();for(let row=0;row<size;row++)if(pixels[row*(1+size*3)]>4)fail();
}
/** Enforce public text size/line limits and reject common private-data patterns. */
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
  if(content.split('\n').length-(content.endsWith('\n')?1:0)>500) {
    throw new Error(`Publication blocked: ${name} exceeds 500 physical lines`);
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

/** Validate the exact isolated public tree, file modes, contents and JavaScript syntax. */
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
    const content=readFileSync(path);
    checkPublicAsset(name,content);
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
