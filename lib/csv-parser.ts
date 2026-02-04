// CSV 解析工具
export function parseCSV(csvText: string) {
  const lines = csvText.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: any = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    
    data.push(row)
  }

  return data
}

// 解析指標數據
export function parseMetricsFromCSV(csvText: string) {
  const data = parseCSV(csvText)
  
  return data.map(row => ({
    id: row['指標名稱'] || row['name'] || row['id'],
    name: row['指標名稱'] || row['name'] || '',
    current: parseFloat(row['現值'] || row['current'] || '0'),
    target: parseFloat(row['目標值'] || row['target'] || '0'),
    unit: row['單位'] || row['unit'] || '',
    description: row['描述'] || row['description'] || ''
  }))
}

// 解析補品數據
export function parseSupplementsFromCSV(csvText: string) {
  const data = parseCSV(csvText)
  
  return data.map(row => ({
    id: row['補品名稱'] || row['name'] || row['id'],
    name: row['補品名稱'] || row['name'] || '',
    dosage: row['劑量'] || row['dosage'] || '',
    timing: row['服用時間'] || row['timing'] || '',
    level: parseInt(row['等級'] || row['level'] || '1'),
    purpose: row['目的'] || row['purpose'] || ''
  }))
}

// 解析進度數據
export function parseProgressFromCSV(csvText: string) {
  const data = parseCSV(csvText)
  
  return data.map(row => ({
    week: row['週次'] || row['week'] || '',
    ...Object.keys(row).reduce((acc, key) => {
      if (key !== '週次' && key !== 'week') {
        acc[key] = parseFloat(row[key]) || 0
      }
      return acc
    }, {} as any)
  }))
}
