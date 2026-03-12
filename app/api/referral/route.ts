import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import crypto from 'crypto'

const log = createLogger('referral')

const supabase = createServiceSupabase()

/**
 * Generate a referral code based on the client's unique_code + random 4 chars.
 * Format: "ABC123XY-R4K2"
 */
function generateReferralCode(uniqueCode: string): string {
  const randomPart = crypto.randomBytes(3).toString('base64url').slice(0, 4).toUpperCase()
  return `${uniqueCode.toUpperCase()}-${randomPart}`
}

/**
 * GET /api/referral?clientId=<unique_code>
 * Returns the client's referral code, creating one if it doesn't exist.
 */
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId parameter' }, { status: 400 })
  }

  try {
    // Look up client by unique_code
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, unique_code, created_at')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Find existing referral code
    const { data: existingCode } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('client_id', client.id)
      .single()

    if (existingCode) {
      // Calculate total reward days earned
      const { data: completedReferrals } = await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', client.id)
        .eq('status', 'completed')

      const completedCount = completedReferrals?.length || 0
      const rewardDays = completedCount * (existingCode.reward_value || 7)

      return NextResponse.json({
        code: existingCode.code,
        totalReferrals: existingCode.total_referrals || 0,
        rewardDays,
      })
    }

    // Create new referral code
    const code = generateReferralCode(client.unique_code)

    const { data: newCode, error: insertError } = await supabase
      .from('referral_codes')
      .insert({
        client_id: client.id,
        code,
      })
      .select('*')
      .single()

    if (insertError) {
      log.error('Failed to create referral code', insertError)
      return NextResponse.json({ error: 'Failed to create referral code' }, { status: 500 })
    }

    return NextResponse.json({
      code: newCode.code,
      totalReferrals: 0,
      rewardDays: 0,
    })
  } catch (err: any) {
    log.error('Referral GET error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/referral
 * Apply a referral code during signup.
 * Body: { referralCode, refereeClientId }
 * - refereeClientId is the UUID (id) of the new client
 */
export async function POST(request: NextRequest) {
  try {
    const { referralCode, refereeClientId } = await request.json()

    if (!referralCode || !refereeClientId) {
      return NextResponse.json(
        { error: 'Missing referralCode or refereeClientId' },
        { status: 400 }
      )
    }

    // Validate the referral code exists
    const { data: codeRecord, error: codeError } = await supabase
      .from('referral_codes')
      .select('*, client_id')
      .eq('code', referralCode)
      .single()

    if (codeError || !codeRecord) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
    }

    // Prevent self-referral
    if (codeRecord.client_id === refereeClientId) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
    }

    // Check referee hasn't been referred before
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referee_id', refereeClientId)
      .single()

    if (existingReferral) {
      return NextResponse.json(
        { error: 'This user has already been referred' },
        { status: 409 }
      )
    }

    // Create referral record (status: pending)
    // It will be completed when the referee has been active for 7 days (checked by cron)
    const { error: referralError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: codeRecord.client_id,
        referee_id: refereeClientId,
        referral_code: referralCode,
        status: 'pending',
      })

    if (referralError) {
      log.error('Failed to create referral', referralError)
      return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 })
    }

    // Increment total_referrals on the referral code
    await supabase
      .from('referral_codes')
      .update({ total_referrals: (codeRecord.total_referrals || 0) + 1 })
      .eq('id', codeRecord.id)

    log.info('Referral created', {
      referrerClientId: codeRecord.client_id,
      refereeClientId,
      code: referralCode,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    log.error('Referral POST error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
