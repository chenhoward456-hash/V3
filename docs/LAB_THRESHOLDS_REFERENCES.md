# 血檢閾值文獻依據（LAB_THRESHOLDS 對照）

> 真相來源：`utils/labStatus.ts`（`LAB_THRESHOLDS` 醫院共識層 + `LAB_OPTIMAL_RANGES` Howard 標準層）。
> 本文件為每項閾值補上 PubMed 文獻依據,所有 PMID 均經 PubMed metadata 工具實查核對標題,非憑記憶。
> 建立日期:2026-06-11。
>
> **三層定義**:`normal` = 醫院標準（燈號）／`attention` = 過渡警示／`optimal` = Howard 標準（藍標,給追求最佳化的客群,刻意比醫院嚴）。
> optimal 多為長壽/功能醫學立場（Attia「Outlive」等),非醫學共識——這是設計意圖,溝通時定位為「優化目標」而非診斷標準。

---

## ⚠️ 需要 Howard 複核（優先）

| 項目 | 問題 | 文獻 | 建議 |
|---|---|---|---|
| **HbA1c optimal <5.0** | **方向性錯誤**:HbA1c 全因死亡呈 J 型,<5.0% 反而與較高全因/癌症死亡相關;系統把 4.x% 標成「最佳」與文獻相反 | PMID 22855733（Aggarwal/Selvin 2012, ARIC）:<5.0% 全因死亡 HR 1.32、癌症 HR 1.47 | optimal 改為「區間 5.0–5.4%」而非單向 <5.0 |
| **游離睪固酮（男女）optimal/上限** | normal 上限與 optimal 明顯高於華人實測上界（男 150 pg/mL）;疑因免疫法 vs 平衡透析/計算法差異 | PMID 29729137（Yu 2018, 華人男 FT 46–150 pg/mL） | 先確認系統 free T 是哪種測法,再定閾值 |
| **HDL-C「越高越好」無上限** | HDL 與全因死亡呈 U 型,男 >80、女 >93 mg/dL 風險回升;演算法對極高 HDL 仍判「最佳」 | PMID 28419274（Madsen 2017）/ PMID 35583863（Liu 2022, 冠心病 HDL>80 HR 1.96） | optimal 數值本身安全,但「越高越好」邏輯建議加上限 |
| **鐵蛋白_female attention 下限 8** | 8–12 ng/mL 僅標「注意」,但 WHO 視 <15 為缺乏 → 可能漏標女性鐵缺乏 | PMID 26876679（Aktaş 2016, IDA <15）/ PMID 29792778（運動員 ≤20 才受益） | 複核 attention 下限是否上調 |

---

## 代謝類

### HOMA-IR（無單位,越低越好）— normal ≤2.0 / attention ≤2.5 / optimal <0.8
- PMID 28660493（Isokuortti 2017）:健康族群上限 ~2.0,NAFLD 切點 1.9 → 支持 normal ≤2.0【符合主流】
- PMID 28811358（Zhang 2017 meta）:HOMA-IR 最高組全因死亡 RR 1.34、心血管 RR 2.11
- optimal 0.8【找不到直接文獻】長壽派立場,無原始 cutoff
- 亞洲:有（PMID 26781921 Tang 中國回顧）

### 空腹胰島素（μIU/mL,越低越好）— normal ≤5.0 / attention ≤8.0 / optimal <2.5
- PMID 28811358（Zhang 2017）:預測力**弱於 HOMA-IR**（全因死亡 p=0.058 邊緣）→ 視為輔助指標
- 主流無正式 cutoff;normal/attention【比 guideline 嚴】（因根本無 guideline）;optimal 2.5【找不到直接文獻】
- 亞洲:無

### 空腹血糖（mg/dL,越低越好）— normal ≤90 / attention ≤100 / optimal <80
- PMID 21193625（ADA 2011）:IFG 100–125 → attention 100【符合主流】
- PMID 10333902（Bjørnholt 1999, 22 年前瞻）:>85 mg/dL 心血管死亡 1.4 倍 → optimal 80【符合文獻】
- normal 90【比 guideline 嚴】（ADA 正常上限 <100）
- 亞洲:無（ADA 美國、Bjørnholt 挪威）

### HbA1c（%）— normal ≤5.5 / attention ≤5.7 / optimal <5.0 ⚠️見上方複核表
- PMID 20200384（Selvin 2010, NEJM, ARIC）:參考組 5.0–<5.5%;全因死亡 J 型 → normal 5.5【符合主流】
- PMID 21193625（ADA）/ PMID 41842862（AACE 2026）:糖尿病前期 5.7–6.4% → attention 5.7【符合主流】
- **optimal <5.0【與文獻矛盾】**（PMID 22855733,見複核表）
- 亞洲:無（ARIC 美國）

