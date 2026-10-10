import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  rows: {} as Record<string, any>, writes: [] as Array<{ table: string; op: string; value: any }>,
  auth: true, casWon: true, updateError: null as any, logError: null as any,
  push: vi.fn(), suggestion: { status: 'on_track', message: 'keep', autoApply: true, suggestedCalories: 2300, suggestedProtein: 160, suggestedCarbs: 300, suggestedFat: 60 },
}))
const db = vi.hoisted(() => ({ from: vi.fn((table: string) => {
  let op = 'select'; let singular = false
  const q: any = {}
  for (const m of ['eq', 'or', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'in', 'is', 'single', 'maybeSingle', 'neq']) q[m] = vi.fn(() => q)
  q.single = q.maybeSingle = vi.fn(() => { singular=true; return q })
  q.select = vi.fn(() => q)
  for (const m of ['update', 'insert', 'upsert', 'delete']) q[m] = vi.fn((value: any) => { op = m; state.writes.push({ table, op, value }); return q })
  q.then = (resolve: any, reject: any) => {
    const error = op !== 'select' ? table === 'macro_adjustment_log' ? state.logError : state.updateError : null
    const data = op === 'update' ? state.casWon ? { id: 'c1' } : null : op === 'insert' && table === 'referral_codes' ? { code: 'REF-NEW' } : Object.prototype.hasOwnProperty.call(state.rows, table) ? state.rows[table] : []
    return Promise.resolve({ data: singular && Array.isArray(data) ? data[0] ?? null : data, error }).then(resolve, reject)
  }
  return q
}) }))
vi.mock('@/lib/supabase', () => ({ createServiceSupabase: () => db }))
vi.mock('@/lib/auth-middleware', () => ({ verifyAdminSession: () => state.auth, verifyCoachAuth: async () => ({ authorized: state.auth }) }))
vi.mock('@/lib/line', () => ({ pushMessage: state.push }))
vi.mock('@/lib/nutrition-engine', async original => ({ ...await original<typeof import('@/lib/nutrition-engine')>(), generateNutritionSuggestion: () => ({ ...state.suggestion }) }))

import * as nutrition from '@/app/api/nutrition-suggestions/route'
import * as referral from '@/app/api/referral/route'
import * as overview from '@/app/api/client-overview/route'
import * as proposals from '@/app/api/admin/proposals/route'
import * as onboarding from '@/app/api/admin/push-onboarding/route'
import * as labRecommendation from '@/app/api/admin/push-lab-recommendation/route'
import * as macroNotification from '@/app/api/admin/notify-client-macros/route'
import * as trajectory from '@/app/api/admin/trajectory-check/route'
import { restoreExpiredCoachOverride } from '@/lib/coach-macro-override'

