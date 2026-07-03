#!/usr/bin/env node
// PreToolUse(Bash) 守門：git push 時若動到部署檔卻沒 bump sw.js 的 CACHE_NAME 就擋下。
// 對應 memory: project_v3_pwa_cache（不 bump → Howard 看不到新部署）。
// 放行方式：跟 Claude 說「跳過 cache 檢查」，或把 CACHE_NAME 換成當天日期後再 push。
const fs = require('fs');
const { execSync } = require('child_process');
const REPO = '/Users/chenyinhao/V3';

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch {}
let data = {};
try { data = JSON.parse(input); } catch {}

const cmd = (data.tool_input && data.tool_input.command) || '';
// 認 git push：push 必須是 git 的子命令（允許中間夾全域旗標如 `-C /path`、`--no-pager`），
// 但排除 commit message 裡剛好有 "push" 字的假陽性（如 git commit -m "fix push"）。
if (!/\bgit\s+(?:-[Cc]\s+\S+\s+|--?[\w-]+(?:=\S+)?\s+)*push\b/.test(cmd)) process.exit(0);

function git(args) {
  try { return execSync('git ' + args, { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
  catch { return ''; }
}

const upstream = git('rev-parse --abbrev-ref --symbolic-full-name @{u}').trim();
const range = upstream ? upstream + '..HEAD' : '';
const committed = (range ? git('diff --name-only ' + range) : git('diff --name-only HEAD')).split('\n');
const working = git('status --porcelain').split('\n').map((l) => l.slice(3));
const changed = [...committed, ...working].map((s) => s.trim()).filter(Boolean);

const deployAffecting = changed.some((f) => /^(app|components|public|lib)\//.test(f) && f !== 'public/sw.js');
const swTouched = changed.some((f) => f === 'public/sw.js');

if (deployAffecting && !swTouched) {
  let cur = '?';
  try {
    const m = fs.readFileSync(REPO + '/public/sw.js', 'utf8').match(/CACHE_NAME\s*=\s*['"]([^'"]+)/);
    if (m) cur = m[1];
  } catch {}
  process.stderr.write(
    `⚠️ PWA cache 守門：這次 push 動到部署檔，但 public/sw.js 的 CACHE_NAME 沒 bump（目前 ${cur}）。\n` +
    `不 bump 的話 Howard 會被 service worker 快取住、看不到新版。\n` +
    `→ 請把 CACHE_NAME 換成當天日期（如 hp-vNN-YYYYMMDD）再 push，或明確說「跳過 cache 檢查」放行。\n`
  );
  process.exit(2);
}
process.exit(0);
