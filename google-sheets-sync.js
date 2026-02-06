// Google Apps Script
// 在 Google Sheets 中：工具 → 腳本編輯器

function syncToSupabase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('學員資料');
  const data = sheet.getDataRange().getValues();
  
  // Supabase 配置
  const supabaseUrl = 'https://jxwqyqyzyjzjzqlmzsupabase.co';
  const supabaseKey = 'your-anon-key';
  
  // 處理每一行數據
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // 如果有姓名
      const clientData = {
        name: data[i][0],      // 姓名
        age: data[i][1],       // 年齡
        gender: data[i][2],    // 性別
        status: data[i][3]     // 狀態
      };
      
      // 發送到 Supabase
      updateClientInSupabase(clientData, data[i][4]); // data[i][4] 是 unique_code
    }
  }
  
  // 觸發重新部署
  triggerRedeploy();
}

function updateClientInSupabase(clientData, uniqueCode) {
  const url = `${supabaseUrl}/rest/v1/clients?unique_code=eq.${uniqueCode}`;
  
  const options = {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(clientData)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('更新成功: ' + response.getContentText());
  } catch (error) {
    Logger.log('更新失敗: ' + error.toString());
  }
}

function triggerRedeploy() {
  // Vercel Webhook
  const vercelWebhookUrl = 'https://api.vercel.com/v1/integrations/deploy/prj_xxx/xxx/deploy';
  const vercelToken = 'your-vercel-token';
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vercelToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'health-management'
    })
  };
  
  try {
    const response = UrlFetchApp.fetch(vercelWebhookUrl, options);
    Logger.log('重新部署觸發: ' + response.getContentText());
  } catch (error) {
    Logger.log('重新部署失敗: ' + error.toString());
  }
}

// 自動觸發：當 Sheets 變更時
function onEdit(e) {
  syncToSupabase();
}

// 每小時自動同步
function createTrigger() {
  ScriptApp.newTrigger('syncToSupabase')
    .timeBased()
    .everyHours(1)
    .create();
}