function req(path: string, method = 'GET', body?: any, admin = true) {
  return new NextRequest(`http://localhost${path}`, {
    method, headers: { ...(admin ? { cookie: 'admin_session=test' } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
const expired = { locked_at: '2020-01-01', expires_at: '2020-01-02', locked_fields: ['calories_target'], previous_values: { calories_target: 2000 }, override_values: { calories_target: 1500 } }

beforeEach(() => {
  state.rows = {
    clients: { id: 'c1', unique_code: 'QAonly', name: '示意學員', gender: '男性', is_active: true, subscription_tier: 'self_managed', nutrition_enabled: true, auto_adjust_enabled: true, goal_type: 'cut', client_mode: 'standard', calories_target: 2200, protein_target: 160, carbs_target: 300, fat_target: 60, competition_date: '2027-07-01', target_weight: 70, target_date: '2027-07-01', line_user_id: 'sample-line', training_plan: [] },
    body_composition: [1, 2, 3, 4].map(i => ({ date: `2026-10-0${i}`, weight: 80-i/10, height: 175, body_fat: 20 })),
    nutrition_logs: [], training_logs: [], daily_wellness: [], lab_results: [], referral_codes: null,
    client_onboarding_notes: { id: 'template', sections: [{ title: '說明', slug: 'setup', body_md: '按目標走' }] },
    lab_panel_templates: { id: 'panel', base_price: 100, add_on_items: [] },
  }
  state.writes = []; state.auth = true; state.casWon = true; state.updateError = null; state.logError = null; state.push.mockReset().mockResolvedValue(new Response('', { status: 200 }))
  process.env.ADMIN_LINE_USER_ID = 'sample-admin'
})

it.each([false, true])('nutrition GET ignores autoApply and never restores expired override (%s)', async auto => {
  state.rows.clients.coach_macro_override = expired
  const res = await nutrition.GET(req(`/api/nutrition-suggestions?clientId=QAonly&autoApply=${auto}`))
  expect(res.status).toBe(200); const json = await res.json()
  expect(json.applied).toBe(false); expect(json.overrideExpired).toBe(true); expect(json.coachLocked).toBe(true)
  expect(state.writes).toEqual([]); expect(state.push).not.toHaveBeenCalled()
})
it('explicit nutrition POST applies and audits for an eligible client', async () => {
  const res = await nutrition.POST(req('/api/nutrition-suggestions', 'POST', { action: 'apply', clientId: 'QAonly' }))
  expect(res.status).toBe(200); expect((await res.json()).applied).toBe(true)
  expect(state.writes.map(w => [w.table,w.op])).toEqual([['clients','update'],['macro_adjustment_log','insert']])
})
it.each(['coached','protocol'])('explicit nutrition POST respects %s coach ownership', async tier => {
  state.rows.clients.subscription_tier = tier
  const res = await nutrition.POST(req('/api/nutrition-suggestions', 'POST', { action: 'apply', clientId: 'QAonly' }))
  expect(res.status).toBe(200); expect((await res.json()).applied).toBe(false); expect(state.writes).toEqual([])
})
it.each(['disabled','cooldown','locked'])('explicit nutrition POST preserves %s protection', async gate => {
  if (gate==='disabled') state.rows.clients.auto_adjust_enabled=false
  if (gate==='cooldown') state.rows.clients.last_auto_adjust_at=new Date().toISOString()
  if (gate==='locked') state.rows.clients.coach_macro_override={...expired,expires_at:'2099-01-01'}
  const res = await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))
  expect(res.status).toBe(200); expect((await res.json()).applied).toBe(false); expect(state.writes).toEqual([])
})
it('nutrition POST rejects unmatched student bearer code', async () => {
  const res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly',code:'wrong'},false))
  expect(res.status).toBe(401); expect(state.writes).toEqual([])
})
it('expired POST restores once, audits and does not immediately auto-apply', async () => {
  state.rows.clients.coach_macro_override=expired
  const res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))
  expect(res.status).toBe(200); const json=await res.json(); expect(json.restored).toBe(true); expect(json.applied).toBe(false)
  expect(state.writes).toHaveLength(2); expect(state.writes[0].value).toEqual({calories_target:2000,coach_macro_override:null})
})
it('restore lost CAS does not claim restoration or insert log', async () => {
  state.casWon=false
  const result=await restoreExpiredCoachOverride(db as any,'c1',expired)
  expect(result.restored).toBe(false); expect(state.writes).toHaveLength(1)
})
it('restore failed update does not log; failed log reports already restored', async () => {
  state.updateError={message:'save failed'}
  expect((await restoreExpiredCoachOverride(db as any,'c1',expired)).restored).toBe(false)
  expect(state.writes).toHaveLength(1)
  state.writes=[];state.updateError=null;state.logError={message:'audit failed'}
  const result=await restoreExpiredCoachOverride(db as any,'c1',expired)
  expect(result.restored).toBe(true);expect(result.error).toContain('audit failed')
})
it('referral GET with no code never creates; explicit POST creates', async () => {
  const res=await referral.GET(req('/api/referral?clientId=QAonly'))
  expect((await res.json()).code).toBeNull();expect(state.writes).toEqual([])
  const post=await referral.POST(req('/api/referral','POST',{action:'create_code',clientId:'QAonly'}))
  expect(post.status).toBe(200);expect((await post.json()).code).toBe('REF-NEW');expect(state.writes[0].table).toBe('referral_codes')
})
it('coach overview GET is read-only; only authenticated viewed POST marks', async () => {
  await overview.GET(req('/api/client-overview?clientId=QAonly'));expect(state.writes).toEqual([])
  const post=await overview.POST(req('/api/client-overview','POST',{action:'viewed',clientId:'QAonly'}));expect(post.status).toBe(200)
  expect(state.writes[0].value.coach_last_viewed_at).toBeTypeOf('string')
  state.auth=false;state.writes=[];expect((await overview.POST(req('/api/client-overview','POST',{action:'viewed',clientId:'QAonly'}))).status).toBe(401);expect(state.writes).toEqual([])
})
it('proposal GET computes expiration without sweeping data', async () => {
  state.rows.pending_proposals=[{id:'p1',status:'pending',proposed_at:'2020-01-01',expires_at:'2020-01-02'}, {id:'p2',status:'pending',proposed_at:new Date().toISOString(),expires_at:'2099-01-01'}]
  const all=await proposals.GET(req('/api/admin/proposals?status=all'));expect((await all.json()).data.map((p:any)=>p.status)).toEqual(['expired','pending'])
  const pending=await proposals.GET(req('/api/admin/proposals?status=pending'));expect((await pending.json()).data.map((p:any)=>p.id)).toEqual(['p2']);expect(state.writes).toEqual([])
})
it.each([onboarding,labRecommendation,macroNotification,trajectory])('manual admin GET returns preview without DB writes or notifications', async route => {
  const res=await route.GET(req('/api/admin/preview?clientId=c1'))
  expect(res.status).toBe(200);expect(state.writes).toEqual([]);expect(state.push).not.toHaveBeenCalled()
})
it('onboarding POST dryRun is read-only while command saves', async () => {
  await onboarding.POST(req('/api/admin/push-onboarding?clientId=c1&dryRun=1','POST'));expect(state.writes).toEqual([]);expect(state.push).not.toHaveBeenCalled()
  delete process.env.ADMIN_LINE_USER_ID
  const res=await onboarding.POST(req('/api/admin/push-onboarding?clientId=c1','POST'));expect(res.status).toBe(200);expect(state.writes[0].value.onboarding_notes_rendered).toBeDefined()
})
it('explicit macro notification POST sends while unauthorized requests do not', async () => {
  await macroNotification.POST(req('/api/admin/notify-client-macros?clientId=c1','POST'));expect(state.push).toHaveBeenCalledOnce()
  state.auth=false;state.push.mockReset().mockResolvedValue(new Response('', { status: 200 }));expect((await macroNotification.POST(req('/api/admin/notify-client-macros?clientId=c1','POST'))).status).toBe(401);expect(state.push).not.toHaveBeenCalled()
})

it.each([{is_active:false},{expires_at:'2000-01-01T00:00:00+08:00'}])('nutrition POST blocks inactive/expired even with admin cookie', async flags => {
  Object.assign(state.rows.clients,flags)
  const res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))
  expect(res.status).toBe(403);expect(state.writes).toEqual([])
})
it('nutrition POST accepts null expiry and uses existing exact expiry instant boundary', async () => {
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T12:00:00+08:00'))
  try {
    state.rows.clients.expires_at='2026-10-10T12:00:00+08:00'
    expect((await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))).status).toBe(200)
    state.rows.clients.expires_at=null;state.rows.clients.is_active=null
    expect((await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))).status).toBe(200)
  } finally { vi.useRealTimers() }
})
it('restore whitelist excludes arbitrary numeric client keys', async () => {
  await restoreExpiredCoachOverride(db as any,'c1',{...expired,previous_values:{calories_target:2000,age:99,water_target:500}})
  expect(state.writes[0].value).toEqual({calories_target:2000,coach_macro_override:null})
})
it('real installed Supabase CAS serializes JSON filter without contacting network', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const calls: Array<{url:string;body:any}>=[]
  const client=createClient('http://contract.invalid','fake-key',{global:{fetch:async(input:any,init:any)=>{
    calls.push({url:String(input),body:JSON.parse(init.body)})
    return new Response(JSON.stringify([{id:'c1'}]),{status:200,headers:{'Content-Type':'application/json'}})
  }}})
  await restoreExpiredCoachOverride(client,'c1',{...expired,previous_values:{}})
  expect(calls).toHaveLength(1)
  const filter=new URL(calls[0].url).searchParams.get('coach_macro_override')!
  expect(filter.startsWith('eq.')).toBe(true);expect(JSON.parse(filter.slice(3))).toEqual({...expired,previous_values:{}})
  expect(calls[0].body).toEqual({coach_macro_override:null})
})

