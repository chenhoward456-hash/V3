import { z } from 'zod'
import { NextResponse } from 'next/server'

export function validateBody<T>(schema: z.ZodType<T>, body: unknown):
  { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues.map((e: { message: string }) => e.message).join('; ')
    return { success: false, response: NextResponse.json({ error: message }, { status: 400 }) }
  }
  return { success: true, data: result.data }
}
