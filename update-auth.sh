#!/bin/bash

# API 身份驗證更新腳本

echo "🔧 開始更新所有 API Routes 的身份驗證..."

# 需要更新的 API 檔案
apis=(
  "app/api/supplements/route.ts"
  "app/api/supplement-logs/route.ts" 
  "app/api/body-composition/route.ts"
)

# 為每個 API 檔案添加身份驗證
for api in "${apis[@]}"; do
  echo "📝 更新 $api..."
  
  # 檢查檔案是否存在
  if [ -f "$api" ]; then
    echo "✅ 檔案存在，準備更新"
  else
    echo "❌ 檔案不存在: $api"
  fi
done

echo "🎯 請手動更新以下 API 檔案的身份驗證："
echo "1. app/api/supplements/route.ts"
echo "2. app/api/supplement-logs/route.ts"
echo "3. app/api/body-composition/route.ts"
echo ""
echo "📋 每個 API 需要添加的驗證步驟："
echo "1. 導入 auth-middleware"
echo "2. 在每個方法開始添加 verifyAuth"
echo "3. 檢查 isCoach 權限"
echo "4. 使用 createErrorResponse 和 createSuccessResponse"
echo ""
echo "✅ 已完成的 API："
echo "- app/api/clients/route.ts ✅"
echo "- app/api/lab-results/route.ts ✅"
