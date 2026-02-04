export const cjBeautyData = {
  metrics: [
    {
      id: 'hcy',
      name: '同半胱胺酸',
      current: 12.5,
      target: 8.0,
      unit: 'μmol/L',
      description: '心血管健康指標，過高會增加血栓風險'
    },
    {
      id: 'ferritin',
      name: '鐵蛋白',
      current: 45,
      target: 50,
      unit: 'ng/mL',
      description: '鐵質儲存指標，影響能量代謝與免疫'
    },
    {
      id: 'body_fat',
      name: '體脂肪率',
      current: 28.5,
      target: 25.0,
      unit: '%',
      description: '身體組成指標，影響代謝健康'
    },
    {
      id: 'vitamin_d',
      name: '維生素 D',
      current: 35,
      target: 50,
      unit: 'ng/mL',
      description: '骨骼健康與免疫調節'
    },
    {
      id: 'omega3',
      name: 'Omega-3 指數',
      current: 6.8,
      target: 8.0,
      unit: '%',
      description: '抗炎指標，影響皮膚健康與心血管'
    },
    {
      id: 'crp',
      name: 'C-反應蛋白',
      current: 2.8,
      target: 1.0,
      unit: 'mg/L',
      description: '發炎指標，過高表示身體發炎'
    }
  ],
  weeklyProgress: [
    { week: 1, hcy: 15.2, ferritin: 38, body_fat: 30.2, vitamin_d: 28, omega3: 5.5, crp: 4.2 },
    { week: 2, hcy: 14.8, ferritin: 42, body_fat: 29.5, vitamin_d: 32, omega3: 6.0, crp: 3.8 },
    { week: 3, hcy: 14.2, ferritin: 44, body_fat: 29.0, vitamin_d: 34, omega3: 6.3, crp: 3.5 },
    { week: 4, hcy: 13.5, ferritin: 46, body_fat: 28.8, vitamin_d: 35, omega3: 6.5, crp: 3.2 },
    { week: 5, hcy: 13.0, ferritin: 47, body_fat: 28.6, vitamin_d: 36, omega3: 6.7, crp: 3.0 },
    { week: 6, hcy: 12.5, ferritin: 45, body_fat: 28.5, vitamin_d: 35, omega3: 6.8, crp: 2.8 }
  ]
}

export const supplementsData = [
  {
    id: 'folic_acid',
    name: '葉酸',
    dosage: '800mcg',
    timing: '早餐後',
    level: 1,
    purpose: '降低同半胱胺酸'
  },
  {
    id: 'b12',
    name: '維生素 B12',
    dosage: '1000mcg',
    timing: '早餐後',
    level: 1,
    purpose: '降低同半胱胺酸'
  },
  {
    id: 'b6',
    name: '維生素 B6',
    dosage: '50mg',
    timing: '晚餐後',
    level: 1,
    purpose: '降低同半胱胺酸'
  },
  {
    id: 'iron',
    name: '鐵質',
    dosage: '30mg',
    timing: '午餐後',
    level: 1,
    purpose: '提升鐵蛋白'
  },
  {
    id: 'vitamin_c',
    name: '維生素 C',
    dosage: '1000mg',
    timing: '鐵質同時',
    level: 1,
    purpose: '幫助鐵質吸收'
  },
  {
    id: 'vitamin_d3',
    name: '維生素 D3',
    dosage: '2000IU',
    timing: '早餐後',
    level: 1,
    purpose: '提升維生素 D'
  },
  {
    id: 'omega3',
    name: 'Omega-3',
    dosage: '2000mg',
    timing: '晚餐後',
    level: 1,
    purpose: '抗炎與皮膚健康'
  },
  {
    id: 'curcumin',
    name: '薑黃素',
    dosage: '500mg',
    timing: '睡前',
    level: 1,
    purpose: '降低發炎指標'
  },
  {
    id: 'probiotics',
    name: '益生菌',
    dosage: '30B CFU',
    timing: '空腹',
    level: 1,
    purpose: '腸道健康'
  },
  {
    id: 'collagen',
    name: '膠原蛋白',
    dosage: '10g',
    timing: '早餐前',
    level: 1,
    purpose: '皮膚彈性'
  }
]
