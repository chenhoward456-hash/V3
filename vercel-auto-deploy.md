# Vercel 自動部署設定

## 方法 1：Vercel Webhook
1. 進入 Vercel Dashboard
2. 選擇專案 → Settings → Git
3. 找到 "Deploy Hooks"
4. 創建新的 Webhook
5. 複製 Webhook URL

## 方法 2：GitHub Actions
在專案根目錄建立 `.github/workflows/auto-deploy.yml`

```yaml
name: Auto Deploy on Data Change

on:
  repository_dispatch:
    types: [data-updated]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 方法 3：Vercel API
```javascript
// 在 Google Apps Script 中
function triggerRedeploy() {
  const vercelUrl = 'https://api.vercel.com/v13/deployments';
  const vercelToken = 'your-vercel-token';
  const projectId = 'your-project-id';
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vercelToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'health-management',
      project: projectId,
      target: 'production'
    })
  };
  
  UrlFetchApp.fetch(vercelUrl, options);
}
```
