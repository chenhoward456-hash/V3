# 引擎跨系統一致性稽核（Cross-Engine Consistency Audit）

> 起因：謝佳峻的健康報告同一份裡，補品建議推「肌酸」、血檢建議卻說「減少肌酸」。
> Howard 的關鍵指正：「不要破一個洞補一個洞，整體邏輯就是要對」——不該靠他當人肉 QA 一個一個抓。
>
> 這份文件 = Fable 跨引擎矛盾總掃描的完整結果 + 修復狀態 + 通則設計。
> 維護原則：**新引擎/新建議都要被通則蓋住，而不是每次新增一個 if。**

掃描範圍：`supplement-engine` / `lab-nutrition-advisor` / `nutrition-engine` /
`trajectory-adjust` / `recovery-engine` / `insight-engine` / `client-feed` / `utils/labStatus`。

---

## 根因（一句話）
系統是 5+ 個**各自獨立**的規則引擎，彼此不對話。每條規則各自做血檢檢查、各自設門檻、
各自決定方向，所以一定會互相矛盾，而且只有人類看得出來。最毒的一種：補品引擎用
`s.name.includes()` 做去重，會抓到自己發出的「⚠️ 停止X」警告卡，再改寫成「補X」。

---

## 三條通則（能消掉大部分矛盾）
- **Rule A — 補品壓制**：宣告式「補品 → 會抬高哪些 marker」表；marker 在**危險側**（高，而非缺乏）
  時壓制/加註該補品。新補品填一列就被守門。→ 已實作 `lib/supplement-lab-guard.ts`。
- **Rule B — 赤字否決/夾限**：把 EA / recovery / 血檢 pattern（RED-S、甲狀腺、過訓練）列為
  protector；任一 hard protector 觸發 → 赤字夾到 ≤0。**trajectory-adjust 必須過這層**（目前繞過）。
- **Rule C — 單一上下限表**：把散落各處的 floor/cap 集中（碳水下限、**腎指標蛋白上限**、APOE4 飽和脂肪上限、
  性別/RED-S 脂肪下限），最終 macro 一律夾進 [floor, cap]，方向衝突時安全側勝。

---

## 矛盾清單（21 項）與狀態

### ✅ 已修並上線（2026-06，已驗證 tsc + vitest）
| # | 嚴重 | 內容 | 修法 | commit |
|---|---|---|---|---|
| 0 | 🔴 | 補品推肌酸 vs 血檢減肌酸（謝佳峻原始案例） | 收斂進 Rule A 交互表 | e417ab4 → d1c92c7 |
| 1 | 🔴 | 維生素D>100 毒性卡被 5-HTTLPR dedup 改寫成「D3 4000 IU」 | isCorrective 守衛 + Rule A 兜底 | d1c92c7 |
| 2 | 🔴 | 鐵蛋白>200 停鐵卡被血紅素低 merge 成「補鐵 25mg」 | isCorrective 守衛（284/291）→ 改走就醫評估 | d1c92c7 |
| 3 | 🔴 | 鋅>120 停鋅卡被睪固酮低改寫成「補鋅」 | isCorrective 守衛 + Rule A 壓制 | d1c92c7 |
| 4 | 🔴 | 維生素D 低推 D3 vs 血鈣高該停 D3 | Rule A：D3 → 血鈣 marker，高鈣壓制 | d1c92c7 |
| 21 | 🟡 | lab-advisor 同半胱胺酸推肌酸 vs 肌酸酐高停肌酸（肌酸矛盾的另一道門） | 同半胱胺酸區塊加腎指標守門 | d9121af |
| 20 | 🟡 | CRP→Omega-3 敏感度三引擎不一（補品>5 / lab>1 / recovery>3） | Rule A 涵蓋補品側；閾值對齊待辦 | 部分 |

**Rule A 已涵蓋並自動防護的補品×血檢交互**（`SUPPLEMENT_LAB_INTERACTIONS`）：
肌酸↔腎、鐵劑↔鐵蛋白、鋅↔血清鋅、維D↔血鈣、維D↔維D毒性、電解質/鉀↔血鉀、鎂↔腎、電解質↔腎。
新增補品只要在這張表填一列即被守門。