### 尿酸（mg/dL,越低越好）— 男 ≤7.0/≤8.0/<5.0；女 ≤6.0/≤7.0/<4.0
- PMID 29440009（Tseng 2018, JAHA, **台北 12.7 萬人**）:U 型,最低風險區 4–5 mg/dL,≥8 死亡上升 → 男 normal 7/attention 8/optimal 5【符合文獻】
- PMID 37288266（Huang 2023 NHANES）/ PMID 40331095（Zhao 2025, 含中國 CHARLS）
- **女 optimal 4.0 已在 U 型下緣,不宜再降**
- 亞洲:有（台灣 + 中國本土,本類最佳）

---

## 血脂類（單位 mg/dL）

主要錨點:PMID 30586774（AHA/ACC 2018）、PMID 31504418（ESC/EAS 2019）

### 三酸甘油酯 — normal 100 / attention 150 / optimal 60
- PMID 36631967（Wadström 2023）:TG ≥177 死亡率約 2 倍 → attention 150【符合主流】、normal 100【比 guideline 嚴】;optimal 60 長壽派
- 亞洲:無

### ApoB — normal 80 / attention 100 / optimal 50
- PMID 31504418（ESC/EAS）:目標 <65/<80/<100 風險分層 → normal 80/attention 100【符合主流】
- PMID 40347490（Gagnon 2025, MR）:降 ApoB 與冠心病因果相關;optimal 50 長壽派
- 亞洲:無

### Lp(a) — normal 30 / attention 50（無 optimal）
- PMID 20965889（EAS 2010）:desirable <50;<30/30–50/>50 三段 → 【符合主流】精準對應
- 亞洲:有（PMID 35210030 MESA 含華人亞組,證明需用族群分位數判讀）

### LDL-C — normal 100 / attention 130 / optimal 60
- ATP III/AHA/ESC:<100 optimal、130 borderline → normal 100/attention 130【符合主流】;optimal 60 長壽派
- 亞洲:有（PMID 29429368 台灣 T2DM,全因死亡最低在 LDL 80–89,<60 失去 statin 益處 → 勿過低）

### 總膽固醇 — normal 200 / attention 240 / optimal 170
- NCEP ATP III:<200 desirable、≥240 high → 【完全符合主流】;optimal 170 長壽派
- 亞洲:無

### HDL-C（越高越好）— 男 40/35/65；女 50/40/75 ⚠️見上方複核表
- AHA 低 HDL:男 <40/女 <50 → normal【符合主流】
- PMID 28419274（Madsen 2017）/ PMID 35583863（Liu 2022）:U 型,過高反增死亡 → 「越高越好」邏輯需加上限
- 亞洲:無

---

## 肝腎類

### ALT（U/L,無性別分檔）— normal ≤40 / attention ≤80 / optimal ≤25
- PMID 12093239（Prati 2002）:真正健康 ULN 男 30/女 19 → optimal 25 有強力文獻
- PMID 22817613（Wu 2012, **台北榮總** 3.4 萬人）:健康 ULN 男 21/女 17
- normal 40【符合主流但比「真正健康上限」寬】;**建議考慮加 ALT_female**（女性 ULN 明顯較低）
- 亞洲:有（台灣、越南、韓國）

### AST（U/L）— normal ≤40 / attention ≤80 / optimal ≤25
- PMID 27015199（Lee 2016 韓國世代）:AST/ALT 升高增全因/心血管/肝病死亡
- AST 缺「健康族群重訂 ULN」專文【optimal 25 沿用 ALT 邏輯外推,證據較弱】;健身者訓練後生理性上升（肌肉來源）
- 亞洲:有（韓國）

### GGT — 男 ≤60/≤120/≤30；女 ≤40/≤80/≤25
- PMID 24684379（Long 2014 meta, 57 萬人）:參考範圍內偏高即增全因/心血管/癌症死亡
- PMID 17384006（Kazemi-Shirazi 2007 維也納）:分界男 <14/女 <9,<30 歲風險最高
- **optimal（男 30/女 25）與文獻方向一致且有實證**;性別分檔正確
- 亞洲:有（韓國 KoGES PMID 32600956 / Ryoo PMID 24102943,代謝風險導向,契合健身客群）

### 白蛋白（g/dL,越高越好）— normal ≥3.5 / attention ≥3.0 / optimal ≥4.2
- PMID 31815281（Zhu 2020 meta）:低白蛋白全因死亡 RR 2.15
- normal 3.5【符合主流】;optimal 4.2 方向對但【無精準切點文獻】,死亡證據多來自疾病族群
- 亞洲:無

