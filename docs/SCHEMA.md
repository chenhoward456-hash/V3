# DB Schema 參考（Supabase: health-management / `yibnydvmvdvenwgxpfvc`）

> 生成日期：2026-06-10。任何 INSERT/UPDATE 前先讀這份，特別是「地雷區」。
> 重新生成方式見文末。

## ⚠️ 地雷區（撞過的和會撞的）

1. **`lab_results.status` 寫了不算數**
   - 前端用 `calculateLabStatus()`（`utils/labStatus.ts`）重算顯示狀態，DB 裡的 status 不是 UI 真相來源。
   - `lab_results` 上有 trigger `trigger_update_client_status`（AFTER INSERT/UPDATE）：會根據該 client **全部** lab_results 的 status 重算 `clients.status`（有任一 alert → alert）。直接 INSERT status='alert' 會連動改 clients.status。
   - `lab-status-calculator.ts`（根目錄）只是向後相容的 re-export，單一真相來源是 `utils/labStatus.ts`。

2. **`clients` 的 mode 欄位會互相覆寫**
   - trigger `trg_sync_client_mode`（BEFORE UPDATE）：改 `client_mode` 會自動同步 `competition_enabled`/`health_mode_enabled`；反過來改 boolean 也會改 `client_mode`。**不要同時手動設這三個欄位**，挑一個改，其他讓 trigger 處理。
   - `trg_log_client_mode_change`（AFTER UPDATE）會寫進 `client_mode_history`。

3. **`supplements` 沒有 `frequency` 欄位**——頻率資訊放 `timing`（NOT NULL text）。`dosage` 也是 NOT NULL。

4. **一天一筆的表（UNIQUE 約束，重複 INSERT 會炸）**
   - `body_composition`、`daily_wellness`、`nutrition_logs`、`training_logs`：UNIQUE (client_id, date) → 用 upsert
   - `weekly_summaries`：UNIQUE (client_id, week_of)
   - `supplement_logs`：UNIQUE (supplement_id, date)
   - `lab_panel_notes`：UNIQUE (client_id, panel_date)（這張表存在，別忘了它）

5. **教練設定優先**：`clients.coach_macro_override`（jsonb）存在時，引擎不可覆寫 macros；自動調整前檢查 `auto_adjust_enabled`。所有 macro 變更必須寫 `macro_adjustment_log`（注意它的 CHECK，見下表）。

## CHECK 允許值速查

| 表.欄位 | 允許值 |
|---|---|
| clients.status | normal / attention / alert |
| clients.client_mode | standard / health / bodybuilding / athletic |
| clients.goal_type | cut / bulk / recomp |
| clients.subscription_tier | free / self_managed / coached / protocol / concierge |
| clients.training_experience | beginner / intermediate / advanced |
| clients.activity_profile | sedentary / high_energy_flux |
| clients.gene_mthfr | normal / heterozygous / homozygous |
| clients.gene_apoe | e2/e2, e2/e3, e3/e3, e3/e4, e4/e4 |
| clients.gene_depression_risk | LL / SL / SS / low / moderate / high |
| lab_results.status | normal / attention / alert |
| macro_adjustment_log.applied_by | system / coach |
| macro_adjustment_log.trigger_source | trajectory / manual / tdee_weekly |
| pending_proposals.proposed_by | ai_agent / system_trajectory / system_engine / coach |
| pending_proposals.proposal_type | macro_adjustment / cardio_change / personal_note / retest_request |
| pending_proposals.status | pending / approved / rejected / discussing / expired / auto_applied |
| personal_notes.added_by | coach / ai_agent / system / client_self_report |
| personal_notes.category | historical_failure / preference / constraint / context / goal_change / physiological_response |
| personal_notes.weight | 1–10 |
| training_logs.training_type | push / pull / legs / full_body / upper_body / cardio / rest / chest / shoulder / arms |
| training_logs | duration > 0 除非 training_type='rest'；rpe 1–10；sets > 0 |
| training_templates.goal_type | cut / bulk / recomp / maintenance（可 NULL）|
| training_templates.gender | 男性 / 女性 / 通用（可 NULL）|
| training_templates.experience_level | beginner / intermediate / advanced（可 NULL）|
| client_onboarding_notes.goal_type | cut / bulk / recomp / maintenance（可 NULL）|
| lab_panel_templates.goal_orientation | target / general_health |
| lab_panel_templates.gender | 男性 / 女性 / 通用（可 NULL）|
| daily_wellness 主觀分數 | sleep_quality / energy_level / mood / hunger / digestion / training_drive / cognitive_clarity / stress_level 都是 1–5 |
| daily_wellness 裝置數據 | resting_hr 30–150、hrv 0–300、respiratory_rate 5–40、wearable_sleep_score 0–100、device_recovery_score 0–100 |
| ebook_purchases.status | pending / completed / failed |
| referrals.status | pending / completed / expired |
| referral_codes.reward_type | free_days / discount |
| user_consents.consent_type | terms / privacy / health_disclaimer / data_sharing / all |
| blog_posts.category | 血檢優化 / 營養科學 / 訓練方法 / 恢復優化 / 個案追蹤 / 健康數據 / 訓練恢復 / 飲食營養 / 營養與恢復 / 備賽實戰 |

