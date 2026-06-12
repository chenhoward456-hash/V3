# 引擎文獻引用審查（PubMed 實查）

> 目的：系統的賣點是「有文獻、最佳化」。只要一條假引用被抓到，可信度就崩。
> 本文件記錄對客戶可見/引擎內引用的 PubMed 逐條核對結果。
> 教訓：引擎裡的引用不能憑印象信，要 PubMed 實查。關聯 `docs/LAB_THRESHOLDS_REFERENCES.md`。

最後更新：2026-06-12

---

## 已修正

### lib/supplement-engine.ts（2026-06-12，commit ef97b80）
多條捏造/掛錯引用正給學員看 → 全部修正或移除（Bhatt2012、Guest2021〔實為咖啡因〕、Zhang2017、Lukaszuk2012、Turner2006 查無；Tsang2015 期刊錯且 claim 與原文相反 → 換 Qin 2012）。

### lib/lab-nutrition-advisor.ts（2026-06-12，commit da37c25）
~90 條經 PubMed 核對，**3 條需修，已修**：
1. **Kose 2024 (Nutrients)「低碳 T3 降幅 34.6%」** → 查無此文，34.6% 數字無來源。移除捏造統計，保留質性說法。
2. **Krupa-Kotara 2025** → 掛錯作者，正確為 **Vranjić et al. 2025, Curr Issues Mol Biol（PMID 41020818）**。
3. **Miller 2011 三酸甘油酯**一處期刊掛錯 → **Circulation（PMID 21502576）**。
其餘為真實論文或正當指引/書籍（ADA/KDIGO/WHO/NCEP/AHA/Endocrine Society、Holick 2007 NEJM、Choi 2004 NEJM、Sniderman 2019 JAMA Cardiol…）。

### lib/nutrition-engine.ts（2026-06-12，commit ea15de9）
~24 條，編號 [1]-[17] 全部 PubMed 核對為真（Helms 2014 / Garthe 2011 / Trexler 2014 / Byrne 2018 MATADOR / Escalante 2021 / Aragon 2017 …）。已修 2 條：
1. **Bandegan 2017** 被當「2.0 g/kg 赤字上限」依據（實為休息日 1.5×REE 研究）→ 註解改引 Helms 2014 / Morton 2018。**常數 MIN_PROTEIN_PER_KG_CUT=2.0 未動。**
2. **女性肝醣超補 50-70%（客戶可見文字）** 移除被 James 2001 反駁的引用，保留 Tarnopolsky 1995 質性說法。**常數 LOADING_CARB_G_PER_KG_FEMALE=6.5 未動。**

---

## ⚠️ 待 Howard 臨床複核（未自動更動，因牽涉引擎數值/臨床判斷）

這些是「引用支撐引擎數字」的情況，改動會影響真實學員（尤其女性）的處方，不該在你不在時自動翻動。citation 我已標註，**數值與邏輯保留原狀等你拍板**：

| 項目 | 位置 | 問題 | 影響的引擎行為 | 選項 |
|---|---|---|---|---|
| Hackney 2012「黃體期碳水氧化 +15-20%, Br J Sports Med」 | nutrition-engine 多處註解 | PubMed 查無對應此數字/期刊的論文 | `carbBoostGPerKg +0.5`、黃體期 refeed 加分、luteal buffer | 補真實文獻 / 改成質性說法 / 維持 |
| Webb 1986「黃體期 BMR +5-10%」 | nutrition-engine 註解 | 只有作者+年，無期刊/篇名，無法確認 | `lutealDeficitBuffer`（黃體期赤字縮小 ~100kcal） | 補真實文獻 / 維持 |
| 女性碳水 6.5 g/kg（男性 9.0 的 ~72%） | `LOADING_CARB_G_PER_KG_FEMALE` | 50-70% 比例科學上有爭議（Tarnopolsky 支持較低、James 反駁） | 女性 peak week 超補碳水量 | 維持 6.5 / 調整 / 以個體實測為準 |
| 男性 cut 蛋白 2.0 g/kg | `MIN_PROTEIN_PER_KG_CUT` | 原依據(Bandegan)不成立；Helms 支持更高(2.3-3.1 g/kg LBM，惟分母不同) | 男性減脂蛋白下限 | 維持 2.0 / 上修 |

> 這些都不是客戶可見的假引用（除女性 50-70% 那句，已處理），所以沒有立即法律曝險；屬「引擎科學依據要不要更新」的層級，由你決定。
