import { createClient } from '@supabase/supabase-js'
import './env.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const allowInsecureTls = String(process.env.SUPABASE_TLS_INSECURE || '').toLowerCase() === 'true'

if (allowInsecureTls) {
  // Dev-only fallback for environments with custom TLS interception certificates.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing backend env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  )
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
