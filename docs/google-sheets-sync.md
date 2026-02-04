# Google Sheets 自動同步指南

## 🎯 設定 Google Apps Script

### 第一步：開啟 Apps Script
1. 打開你的 Google Sheets
2. 點擊「擴充功能」→「Apps Script」
3. 創建新的專案

### 第二步：貼上以下程式碼

```javascript
// 主要同步函數
function syncToHowardProtocol() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = sheet.getName();
    
    // 獲取指標數據
    const metricsSheet = sheet.getSheetByName('指標') || sheet.getSheets()[0];
    const metricsRange = metricsSheet.getDataRange();
    const metricsValues = metricsRange.getValues();
    
    // 準備數據
    const data = metricsValues.slice(1).map(row => [
      row[0], // 指標名稱
      row[1], // 現值
      row[2], // 目標值
      row[3], // 單位
      row[4]  // 描述
    ]);
    
    // 發送到 Howard Protocol
    const url = 'https://howard-protocol.com/api/sync-data';
    const payload = {
      source: 'google-sheets',
      data: data,
      sheetName: sheetName,
      timestamp: new Date().toISOString()
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      Logger.log('同步成功: ' + JSON.stringify(result));
      SpreadsheetApp.getUi().alert('數據同步成功！');
    } else {
      Logger.log('同步失敗: ' + result.error);
      SpreadsheetApp.getUi().alert('同步失敗: ' + result.error);
    }
    
  } catch (error) {
    Logger.log('錯誤: ' + error.toString());
    SpreadsheetApp.getUi().alert('同步錯誤: ' + error.toString());
  }
}

// 手動觸發函數
function manualSync() {
  syncToHowardProtocol();
}

// 設定定時觸發（每小時同步一次）
function createHourlyTrigger() {
  // 先刪除現有的觸發器
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // 創建新的定時觸發器
  ScriptApp.newTrigger('syncToHowardProtocol')
    .timeBased()
    .everyHours(1)
    .create();
  
  SpreadsheetApp.getUi().alert('已設定每小時自動同步');
}

// 設定每日觸發（每天早上 8 點同步）
function createDailyTrigger() {
  // 先刪除現有的觸發器
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // 創建新的定時觸發器
  ScriptApp.newTrigger('syncToHowardProtocol')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
  
  SpreadsheetApp.getUi().alert('已設定每日早上 8 點自動同步');
}

// 刪除所有觸發器
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  SpreadsheetApp.getUi().alert('已刪除所有自動觸發器');
}

// 測試函數
function testSync() {
  const testUrl = 'https://httpbin.org/post';
  const testData = {
    source: 'google-sheets',
    data: [
      ['同半胱胺酸', 12.5, 8.0, 'μmol/L', '心血管健康指標'],
      ['鐵蛋白', 45, 50, 'ng/mL', '鐵質儲存指標']
    ]
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(testData)
  };
  
  try {
    const response = UrlFetchApp.fetch(testUrl, options);
    Logger.log('測試成功: ' + response.getContentText());
    SpreadsheetApp.getUi().alert('測試成功！請檢查日誌。');
  } catch (error) {
    Logger.log('測試失敗: ' + error.toString());
    SpreadsheetApp.getUi().alert('測試失敗: ' + error.toString());
  }
}
```

### 第三步：設定觸發器

1. **手動同步**：
   - 執行 `manualSync()` 函數
   - 會立即同步數據到你的儀表板

2. **自動同步**：
   - 執行 `createHourlyTrigger()` 函數
   - 每小時自動同步一次
   - 或執行 `createDailyTrigger()` 函數
   - 每天早上 8 點自動同步

3. **測試連接**：
   - 執行 `testSync()` 函數
   - 測試與你的網站連接是否正常

### 第四步：Google Sheets 格式要求

你的 Google Sheets 必須包含以下格式：

**指標工作表**：
```
| 指標名稱 | 現值 | 目標值 | 單位 | 描述 |
|----------|------|--------|------|------|
| 同半胱胺酸 | 12.5 | 8.0 | μmol/L | 心血管健康指標 |
| 鐵蛋白 | 45 | 50 | ng/mL | 鐵質儲存指標 |
| 體脂肪率 | 28.5 | 25.0 | % | 身體組成指標 |
```

### 第五步：權限設定

1. 第一次執行時，Google 會要求權限
2. 點擊「允許」授權
3. 確保允許「外部連結」和「網路服務」權限

## 🎯 使用方法

### 手動同步：
1. 在 Google Sheets 中，點擊「執行」→「manualSync」
2. 等待幾秒鐘
3. 查看你的儀表板，數據應該已更新

### 自動同步：
1. 執行 `createHourlyTrigger()` 或 `createDailyTrigger()`
2. 系統會自動定期同步
3. 可以在「觸發器」頁面查看設定

### 停止自動同步：
1. 執行 `deleteAllTriggers()` 函數
2. 所有自動同步會停止

## 🔒 安全性

- Apps Script 使用 Google 的安全連接
- 數據透過 HTTPS 傳輸
- 可以在 Google 帳戶中查看執行日誌
- 可以隨時停止自動同步

## 🎯 故障排除

### 如果同步失敗：
1. 檢查網路連接
2. 確認你的網站可以正常訪問
3. 執行 `testSync()` 測試連接
4. 查看 Apps Script 執行日誌

### 如果權限錯誤：
1. 重新授權 Apps Script
2. 確保允許外部連結權限
3. 檢查 Google 帳戶的安全設定

## 🎯 進階設定

### 自定義同步頻率：
```javascript
// 每 30 分鐘同步一次
ScriptApp.newTrigger('syncToHowardProtocol')
  .timeBased()
  .everyMinutes(30)
  .create();

// 每週一早上 9 點同步
ScriptApp.newTrigger('syncToHowardProtocol')
  .timeBased()
  .onWeekDay(ScriptApp.WeekDay.MONDAY)
  .atHour(9)
  .create();
```

### 多工作表同步：
```javascript
function syncAllSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  
  sheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    // 發送每個工作表的數據
    sendToHowardProtocol(data, sheet.getName());
  });
}
```

## 🎯 完成！

設定完成後，你的 Google Sheets 就會自動同步到儀表板了！