it('nutrition POST rejects invalid JSON commands before queries', async () => {
  const res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{clientId:'QAonly'}))
  expect(res.status).toBe(400);expect(state.writes).toEqual([])
})
it('nutrition POST does not write without body measurements', async () => {
  state.rows.body_composition=[]
  const res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))
  expect(res.status).toBe(200);expect((await res.json()).applied).not.toBe(true);expect(state.writes).toEqual([])
})
it('nutrition POST preserves competition prep routing', async () => {
  Object.assign(state.rows.clients,{client_mode:'bodybuilding',prep_phase:'peak_week'})
  const res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))
  expect(res.status).toBe(200);expect((await res.json()).applied).toBe(false);expect(state.writes).toEqual([])
})
it('nutrition POST reports failed target write and already-applied audit failure distinctly', async () => {
  state.updateError={message:'storage failure'}
  let res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))
  expect(res.status).toBe(500);expect((await res.json()).applied).toBe(false);expect(state.writes).toHaveLength(1)
  state.updateError=null;state.logError={message:'audit failure'};state.writes=[]
  res=await nutrition.POST(req('/api/nutrition-suggestions','POST',{action:'apply',clientId:'QAonly'}))
  expect(res.status).toBe(500);expect((await res.json()).applied).toBe(true);expect(state.writes).toHaveLength(2)
})
it('admin onboarding save failure does not send; macro push failure is explicit', async () => {
  state.updateError={message:'storage failure'}
  expect((await onboarding.POST(req('/api/admin/push-onboarding?clientId=c1','POST'))).status).toBe(500);expect(state.push).not.toHaveBeenCalled()
  state.push.mockRejectedValue(new Error('offline'))
  const res=await macroNotification.POST(req('/api/admin/notify-client-macros?clientId=c1','POST'))
  expect(res.status).toBe(502);expect((await res.json()).pushed).toBe(false)
})