### ⏳ 待辦（需要更大面積改動 + UI 實看驗證，不在本批次倉促做）
| # | 嚴重 | 內容 | 需要的通則 / 風險 |
|---|---|---|---|
| 5 | 🔴 | nutrition-engine 蛋白可開到 3.0 g/kg、**完全不讀腎指標**；lab-advisor 卻說「腎指標偏離避免>2.0」 | Rule C 腎指標蛋白上限。風險：nutrition-engine 4900 行、多條蛋白路徑（增量 adjust / goal-driven / 賽日 / 耗竭），要加**單一共用 clamp** 套所有路徑，否則又是破洞補洞 |
| 6 | 🔴 | trajectory 砍熱量 vs recovery 該 refeed/休息 | Rule B。trajectory 完全不讀 recovery 輸入（cron daily 已有 recoveryCritical 部分 gate） |
| 7 | 🔴 | trajectory 砍熱量 vs 血檢 pattern（甲狀腺/RED-S/過訓練）該停赤字 | Rule B（lab pattern 設 hard protector） |
| 8 | 🟠 | lab-advisor 自相矛盾：鐵蛋白低→多吃紅肉 vs 尿酸/ApoB/LDL 高→少吃紅肉 | Rule D 飲食方向對帳。風險：改的是 UI 顯示的 foodsToIncrease/Reduce，需實看畫面 |
| 9 | 🟠 | insight 對減脂停滯建議 refeed vs trajectory 對落後建議再砍 | Rule B + 共用「停滯」判讀 |
| 10 | 🟠 | 競賽模式 RED-S 只軟扣分、仍可過減脂閘 | **需 Howard 拍板**：RED-S 設 hard stop vs 維持軟扣分 |
| 11 | 🟠 | APOE4 限飽和脂肪 vs 睪固酮低要拉飽和脂肪 | Rule C：SFA cap 為硬上限，T-support 在 cap 內調 |
| 12 | 🟠 | recovery refeed 碳水 vs lab（胰島素/HOMA/TG 高）砍碳水 | Rule C 碳水上下限 + Rule B refeed 期暫停 lab 碳水修正 |
| 13 | 🟠 | lab getLabMacroModifiers 碳水−0.5 vs serotonin/athletic 碳水下限 | Rule C 碳水 floor 統一 |
| 14 | 🟠 | client-feed 顯示「熱量下調」即使該砍應被 veto | Rule B 放在「寫 macro / 進 feed」之前；feed 只渲染已對帳結果 |
| 15 | 🟠 | 鐵蛋白高三套閾值（supplement>200 / labStatus / lab-advisor 男>300） | 單一真相：全引擎讀 calculateLabStatus |
| 16 | 🟠 | **labStatus 空腹血糖/HbA1c 仍「越低越好」** → 低血糖/過低 HbA1c 顯示綠燈 | 改 LAB_THRESHOLDS 為區間型（加下限）。風險：status 連動 clients.status trigger，是 CLAUDE.md 共用常數紅線，要 grep 全 repo + 實看畫面 |
| 17 | 🟠 | client-feed 用 lab-trend-analyzer 嚴重度，全系統用 calculateLabStatus → 學員/教練看到的狀態不一致 | 同 #15，單一狀態來源 |
| 18 | 🟡 | 鎂觸發線不一（supplement<1.8 / labStatus attention 1.8-2.0 / lab-advisor<2.0） | 閾值對齊 |
| 19 | 🟡 | nutrition-engine 增肌路徑無安全閘（cuttingReadiness 只擋 cut/recomp） | Rule C cap 對 bulk 亦生效 |

---

## 下一步建議順序（給未來的 session）
1. **Rule C 腎指標蛋白上限**（#5）：在 nutrition-engine 各蛋白路徑的最終 g 值前，加一個**共用 clamp**
   `clampProteinByKidney(grams, bw, labs, gender)`，肌酸酐>1.3/1.1 或 eGFR 低 → 上限 2.0 g/kg。寫測試 + 報告實看。
2. **Rule B trajectory veto**（#6/#7/#9/#14）：trajectory-adjust 增加 recovery + lab pattern 輸入，
   hard protector 觸發 → 不下砍。client-feed 改成只渲染已對帳結果。
3. **#16 labStatus 區間化**（血糖/HbA1c 加下限）：grep 全 repo 共用常數 + 報告/timeline 實看。
4. **#8 / #15 / #17 / #18 / #20** 閾值與飲食方向收斂。
5. **#10 RED-S hard stop**：先問 Howard 政策決定。

> 任何新增引擎或建議，先問：「它會不會跟別的引擎講相反的話？」能用通則蓋住就別寫新 if。
