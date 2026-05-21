# Longevity Tier W5 — 學員自助上傳血檢

> 收掉「教練手動輸入血檢」這個 scale 瓶頸。學員自己上傳，三種方式：手打 / CSV / Claude Vision OCR。

## 完成內容

### 1. Bulk insert API
`POST /api/lab-results/bulk`
- 一次最多 50 筆
- selfEntry mode → ip rate-limit 5 次/分鐘
- coach mode → 教練權限驗證
- 每筆獨立驗證（test_name / value / date），無效的跳過不阻擋有效的
- 自動套用 `LAB_THRESHOLDS` 計算 status（normal / attention / alert）
- 性別差異留給 utils/labStatus 處理

### 2. OCR API（Claude Vision + PDF）
`POST /api/lab-results/ocr`
- 接受 base64 圖檔（JPEG / PNG / GIF / WebP）或 PDF
- 一次最多 5 個檔案；圖檔 5MB 上限、PDF 10MB 上限
- ip rate-limit 5 次/10 分鐘（OCR 燒錢，限緊）
- System prompt 指定 35+ 個中文標準指標名稱對照表（一定要對到 LAB_THRESHOLDS）
- 輸出純 JSON 陣列，含容錯 parser 處理 ```json fence + 截斷
- 回傳每筆標記 `isKnown`（是否在系統指標清單）

### 3. 學員端自助上傳頁面
`/c/[clientId]/health/upload`
- 3 個 tab：✏️ 手打 / 📊 CSV / 📷 PDF/照片
- 共用「待確認清單」preview table（所有來源的資料都先進來這裡）
- preview 每格可編輯：項目（datalist autocomplete）、數值、單位、參考範圍、日期
- 「項目」欄位有色標 — 綠 = 對到系統指標、黃 = 不在清單（趨勢引擎不會分析這項）
- 「✅ 全部確認儲存」一次寫入

**手打 tab**：表單 → 加入下方清單 → 連續加多筆 → 全部儲存

**CSV tab**：
- 解析在 client side（HTML FileReader）
- 第一行欄位支援中英：test_name/value/unit/reference_range/date 或 項目/數值/單位/參考範圍/日期
- 支援 CSV 或 TSV

**OCR tab**：
- 上傳 PDF / 照片 → 送到 `/api/lab-results/ocr`
- 等 10-30 秒 → AI 萃取結果填到 preview 清單
- 學員可以改任何一欄
- 確認後一次寫入

### 4. Timeline 整合
- 空狀態（沒任何血檢）→ 綠色大按鈕導向 `/health/upload`
- 有資料時 → 底部「📥 上傳更多血檢資料」次要連結

## Debug 結果（我主動跑的）

| 檢查 | 結果 |
|---|---|
| TypeScript clean | ✅ |
| Production build | ✅ 94/94 static pages OK |
| `/health/upload` 頁面渲染 | ✅ 200 |
| `/api/lab-results/bulk` invalid body | ✅ 回 400「缺少 clientId 或 rows」|
| `/api/lab-results/bulk` valid selfEntry | ✅ inserted=1（並清掉測試資料） |
| `/api/lab-results/ocr` invalid | ✅ 回 400「缺少 files」 |
| Bundle size `/health/upload` | 7.93 kB（合理） |

## 沒測（需要你回來手動測）

- **OCR 實際辨識**：需要真實健檢報告 PDF/照片，且每次 call 都花 token。建議你拿一份自己的健檢報告 PDF 試一次，看 Claude Vision 能不能正確萃取台灣常見格式（聯安、美兆、北醫等）。**首測風險點**：
  - 台灣健檢報告很常用直式中文 + 英文混排
  - 不同診所的指標命名不一定一致（例：「總膽固醇」vs「Total Cholesterol」）
  - 我系統 prompt 已塞了標準名稱對照表，但仍可能漏對到的會標 isKnown=false 提醒你
- **CSV 上傳真實檔**：用既有 CSV 試試（你自己上傳過的健檢報告？）

## 商業意義

| 維度 | W4 前 | W5 後 |
|---|---|---|
| 學員加入血檢的方式 | 教練手動輸入 admin 後台 | 學員自己上傳（手打/CSV/AI OCR）|
| 加入 30 筆血檢的時間 | 教練 ~15 分鐘 | 學員 OCR 自動 + 30 秒確認 |
| 教練 scale 上限 | 每加一個客戶 +15 分鐘血檢輸入 | 0 額外工時 |
| Onboarding 流暢度 | 客戶要先給你健檢 → 你再輸入 | 客戶自己上傳完就能用 |

## 接下來（W6 候選）

- **A**. Landing page + 註冊流程 — 但你說等法規確認，先放著
- **B**. 教練接到「新學員上傳完血檢」的通知 + 主動寫 AI 草稿給他看
- **C**. 學員手機 PWA 通知（補品該吃了、新血檢解讀已生成）
- **D**. AI 草稿 audit dashboard（W4 audit log 有資料了，可以看「教練改了多少」）

## 我自己看 W5 的盲區

1. **OCR 真實準確度未知** — 沒實際打過健檢 PDF，純靠 prompt 講「應該對到這些指標」。可能首測會有 30-50% 的指標對不到，需要 prompt 迭代
2. **CSV 欄位對應寬鬆但可能太寬鬆** — 如果有人傳奇怪 header，會 throw error 而不是降級處理
3. **PDF 解析速度** — Claude API 對大 PDF（>5 頁）可能要 30 秒+，UI 沒做 streaming 進度條
4. **No 重複偵測** — 學員上傳兩次同一份報告會產生重複 row（沒 unique constraint on test_name+date+client）

這 4 個我沒解，因為都是「需要真實測試後才知道嚴重程度」的東西。你回來測完 OCR 跟我說哪邊怪。
