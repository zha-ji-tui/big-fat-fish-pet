// 从 npm registry 拉取 dsh-pet 包，解出 assets/thumb/*.webm 到 public/thumb/
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, cpSync, existsSync, createWriteStream, rmSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import * as tar from 'tar'; // CJS 包：命名空间导入，跨平台解压（Windows 无系统 tar）

const NAME = 'dsh-pet';
const VERSION = '0.1.4';
const TMP = '.tmp-assets';
const DEST = 'public/thumb';

function h(nm) { return join(process.cwd(), nm); }

console.log(`[fetch-assets] pulling ${NAME}@${VERSION} tarball...`);
try {
  execFileSync('npm', ['view', `${NAME}@${VERSION}`, 'dist.tarball'], { stdio: ['ignore','pipe','inherit'], encoding:'utf-8' });
} catch(e) { console.log('npm view failed:', e.message); }

// 直接用 tarball 地址下载并解包（不依赖本机 npm 已装包）
const res = await fetch(`https://registry.npmjs.org/${NAME}/-/${NAME}-${VERSION}.tgz`);
if (!res.ok) throw new Error('tarball HTTP ' + res.status);
mkdirSync(TMP, { recursive: true });
await pipeline(res.body, createWriteStream(join(TMP, 'pkg.tgz')));
await tar.x({ file: join(TMP, 'pkg.tgz'), cwd: TMP });
mkdirSync(DEST, { recursive: true });
const srcDir = join(TMP, 'package', 'assets', 'thumb');
const files = readdirSync(srcDir).filter(f => f.endsWith('.webm'));
for (const f of files) cpSync(join(srcDir, f), join(DEST, f));
console.log(`[fetch-assets] copied ${files.length} webm → ${DEST}`);
rmSync(TMP, { recursive: true, force: true });
