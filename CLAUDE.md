
## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## 紅線（每次都要遵守，不可省略）

**這個專案沒有 staging，Supabase（health-management / yibnydvmvdvenwgxpfvc）= production，裡面是真實學員資料。**

1. **動 DB 前先讀 `docs/SCHEMA.md`**——CHECK constraints、UNIQUE 約束、triggers 地雷都在裡面。INSERT/UPDATE 撞 constraint 不是運氣差，是沒讀文件。
2. **寫入學員資料（clients 及其關聯表的 INSERT/UPDATE/DELETE）先跟 Howard 確認**，除非他在當前任務裡明確要求。SELECT 查詢隨意。刪 clients 會 CASCADE 刪光該學員所有資料。
3. **教練設定優先於引擎**：`coach_macro_override` 存在時任何引擎不可覆寫 macros；自動調整前必查 `auto_adjust_enabled`；所有 macro 變更寫 `macro_adjustment_log`（applied_by 只能 system/coach，trigger_source 只能 trajectory/manual/tdee_weekly）。
4. **`lab_results.status` 不是 UI 真相**：前端用 `utils/labStatus.ts` 的 `calculateLabStatus()` 重算；lab_results 上的 trigger 還會連動改 `clients.status`。「寫進 DB 看起來對」≠「畫面上對」。
5. **改 UI 之後必須實際看畫面**：起 dev server 用瀏覽器工具截圖驗證，不要只靠讀 code 推理渲染結果。
6. **共用常數改之前先 grep 全 repo**：LAB_THRESHOLDS（真相在 `utils/labStatus.ts`）、血檢 CATEGORIES（散在 timeline/standards 等頁）、client mode 邏輯（`lib/client-mode.ts`，且要跟 DB trigger `trg_sync_client_mode`／函式 `sync_client_mode_booleans()` 一致）。同一概念可能定義在 3+ 個地方。
7. **push 前先在本地驗證完**（tsc 已有 pre-commit hook；UI 用本地瀏覽器確認），不要用 Vercel deploy 當測試迴圈。

## Design System
動任何 UI / 視覺決策前，先讀 `DESIGN.md`（全站設計北極星）。配色、字體、間距、卡片、氣質都定義在那。
核心紀律：**顏色只做語意**——藍=品牌/互動，紅/黃/綠=血檢/訓練狀態（嚴禁裝飾），其餘一律中性灰；單一字族 Geist；卡片統一 `bg-white border border-slate-200 rounded-2xl p-5`。
未經 Howard 同意不要偏離。QA / review 時看到不符 DESIGN.md 的就標出來。
