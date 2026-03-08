// 方案 → 功能預設對應表
// free(0) / self_managed(499) / coached(2999)

export type SubscriptionTier = 'free' | 'self_managed' | 'coached'

const TIER_FEATURES: Record<SubscriptionTier, Record<string, boolean>> = {
  free: {
    body_composition_enabled: true,
    wellness_enabled: false,
    nutrition_enabled: true,   // 免費用戶也能使用基本營養追蹤，體驗核心功能
    training_enabled: false,
    supplement_enabled: false,
    lab_enabled: false,
    ai_chat_enabled: false,
    simple_mode: true,         // 免費用戶預設簡單模式，降低上手門檻
  },
  self_managed: {
    body_composition_enabled: true,
    wellness_enabled: true,
    nutrition_enabled: true,
    training_enabled: true,   // $499 也能記錄訓練，差別在教練不看
    supplement_enabled: false,
    lab_enabled: false,
    ai_chat_enabled: true,
    simple_mode: false,
  },
  coached: {
    body_composition_enabled: true,
    wellness_enabled: true,
    nutrition_enabled: true,
    training_enabled: true,
    supplement_enabled: true,
    lab_enabled: true,
    ai_chat_enabled: true,
    simple_mode: false,
  },
}

export function getDefaultFeatures(tier: SubscriptionTier) {
  return {
    ...TIER_FEATURES[tier],
    is_active: true,
  }
}
