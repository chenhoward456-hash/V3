import { z } from 'zod'

// ── Shared atomic schemas ──

export const uniqueCodeSchema = z.string().min(1, '缺少客戶 ID').max(20)
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必須為 YYYY-MM-DD')

// ── Route-specific schemas ──

/** POST /api/training-logs */
export const trainingLogSchema = z.object({
  clientId: uniqueCodeSchema,
  date: dateSchema,
  training_type: z.enum(
    ['push', 'pull', 'legs', 'full_body', 'upper_body', 'cardio', 'rest', 'chest', 'shoulder', 'arms'],
    { error: '訓練類型無效' }
  ),
  duration: z.number().positive('訓練時長必須大於 0').nullable().optional(),
  sets: z.number().int().min(0).max(100).nullable().optional(),
  rpe: z.number().min(1, 'RPE 必須在 1-10 之間').max(10, 'RPE 必須在 1-10 之間').nullable().optional(),
  note: z.string().nullable().optional(),
})

/** POST /api/push/send */
export const pushSendSchema = z.object({
  clientId: z.string().optional(),
  title: z.string().min(1, '缺少 title'),
  body: z.string().min(1, '缺少 body'),
  url: z.string().optional(),
})

/** POST /api/push/subscribe */
export const pushSubscribeSchema = z.object({
  clientId: z.string().min(1, '無效的 clientId').max(36),
  subscription: z.object({
    endpoint: z.string().min(1, '無效的訂閱資料'),
    keys: z.object({
      p256dh: z.string().min(1, '無效的訂閱資料'),
      auth: z.string().min(1, '無效的訂閱資料'),
    }),
  }),
})

/** POST /api/subscribe/waitlist */
export const waitlistSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  tier: z.string().optional(),
})

/** PUT /api/prep-phase */
export const prepPhaseSchema = z.object({
  clientId: uniqueCodeSchema,
  prepPhase: z.string().min(1, '缺少備賽階段'),
})

/** POST /api/admin/notifications (mark read) */
export const markNotificationReadSchema = z.object({
  notificationId: z.union([z.literal('all'), z.string().min(1)]).optional(),
})
