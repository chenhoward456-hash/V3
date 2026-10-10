# 頁面讀取與修改分離

學生/教練頁面的資料 GET 只讀取。`nutrition-suggestions?autoApply=true` 的旧 flag 不再寫入；不把 mount 改成 POST 來假裝修好。

| API | GET | 明確修改 |
| --- | --- | --- |
| `/api/nutrition-suggestions` | 建議＋目前DB目標/override狀態 | POST JSON `{action:"apply",clientId,code}`，保持有效帳號、教練tier、override、冷卻、模式與引擎安全閘 |
| `/api/referral` | 既存碼；無碼回 `code:null` | POST JSON `{action:"create_code",clientId:<unique_code>}`；原申請推薦關係POST相容 |
| `/api/client-overview` | 不記教練查看時間；報告預覽只GET | POST JSON `{action:"viewed",clientId}`需教練權限；教練詳情成功載入後記查看事件 |
| `/api/admin/proposals` | 在回應計算過期狀態，不掃資料 | 既有daily維護掃過期；原POST核准/退回不變 |
| `/api/admin/push-onboarding`、`push-lab-recommendation` | 預覽、不保存、不推訊息 | POST，同原query；`dryRun=1`仍唯讀 |
| `/api/admin/notify-client-macros` | 回文字及目標，不推學員LINE | POST，同原query，才推LINE；`dryRun=1`唯讀 |
| `/api/admin/trajectory-check` | 回分析，不推教練LINE | POST，同原query，才推；`dryRun=1`唯讀；LINE force_recalc caller已更新 |

教練未到期鎖保持優先。已到期override的GET仍顯示真正儲存值＋等待排程還原提示，不能偽稱已還原；daily既有維護會還原temporary macro。POST明確套用遇到到期鎖也可還原，但同request不接著自動改macro。共同helper比對舊override JSON才更新（CAS），避免清掉教練剛設的新鎖；所有macro變更仍寫調整紀錄。還原成功但audit失敗會明確回報，不盲目rollback覆蓋新設定。

既有體重提交POST後自調保留；學生單純查看頁面不再修改營養目標。自主管理初始化在提交設定成功後才明確POST。只把HTTP method換成POST不是授權機制：身份/學員碼、tier、有效性及所有原安全閘仍須驗。

## 有意例外與界限

Cron GET仍是有Cron auth的維護命令，Vercel GET排程不改；OAuth callback、簽名退訂連結、購買下載扣次數仍是原action流程，不當作dashboard GET。AI insights初載type=all不耗AI、不寫usage，使用者點指定生成操作仍保留原usage記錄；限流Redis計數屬操作性防護state。關閉教練訊息卡才POST read，不是自動初載已讀。

原記憶說 notify-client-macros/trajectory-check『只讀』僅指不改macros，實際舊GET會推LINE；以路由為準。Repo只找到LINE force_recalc的trajectory已知caller；外部手動scripts原GET send/save需改POST，GET現在安全地回preview。不要用整支dailycron只為驗證一則訊息。

本次使用mock API／fake Supabase URL／假cookie驗證頁面，沒有production写入、真訊息發送或真學員資料截图。`get_client_dashboard`部署的RPC定義不在repo，本次沒有查production pg_get_functiondef，不能宣稱它的SQL內部副作用已完全驗證。

## 手動命令的推送回報與推薦碼並行

四支手動 LINE 命令均檢查實際回應，不吞錯假稱完成。`saved` 表示資料是否已保存，`pushed` 只有全部訊息被接受才是 true，`sent_count` / `total_count` 和 `partial` 表示已確認的部分；失敗回 HTTP 502，`notification=failed` 表示收到拒絕回應，`unknown` 表示斷線後最後一則送達不明。保存成功後通知失敗不 rollback，先核對訊息與保存內容，勿整批盲目重送。Onboarding 中途失败立即停下，不發完成訊息。

手動命令 opt in `pushMessage(..., {deliveryReceipt:true})`，取得 quota relay 的真正回應，且各 attempt 不自動重試；其餘 callers 原有重試与 Response 語意保持不變。429 的 admin relay 仍沿用既有路由，relay 成功不能被誤報失敗。

推薦碼按查出的 client UUID 作 SHA256 後截成 `REF-` +16碼（共20字元），利用現有 code UNIQUE 防同學員並行產生兩碼，沒有假設 client_id UNIQUE、沒有 migration。已有隨機碼照舊使用；unique collision 依 code 回讀並核對 client_id，他人碼回409。GET 的 client/code/reward 任一查詢出錯都回500，不偽造無碼或零獎勵。