### 肌酸酐（mg/dL,範圍型）— 男 0.7–1.3 / 0.5–1.5；女 0.6–1.1 / 0.4–1.3
- PMID 17035344（Odden 2006）:**肌酸酐受肌肉量影響、cystatin C 不受** → 高肌肉量者血肌酸酐偏高會「假性」看似腎差
- PMID 34342777（Shiomi 2021 日本）:Cre/CysC 比值反映肌肉量
- 【符合主流】;**Howard 高肌肉量客群建議搭配 cystatin C 或 Cre/CysC,避免誤判**
- 亞洲:有（日本）

### BUN（mg/dL,範圍型）— normal 7–20 / attention 5–25
- 【找不到直接文獻】7–20 為教科書標準;受蛋白攝取/水合影響大,高蛋白飲食客群偏高屬正常,需搭配肌酸酐/eGFR
- 亞洲:無

### eGFR（mL/min/1.73m²,越高越好）— normal ≥90 / attention ≥60 / optimal ≥100
- KDIGO:G1 ≥90、G2 60–89、G3 <60 → normal/attention【完全符合主流】
- PMID 27956451（Taal 2016）/ PMID 36368777（Diao 2022 race-free）/ PMID 33301877（Inker 2020 panel）
- optimal ≥100【經驗值,無「>100 更佳」文獻】;高肌肉量者 eGFR 被低估,建議 cystatin C panel
- 亞洲:無

---

## 甲狀腺 / 發炎 / 血球

### TSH（mIU/L）— normal 0.4–4.0 / attention 0.3–5.0 / optimal 1.0–2.5
- PMID 11836274（Hollowell 2002 NHANES III）:無病族群幾何平均 1.40 → optimal 1.0–2.5 接近健康中位數
- PMID 33306038（Perros 2021）:TSH 超出參考區死亡率上升
- 【符合主流】;亞洲:有（PMID 21422036 香港華人,排除抗體後上限僅 3.70 → 對華人 4.0 可能偏寬,單一研究先知道）

### Free T4（ng/dL）— normal 0.8–1.8 / attention 0.6–2.0 / optimal 1.0–1.5
- PMID 19410568（Quinn 2009 健康華人）/ PMID 36686466（Xie 2023 華人 6.6 萬人）→ 【符合主流】
- 亞洲:有（大樣本華人）

### Free T3（pg/mL）— normal 2.3–4.2 / attention 2.0–4.5 / optimal 3.0–4.0
- PMID 36686466（Xie 2023）/ PMID 19410568（Quinn 2009）:FT3 **有性別差異** → 【符合主流但建議考慮性別化】（目前無 _female 變體）
- 亞洲:有

### CRP / hs-CRP（mg/L,閾值相同）— normal 1.0 / attention 3.0 / optimal 0.5
- PMID 12551878（Pearson 2003 AHA/CDC 官方聲明）:<1 低/1–3 中/>3 高風險 → normal/attention【完全符合主流】;optimal 0.5 長壽派
- 亞洲:有（PMID 26894972 華人,女性 hsCRP 與 NAFLD 關聯更強,可能應性別化;PMID 37406418 >90 歲長壽族群中位 3.80,高齡者勿過度標記）

### 同半胱胺酸（µmol/L）— normal 8.0 / attention 12.0 / optimal 6.0
- PMID 9157965（Verhoef 1997）:與冠狀動脈硬化線性相關,無清楚下限 cutoff
- **PMID 16531613（Lonn 2006, HOPE-2 RCT）:B 群降 Hcy 數值但未降心血管事件** → 定位為「B 群/甲基化指標」,勿承諾心血管效益
- normal 8.0/attention 12.0【符合主流且偏嚴】;亞洲:【找不到華人參考區】

### MCV（fL）— normal 80–100 / attention 75–105 / optimal 85–95
- PMID 24497225（Qiao 2014 北方漢族）→ 【符合主流】;亞洲:有

### 血紅素（g/dL）— 男 13.5–17.5/12.0–18.5/14.5–16.5；女 12.0–15.5/11.0–16.5/13.0–14.5
- PMID 19317606（Endres 2009, WHO 貧血定義）:女 <12/男 <13 → 下限對齊 WHO【符合主流】
- PMID 24497225（Qiao 2014 漢族）;亞洲:有

### 白血球（cells/µL）— normal 4000–10000 / attention 3500–12000
- PMID 24497225（Qiao 2014）:漢族/東亞 WBC 下限略低於白人 → attention 3500 對亞洲合理偏保守【符合主流】
- 亞洲:有

