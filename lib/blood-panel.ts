/**
 * 自費血檢清單 — 純前端（/tools/blood）
 *
 * 用途：公開的 IG lead magnet。列出健保健檢通常不驗、但值得自費加驗的 5 個指標。
 *
 * ⚠️ 合規紅線（這是全檔的設計約束，改任何東西前先讀）：
 *   - **不吃使用者的血檢數值、不做任何個人判讀。** 使用者只勾「這次健檢有沒有驗到」，
 *     輸出是「你可能還沒驗的項目」＋「帶去問醫師的問題清單」——是「幫人分辨、導向專業」，
 *     不是「對觀眾下診斷」。（依 Howard 的合規安全框：我自己＋研究說＋去找專業確認。）
 *   - **不放「理想值/最佳切點」當判準。** 只放「這是什麼、健保為何常略過、可以問醫師什麼」。
 *     切點（例如 ApoB <80、Hcy <10）因風險族群而異、出處常被誤植，一律交給醫師，頁面不背書。
 *   - 全部瀏覽器端算完，不打 API、不儲存。
 *
 * 引用皆 PubMed 實查（2026-07-10，隨附於頁面 citations）：
 *   ApoB=Sniderman 2011 Circ CQO (PMID 21487090)；hs-CRP=Ridker 2003 Circulation (PMID 12551853)；
 *   HOMA-IR=Matthews 1985 Diabetologia (PMID 3899825)；維生素D=Pilz 2011 Horm Metab Res (PMID 21154195)。
 */

export type MarkerKey = 'apob' | 'homocysteine' | 'hscrp' | 'homair' | 'vitd'

export type BloodMarker = {
  key: MarkerKey
  name: string
  en: string
  /** 白話：這個指標在看什麼 */
  plain: string
  /** 健保健檢為什麼通常不驗 */
  whyNhiSkips: string
  /** 帶去問醫師的問題（不是判讀，是問句） */
  askDoctor: string
}

export const BLOOD_MARKERS: BloodMarker[] = [
  {
    key: 'apob',
    name: '脂蛋白元 B',
    en: 'ApoB',
    plain: '算你血裡「會鑽進血管壁的壞膽固醇顆粒」有幾顆。研究上，它比一般驗的 LDL 膽固醇更能預測心血管風險。',
    whyNhiSkips: '健保血脂常規驗總膽固醇、LDL、HDL、三酸甘油酯，ApoB 要另外自費加驗。',
    askDoctor: '以我的心血管風險，需不需要看 ApoB 而不只是 LDL？我的數字落在哪裡？',
  },
  {
    key: 'homocysteine',
    name: '同半胱胺酸',
    en: 'Homocysteine',
    plain: '一種代謝廢物。偏高與血管疾病風險相關，也跟 B 群（葉酸、B6、B12）攝取和某些基因型有關。',
    whyNhiSkips: '不在一般健檢套組裡，通常要自費或有特定適應症才驗。',
    askDoctor: '我的同半胱胺酸偏高嗎？如果偏高，是飲食、B 群還是基因造成的，該怎麼追？',
  },
  {
    key: 'hscrp',
    name: '高敏感度 C 反應蛋白',
    en: 'hs-CRP',
    plain: '測身體「悶燒式」的慢性低度發炎。它比一般的 CRP 精細，看得到背景一直在燒的那種發炎。',
    whyNhiSkips: '一般健檢多驗普通 CRP（抓急性感染用），hs-CRP 精度不同，多半要指定加驗。',
    askDoctor: '我的 hs-CRP 有沒有反映慢性發炎？如果偏高，下一步要查什麼？',
  },
  {
    key: 'homair',
    name: '胰島素效率',
    en: 'HOMA-IR',
    plain: '用「空腹血糖 ＋ 空腹胰島素」一起算，看你身體處理糖有多吃力。血糖正常、但胰島素偏高在硬撐的人，光看血糖會被漏掉。',
    whyNhiSkips: '健保常驗空腹血糖，但很少同時驗空腹胰島素——沒有胰島素就算不出 HOMA-IR。',
    askDoctor: '可以幫我加驗空腹胰島素、一起算 HOMA-IR 嗎？我的血糖正常但代謝真的沒問題嗎？',
  },
  {
    key: 'vitd',
    name: '維生素 D',
    en: '25-OH Vitamin D',
    plain: '台灣人室內生活多、普遍偏低。跟骨骼、免疫、情緒都有關，缺很多時補充比較有感。',
    whyNhiSkips: '非高風險族群通常不列入常規健檢，要自費加驗。',
    askDoctor: '我的維生素 D 在什麼位置？需不需要補充、補多少、多久後回驗？',
  },
]

