# 安全性加強部署說明

## 🔒 安全性改進

### 1. RLS 政策強化
- 移除了不安全的 `USING (true)` 政策
- 建立基於角色的權限控制（教練角色）
- 未來可擴展學員角色權限

### 2. 輸入驗證
- 前端和後端雙重驗證
- 防止 XSS 攻擊
- 數值範圍檢查

### 3. API Routes 中間層
- 前端不再直接連接 Supabase
- 所有資料操作透過 API Routes
- Supabase 金鑰僅存在後端

## 🚀 部署步驟

### 1. 設定環境變數
在 `.env.local` 檔案中添加：
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=howard123
```

### 2. 執行 RLS 政策更新
```bash
# 在 Supabase SQL 編輯器中執行
\i security-rls-policies.sql
```

### 3. 建置和部署
```bash
npm run build
npm start
```

## 📋 安全性檢查清單

- [ ] 環境變數已設定
- [ ] RLS 政策已更新
- [ ] API Routes 正常運作
- [ ] 前端不再直接使用 Supabase 金鑰
- [ ] 輸入驗證正常運作
- [ ] 未授權存取被正確擋下

## 🔧 測試方法

### 1. 測試 API Routes
```bash
# 測試客戶資料 API
curl "http://localhost:3000/api/clients?clientId=k8f3m2n5"

# 測試血檢結果 API
curl "http://localhost:3000/api/lab-results?clientId=k8f3m2n5"
```

### 2. 測試輸入驗證
```bash
# 測試無效的血檢數值
curl -X POST http://localhost:3000/api/lab-results \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "k8f3m2n5",
    "testName": "HOMA-IR",
    "value": -1,
    "date": "2024-01-15"
  }'
```

### 3. 測試 XSS 防護
```bash
# 測試惡意腳本
curl -X POST http://localhost:3000/api/supplements \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "k8f3m2n5",
    "name": "<script>alert('xss')</script>",
    "dosage": "100mg",
    "timing": "早餐"
  }'
```

## 📝 注意事項

1. **Service Role Key** 具有完整權限，請勿洩露
2. **RLS 政策** 需要在 Supabase 後台執行
3. **環境變數** 僅存在伺服器端，前端無法存取
4. **輸入驗證** 前後端都要實施，雙重保護

## 🔄 後續改進建議

1. **JWT 認證**：實作完整的用戶認證系統
2. **速率限制**：防止 API 濫用
3. **日誌記錄**：記錄所有資料操作
4. **加密傳輸**：確保 HTTPS 部署
5. **定期備份**：保護重要資料