### 血小板（/µL）— normal 150k–400k / attention 130k–450k
- PMID 24497225（Qiao 2014）:漢族女>男,40 歲後下降 → 【符合主流】（血小板有性別差異,目前未性別化,可選優化）
- 亞洲:有

---

## 營養素類

### 鐵蛋白（男,ng/mL）— normal 50–150 / attention 30–200 / optimal 70–120
- PMID 34028001（Garcia-Casal 2021 Cochrane）:30 μg/L 敏感度 79%/特異度 98% → attention 30【符合主流】
- PMID 26561626（Peyrin-Biroulet 2015, 29 指引）/ PMID 36432426（Tarancón 2022,≤50 早期缺乏）→ normal 50【符合,偏嚴】
- 亞洲:有

### 鐵蛋白_female（ng/mL）— normal 12–200 / attention 8–300 / optimal 40–120 ⚠️見複核表
- PMID 26876679（Aktaş 2016）:IDA <15;PMID 29792778（Rubeor 2018 運動員 ≤20 才受益）
- **attention 下限 8 偏寬,8–12 可能漏標**;亞洲:有（PMID 24642526 馬來西亞含華人）

### 維生素D（ng/mL）— normal 50–100 / attention 30–150 / optimal 60–80
- PMID 39486479（Holick 2024）:2011 指引 ≥30 ng/mL、最佳 40–60 → attention 30【比 guideline 嚴派】;normal 50/optimal 60–80 高於 Endocrine 偏好,長壽派
- 亞洲:有（PMID 27026017 華人普遍偏低;PMID 36172722 泰國示範切點爭議影響）

### 維生素B12（pg/mL）— normal 400–900 / attention 200–1100 / optimal 500–800
- PMID 24942828（Devalia 2014 BCSH）:200–400 灰區,需搭配 MMA/holoTC
- PMID 21593512（Yetley 2011）:subclinical 缺乏單一血清 B12 敏感/特異度不足
- attention 200【符合主流】、normal 400【偏嚴,落灰區上緣】;亞洲:部分（PMID 31521916 華人趨勢,無切點）

### 葉酸（血清,ng/mL）— normal 5.4–20 / attention 3.0–24 / optimal 10–18
- PMID 24942828（Devalia 2014）/ PMID 33865264（Choi 2021 韓國,缺乏切點 3–4）→ attention 3.0【符合主流】
- 亞洲:有（韓國參考區間,直接適用東亞）

### 鎂（血清,mg/dL）— normal 2.0–2.4 / attention 1.8–2.6 / optimal 2.1–2.3
- PMID 28140318（Costello 2016）:現行區間源自 NHANES I(1974)人群分布非結局,正常範圍內仍可能次臨床缺乏
- PMID 29793661（Nielsen 2018,次臨床缺乏與 CRP≥3 相關）/ PMID 25023192（≤0.75 mmol/L≈1.82 與發炎相關）→ attention 1.8【符合主流,偏嚴且有據】
- 亞洲:無

### 鋅（血清,μg/dL）— normal 70–120 / attention 60–140 / optimal 85–110
- PMID 35140314（Pullakhandam 2022 印度）:IZiNCG 切點 ~70,但亞洲合理切點可能更低 → normal 70【符合主流,對亞洲可能偏嚴/過度標記】
- 注意抽血時段（晨間空腹切點不同）;亞洲:有（印度,主張切點更低）

### 鈣（血清,白蛋白校正,mg/dL）— normal 8.5–10.5 / attention 8.0–11.0 / optimal 9.0–10.0
- 8.5–10.5 為全球實驗室共識（鈣恆定性高,爭議低）;optimal 9.0–10.0【找不到直接文獻,屬區間內偏好值】
- 亞洲:無（族群差異小）

---

## 荷爾蒙類

> 核心華人文獻 **PMID 29729137（Yu 2018, Clin Chem Lab Med,1043 名健康華人男性）一篇涵蓋總睪固酮/游離睪固酮/生物可利用睪固酮/雌二醇/SHBG**。換算:睪固酮 ×28.84（nmol/L→ng/dL）、×288.4（→pg/mL）。

### 睪固酮（總,男,ng/dL）— normal 300–1000 / attention 200–1200 / optimal 700–900
- PMID 29562364（Bhasin 2018 Endocrine Society）:治療目標 mid-normal
- PMID 28324103（Travison 2017 harmonized）:健康非肥胖 19–39 歲 264–916
- PMID 29729137（華人 213–707）→ normal 300【符合主流】;**optimal 700–900 已逼近/超過華人上界 707,溝通宜說明**
- 亞洲:有

