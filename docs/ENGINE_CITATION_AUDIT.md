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

## 4 項臨床決策（2026-06-12 Howard 拍板，commit 待補）

| 項目 | 決策 | 處理 |
|---|---|---|
| Hackney 2012「黃體期碳水 +15-20%」(查無文獻) | 改質性說法 | 全部註解 + 一處 `reasons.push` 客戶可見字串的「+15-20%」拿掉，改「碳水氧化/需求略增」。**邏輯 `carbBoostGPerKg +0.5` 不動。** |
| Webb 1986「黃體期 BMR +5-10%」(查無文獻) | 改質性說法 | 註解「+5-10%」拿掉，改「BMR 略升」。**`lutealDeficitBuffer` 邏輯不動。** |
| 女性碳水 6.5 g/kg | **維持** | Howard 實務經驗 > 爭議文獻；引用文字已講準（保留 Tarnopolsky 1995、移除被反駁的 James 2001）。 |
| 男性 cut 蛋白 2.0 g/kg | **維持** | Helms 2014 支持更高，2.0 當下限安全；註解已改引 Helms/Morton。 |

> 引擎審查至此全部結案。所有客戶可見的假數字/錯引用已清除；保留的引擎數值（6.5、2.0、黃體期 +0.5）是 Howard 的臨床判斷，依據文字已誠實標註。
