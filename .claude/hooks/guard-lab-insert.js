#!/usr/bin/env node
// PostToolUse(Edit|Write) 守門：lab_results 的 test_name 若是英文字面值就擋下。
// 對應 memory: project_v3_lab_naming（必用 canonical 中文 test_name，否則 CATEGORIES 抓不到）。
// 只檢查「字串字面值」，動態變數（如 test_name: row.name）不誤判。
const fs = require('fs');

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch {}
let data = {};
try { data = JSON.parse(input); } catch {}

const fp = (data.tool_input && data.tool_input.file_path) || '';
if (!/\.(ts|tsx|sql)$/.test(fp)) process.exit(0);

let src = '';
try { src = fs.readFileSync(fp, 'utf8'); } catch { process.exit(0); }
if (!/lab_results/.test(src)) process.exit(0);

const hasCJK = (s) => /[一-鿿]/.test(s);
const bad = new Set();
const re = /test_name\s*[:=]\s*(['"])([^'"]+)\1/g;
let m;
while ((m = re.exec(src))) {
  const v = m[2];
  if (!hasCJK(v) && /[A-Za-z]/.test(v)) bad.add(v);
}

if (bad.size) {
  process.stderr.write(
    `⚠️ lab_results test_name 守門：${fp} 出現非中文 canonical 的 test_name → ${[...bad].join(', ')}\n` +
    `lab_results 必須用 canonical 中文 test_name，否則 CATEGORIES 抓不到、三角狀態會漏判。請改成中文名稱。\n`
  );
  process.exit(2);
}
process.exit(0);