### 睪固酮（總,女,ng/dL）— normal 15–70 / attention 10–90 / optimal 40–60
- PMID 14999217（Guay 2004 美國,停經前 33.7–51.5）→ 【符合主流】;亞洲:無

### 游離睪固酮（男,pg/mL）— normal 47–244 / attention 30–300 / optimal 150–220 ⚠️見複核表
- PMID 29729137（華人 46–150）:下限符合,但**上限 244/optimal 150–220 高於華人上界 150**;PMID 29562364（測法建議）
- 【與文獻矛盾,先確認測法】;亞洲:有

### 游離睪固酮（女,pg/mL）— normal 0.5–8.5 / attention 0.3–10.0 / optimal 3.0–7.0 ⚠️見複核表
- PMID 14999217（Guay 2004,RIA 中位 1.03–1.51）:遠低於 optimal 3.0–7.0 → 【測法差異,建議核對】;亞洲:無

### 生物可利用睪固酮（男,ng/dL）— normal 200–380 / attention 150–380 / optimal 250–380
- PMID 29729137（華人 107–380,已核對換算）→ 上限 380 採華人實測,下限拉嚴至訓練客群【比 guideline 嚴】
- 亞洲:有（本項主要依據）

### 皮質醇（晨間血清,µg/dL）— normal 6–18 / attention 4–22 / optimal 8–12
- 【找不到直接參考區間原始論文】旁證 PMID 29813028（晨間 10.6–18.9 µg/dL,非參考區間研究）
- normal 6–18 與教科書通用值相符;optimal 8–12 功能醫學立場;亞洲:無

### DHEA-S（男,µg/dL）— normal 100–500 / attention 80–600 / optimal 250–450
- PMID 15887853（Carnevale 2005）:隨年齡下降,為骨吸收預測因子 → 主流以分齡呈現,100–500 為寬區間【符合主流】;optimal 250–450 抗老派
- 亞洲:無（PMID 29729137 未含 DHEA-S）

### DHEA-S（女,µg/dL）— normal 65–380 / attention 50–450 / optimal 200–350
- PMID 14999217（Guay 2004,140.4–195.6）→ 【符合主流】;亞洲:無

### 雌二醇（男,pg/mL）— normal 10–40 / attention 8–60 / optimal 15–30
- PMID 22977273（Yeap 2012 LC-MS/MS）/ **PMID 24024838（Finkelstein 2013 NEJM,E2 缺乏主導體脂增加）→ E2 勿過低**,optimal 15–30 有據【符合主流】
- 亞洲:有（PMID 29729137 華人,免疫法偏寬）

### 雌二醇（女,pg/mL）— normal 30–400 / attention 20–500 / optimal 50–300
- 【找不到分週期參考區間原始論文】（女性 E2 隨週期/停經變化大）;normal 30–400 為涵蓋全週期寬區間,符合常規;亞洲:無

### SHBG（男,nmol/L）— normal 10–57 / attention 8–70 / optimal 20–40
- PMID 29729137（華人 11.5–66.3）→ normal 下限幾乎相同【符合主流】;optimal 20–40 生理邏輯（過高結合過多 free T）
- 亞洲:有

### SHBG（女,nmol/L）— normal 18–144 / attention 15–160 / optimal 30–120
- PMID 14999217（Guay 2004,停經前無顯著年齡變化）→ 【符合主流】;亞洲:無

### 跨項 optimal 依據（訓練/身體組成）
- PMID 24024838（Finkelstein 2013 NEJM）:睪固酮缺乏→瘦體組織/肌力↓、E2 缺乏→體脂↑
- PMID 19293261（Sattler 2009 RCT）:生理劑量睪固酮提升瘦體組織/肌力/耐力、降體脂

---

## 文獻覆蓋總結

- **依據最強（華人 + guideline 雙重）**:生物可利用睪固酮、SHBG（男）、總睪固酮（男）、尿酸（台灣 12 萬人）、GGT（韓國代謝族群）。
- **亞洲族群資料齊備**:血球（Qiao 漢族）、甲狀腺（Xie/Quinn 華人）、CRP（Wang 華人）、維生素D、葉酸（韓）、ALT（台灣榮總）。
- **找不到直接文獻（沿用慣例/經驗值）**:AST optimal、BUN 全段、白蛋白 optimal、鈣 optimal、皮質醇/女性雌二醇參考區間。
- **缺亞洲資料**:HbA1c、血糖、胰島素、ApoB、總膽固醇、HDL、同半胱胺酸、女性荷爾蒙多項。
