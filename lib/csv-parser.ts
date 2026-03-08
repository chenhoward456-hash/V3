// CSV 解析工具（支援引號欄位）
export function parseCSV(csvText: string) {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    data.push(row)
  }

  return data
}

/**
 * 解析 CSV 單行，正確處理引號欄位
 * 例如: 'a,"hello, world",b' => ['a', 'hello, world', 'b']
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  return result
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
        const parsed = parseFloat(row[key])
        acc[key] = isNaN(parsed) ? 0 : parsed
      }
      return acc
    }, {} as Record<string, number>)
  }))
}
