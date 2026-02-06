// Google Apps Script - 健康管理系統同步
// 在 Google Sheets 中：工具 → 腳本編輯器 → 貼上這個程式碼

// Supabase 配置
const SUPABASE_URL = 'https://jxwqyqyzyjzjzqlmzsupabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4d3F5cXl6eWp6anFxbG16c3VwYWJhc2UiLCJhcGlfdXJsIjoiaHR0cHM6Ly9qeHdxeXF5enlqempqcWxtenN1cGFiYXNlLmNvIiwicm9sZXMiOiJhbm9uIiwiaWF0IjoxNzM4NzY3MDA4LCJleHAiOjIwNTQzNDMwMDh9.qh7D2qL5zT8lKjJ3KqJ9mQ3nL2pR8sT4vY6wX7zZ9k';

// 主同步函數
function syncToSupabase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('健康管理學員資料');
  const data = sheet.getDataRange().getValues();
  
  Logger.log('開始同步資料...');
  
  // 跳過標題行，從第二行開始
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[0]) { // 如果有姓名
      const clientData = {
        name: row[0],      // 姓名
        age: row[1],       // 年齡
        gender: row[2],    // 性別
        status: row[3]     // 狀態
      };
      
      const uniqueCode = row[4]; // unique_code
      
      // 更新客戶基本資料
      updateClientInSupabase(clientData, uniqueCode);
      
      // 更新身體數據
      if (row[5] && row[6]) { // 如果有身高和體重
        const bodyData = {
          height: row[5],    // 身高
          weight: row[6],    // 體重
          body_fat: row[7],  // 體脂肪
          muscle_mass: row[8], // 骨骼肌
          visceral_fat: row[9]  // 內臟脂肪
        };
        
        updateBodyCompositionInSupabase(bodyData, uniqueCode);
      }
    }
  }
  
  Logger.log('同步完成！');
  
  // 觸發重新部署（可選）
  // triggerRedeploy();
}

// 更新客戶基本資料
function updateClientInSupabase(clientData, uniqueCode) {
  const url = `${SUPABASE_URL}/rest/v1/clients?unique_code=eq.${uniqueCode}`;
  
  const options = {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(clientData)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(`客戶 ${clientData.name} 更新成功`);
  } catch (error) {
    Logger.log(`客戶 ${clientData.name} 更新失敗: ` + error.toString());
  }
}

// 更新身體數據
function updateBodyCompositionInSupabase(bodyData, uniqueCode) {
  // 先取得 client_id
  const clientUrl = `${SUPABASE_URL}/rest/v1/clients?unique_code=eq.${uniqueCode}&select=id`;
  
  try {
    const clientResponse = UrlFetchApp.fetch(clientUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const clients = JSON.parse(clientResponse.getContentText());
    if (clients.length === 0) {
      Logger.log(`找不到客戶 ${uniqueCode}`);
      return;
    }
    
    const clientId = clients[0].id;
    const today = new Date().toISOString().split('T')[0];
    
    // 計算 BMI
    const height = parseFloat(bodyData.height);
    const weight = parseFloat(bodyData.weight);
    const bmi = height && weight ? (weight / Math.pow(height / 100, 2)).toFixed(1) : null;
    
    const bodyCompositionData = {
      client_id: clientId,
      date: today,
      height: height,
      weight: weight,
      body_fat: bodyData.body_fat ? parseFloat(bodyData.body_fat) : null,
      muscle_mass: bodyData.muscle_mass ? parseFloat(bodyData.muscle_mass) : null,
      visceral_fat: bodyData.visceral_fat ? parseFloat(bodyData.visceral_fat) : null,
      bmi: bmi ? parseFloat(bmi) : null
    };
    
    // 檢查今天是否已有記錄
    const existingUrl = `${SUPABASE_URL}/rest/v1/body_composition?client_id=eq.${clientId}&date=eq.${today}`;
    const existingResponse = UrlFetchApp.fetch(existingUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const existing = JSON.parse(existingResponse.getContentText());
    
    const bodyUrl = `${SUPABASE_URL}/rest/v1/body_composition`;
    const method = existing.length > 0 ? 'PATCH' : 'POST';
    const url = existing.length > 0 ? `${bodyUrl}?id=eq.${existing[0].id}` : bodyUrl;
    
    const options = {
      method: method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(bodyCompositionData)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(`身體數據更新成功: ${JSON.stringify(bodyData)}`);
    
  } catch (error) {
    Logger.log(`身體數據更新失敗: ` + error.toString());
  }
}

// 自動觸發：當 Sheets 變更時
function onEdit(e) {
  Logger.log('偵測到編輯，開始同步...');
  syncToSupabase();
}

// 手動觸發：建立選單
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('健康管理系統')
    .addItem('同步到 Supabase', 'syncToSupabase')
    .addToUi();
}

// 每小時自動同步
function createHourlyTrigger() {
  ScriptApp.newTrigger('syncToSupabase')
    .timeBased()
    .everyHours(1)
    .create();
}

// 停用所有觸發器
function disableTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
}