vi.mock('@/lib/trajectory-adjust', () => ({ computeTrajectoryAdjustment: () => ({ shouldAdjust: true, kcalAdjustment: -100, newMacros: { calories_target: 2100 }, reason: 'fixture' }) }))
it.each([onboarding, labRecommendation, macroNotification, trajectory])('manual POST dryRun is read-only on a notification-capable fixture', async route => {
  const res = await route.POST(req('/api/admin/any?clientId=c1&dryRun=1', 'POST'))
  expect(res.status).toBe(200); expect(state.writes).toEqual([]); expect(state.push).not.toHaveBeenCalled()
})
it.each([onboarding, labRecommendation, macroNotification, trajectory])('manual POST fails truthfully for a resolved failed LINE receipt', async route => {
  state.push.mockResolvedValue(new Response('', { status: 429 }))
  const res = await route.POST(req('/api/admin/any?clientId=c1', 'POST'))
  expect(res.status).toBe(502)
  const json = await res.json(); expect(json.pushed).toBe(false); expect(json.sent_count).toBe(0); expect(json.notification_status).toBe(429)
  expect(json.saved).toBe(route === onboarding || route === labRecommendation)
  expect(state.push).toHaveBeenCalledOnce()
})
it.each([onboarding, labRecommendation, macroNotification, trajectory])('manual POST does not resend an ambiguous delivery', async route => {
  state.push.mockRejectedValue(new Error('connection lost'))
  const res = await route.POST(req('/api/admin/any?clientId=c1', 'POST'))
  expect(res.status).toBe(502); const json = await res.json()
  expect(json.pushed).toBe(false); expect(json.notification).toBe('unknown'); expect(state.push).toHaveBeenCalledOnce()
})
it('onboarding preserves its save but stops after partial LINE acceptance', async () => {
  state.push.mockResolvedValueOnce(new Response('', { status: 200 })).mockResolvedValue(new Response('', { status: 500 }))
  const res = await onboarding.POST(req('/api/admin/any?clientId=c1', 'POST'))
  expect(res.status).toBe(502); const json = await res.json()
  expect(json.saved).toBe(true); expect(json.partial).toBe(true); expect(json.sent_count).toBe(1); expect(json.pushed).toBe(false)
  expect(state.push).toHaveBeenCalledTimes(2); expect(state.writes).toHaveLength(1)
})
it.each([onboarding, labRecommendation, macroNotification, trajectory])('manual POST unauthorized request cannot write or send', async route => {
  state.auth = false
  const res = await route.POST(req('/api/admin/any?clientId=c1', 'POST'))
  expect(res.status).toBe(401); expect(state.writes).toEqual([]); expect(state.push).not.toHaveBeenCalled()
})