## Triggers

| 表 | Trigger | 時機 | 行為 |
|---|---|---|---|
| lab_results | trigger_update_client_status | AFTER INSERT/UPDATE | 重算 clients.status（取全部 lab_results 最嚴重者）|
| clients | trg_sync_client_mode | BEFORE UPDATE | client_mode ↔ competition_enabled/health_mode_enabled 雙向同步 |
| clients | trg_log_client_mode_change | AFTER UPDATE | mode 變更寫入 client_mode_history |
| nurture_subscribers | trg_nurture_subscribers_updated_at | BEFORE UPDATE | 更新 updated_at |

## 表清單（35 張）

幾乎所有表的 `client_id` 都 FK → `clients(id) ON DELETE CASCADE`（刪 client 會連鎖刪光該學員所有資料）。例外：`subscription_purchases.client_id` 是 SET NULL。

### 核心
- **clients** — 學員主表，60+ 欄。重點欄位：`unique_code`(UNIQUE)、`line_user_id`(UNIQUE)、`status`、`client_mode`、各 `*_enabled` 開關、`*_target` 營養目標、`coach_macro_override`(jsonb)、`macro_bounds`(jsonb)、`auto_adjust_enabled`、`training_plan`(jsonb)、`onboarding_notes_rendered`(jsonb)、`lab_panel_recommended`(jsonb)、基因欄位 `gene_*`
- **client_mode_history** — mode 變更紀錄（trigger 自動寫）
- **client_onboarding_notes** — onboarding 範本（`sections` jsonb NOT NULL、`placeholders` jsonb）
- **personal_notes** — 學員個人化筆記（category/added_by 有 CHECK、weight 1–10、relevant_until）

### 引擎 / 調整
- **macro_adjustment_log** — macro 變更稽核（old_macros/new_macros jsonb NOT NULL、hit_boundary、trajectory_data）
- **pending_proposals** — AI/系統提案佇列（24h 過期 default、current_state/proposed_changes jsonb NOT NULL、safety_check_result）
- **weekly_summaries** — 週總結與建議 macros（warnings jsonb default []）
- **cron_runs** — cron 執行紀錄（job_type、status default 'running'）

### 數據紀錄（學員打卡）
- **nutrition_logs** — 每日營養（protein/carbs/fat/calories/sodium/water）
- **training_logs** — 每日訓練（training_type CHECK、rpe、sets、compound_weight/reps）
- **training_sets** — 逐組紀錄（exercise_name、muscle_group、set_number、is_main_lift）
- **daily_wellness** — 主觀感受 + 穿戴裝置數據
- **body_composition** — 體組成（height/weight/body_fat/muscle_mass/visceral_fat/bmi）
- **supplements** / **supplement_logs** — 補品清單（timing 不是 frequency！archived_at、replaced_by_id 自參照）與打卡

### 血檢
- **lab_results** — 血檢數值（test_name、value、unit、status、custom_advice、coach_interpretation）
- **lab_panel_notes** — 整批報告的教練總結（UNIQUE client_id+panel_date、learner_notified_at）
- **lab_panel_templates** — 健檢套餐範本（add_on_items jsonb NOT NULL、base_price）
- **ai_draft_audit** — AI 草稿稽核（findings_brief jsonb、superseded_by_id 自參照）

### 訓練範本
- **training_templates** — 課表範本（plan_json jsonb NOT NULL；與 clients.training_plan 的 schema 必須一致——目前無自動檢查）

### LINE / 行銷漏斗
- **nurture_subscribers** — LINE 好友養成（PK 是 line_user_id，不是 uuid；last_sent_day）
- **line_webhook_debug_log** — webhook 除錯
- **diagnosis_emails**（email UNIQUE）、**waitlist**（email UNIQUE）、**blog_posts**（slug UNIQUE）
- **ebook_purchases** / **subscription_purchases** — 金流（merchant_trade_no UNIQUE、ECPay）
- **referral_codes** / **referrals** — 推薦（referee_id UNIQUE：一人只能被推薦一次）
- **user_consents** — 同意紀錄

### 整合 / 其他
- **garmin_connections**（client_id UNIQUE）/ **garmin_oauth_states** — Garmin OAuth
- **push_subscriptions** — Web Push（endpoint UNIQUE）
- **ai_chat_usage** — AI 聊天用量
- **coach_notifications** — 教練通知

## 前端常數對照（DB 之外的「第二真相」）

| 概念 | 位置 | 備註 |
|---|---|---|
| LAB_THRESHOLDS / calculateLabStatus | `utils/labStatus.ts` | 單一真相來源；根目錄 `lab-status-calculator.ts` 只是 re-export |
| 血檢分類 CATEGORIES | `app/c/[clientId]/health/timeline/page.tsx`、`standards/page.tsx` 等 | 多處定義，改一處要 grep 全部 |
| client mode 邏輯 | `lib/client-mode.ts` | 與 DB trigger `sync_client_mode_booleans` 行為要一致 |

## 重新生成

```sql
-- 欄位
SELECT table_name, string_agg(column_name || ' :: ' || data_type, ' | ' ORDER BY ordinal_position)
FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name;
-- CHECK / UNIQUE / FK
SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1;
-- Triggers
SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers WHERE trigger_schema='public';
```
