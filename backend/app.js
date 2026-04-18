import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import './env.js'
import { supabaseAdmin } from './supabaseAdmin.js'

const app = express()
const appPin = String(process.env.BACKEND_APP_PIN || process.env.VITE_APP_PIN || '')
const appAuthSecret = String(process.env.APP_AUTH_SECRET || '')
const tokenTtlMs = Number(process.env.APP_TOKEN_TTL_MS || 24 * 60 * 60 * 1000)

const allowedOrigins = String(process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    // Return null,false instead of an Error — avoids Express treating it as a 500
    callback(null, false)
  }
}

// Handle CORS preflight (OPTIONS) explicitly — required for Vercel serverless
app.options('*', cors(corsOptions))
app.use(cors(corsOptions))
app.use(express.json())

if (!appPin) {
  throw new Error('Missing BACKEND_APP_PIN env var for PIN login.')
}

if (!appAuthSecret) {
  throw new Error('Missing APP_AUTH_SECRET env var for API token signing.')
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeError(error, fallbackMessage) {
  if (!error) return fallbackMessage
  return error.message || fallbackMessage
}

async function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') {
    next()
    return
  }

  if (req.path === '/health' || req.path === '/auth/pin-login') {
    next()
    return
  }

  const authHeader = String(req.headers.authorization || '')
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing bearer token.' })
    return
  }

  const accessToken = authHeader.slice('Bearer '.length).trim()
  if (!accessToken) {
    res.status(401).json({ error: 'Unauthorized: empty bearer token.' })
    return
  }

  try {
    const payload = verifyAppToken(accessToken)
    if (!payload) {
      res.status(401).json({ error: 'Unauthorized: invalid or expired token.' })
      return
    }

    req.auth = payload
    next()
  } catch (error) {
    res.status(401).json({ error: normalizeError(error, 'Unauthorized request.') })
  }
}

app.use('/api', requireAuth)

function signBody(body) {
  return crypto.createHmac('sha256', appAuthSecret).update(body).digest('base64url')
}

function createAppToken() {
  const expiresAt = Date.now() + tokenTtlMs
  const payload = {
    sub: 'rd-agent-pin',
    exp: expiresAt
  }

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signBody(body)
  return {
    token: `${body}.${signature}`,
    expiresAt
  }
}

function verifyAppToken(token) {
  const [body, signature] = String(token || '').split('.')
  if (!body || !signature) return null

  const expectedSignature = signBody(body)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (!payload?.exp || Number(payload.exp) <= Date.now()) return null

  return payload
}

app.post('/api/auth/pin-login', (req, res) => {
  const pin = String(req.body?.pin || '').trim()

  if (!pin) {
    res.status(400).json({ error: 'PIN is required.' })
    return
  }

  if (pin !== appPin) {
    res.status(401).json({ error: 'Invalid PIN.' })
    return
  }

  const session = createAppToken()
  res.json({
    token: session.token,
    expiresAt: session.expiresAt
  })
})

async function getCollectionsForMonth(month, year) {
  const { data, error } = await supabaseAdmin
    .from('emi_collections')
    .select('id, account_id, amount, emis_paid, payment_mode, payment_date, month, year, accounts(name, village, emi_amount, next_emi_date)')
    .eq('month', month)
    .eq('year', year)
    .order('payment_date', { ascending: false })

  if (error) throw error
  return data || []
}

async function getCollectionsForDate(dateIso) {
  const { data, error } = await supabaseAdmin
    .from('emi_collections')
    .select('id, account_id, amount, emis_paid, payment_mode, payment_date, accounts(name, village, phone, emi_amount, next_emi_date)')
    .eq('payment_date', dateIso)

  if (error) throw error
  return data || []
}

async function getAllCollections() {
  const { data, error } = await supabaseAdmin
    .from('emi_collections')
    .select('id, account_id, amount, emis_paid, payment_mode, payment_date, month, year, accounts(name, village, phone, emi_amount, next_emi_date)')
    .order('payment_date', { ascending: false })

  if (error) throw error
  return data || []
}

async function getAccounts() {
  const { data, error } = await supabaseAdmin.from('accounts').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function getVillages() {
  const { data, error } = await supabaseAdmin
    .from('villages')
    .select('id, village_name')
    .order('village_name', { ascending: true })

  if (error) throw error
  return data || []
}

async function syncVillagesFromAccounts(accountsData, villagesData) {
  const existingVillageNames = new Set(
    (villagesData || []).map((village) => (village.village_name || '').trim()).filter(Boolean)
  )

  const missingVillageNames = [
    ...new Set((accountsData || []).map((account) => (account.village || '').trim()).filter(Boolean))
  ].filter((villageName) => !existingVillageNames.has(villageName))

  if (missingVillageNames.length === 0) {
    return villagesData || []
  }

  const { error: upsertError } = await supabaseAdmin
    .from('villages')
    .upsert(missingVillageNames.map((villageName) => ({ village_name: villageName })), {
      onConflict: 'village_name',
      ignoreDuplicates: true
    })

  if (upsertError) {
    return villagesData || []
  }

  return getVillages()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/bootstrap', async (req, res) => {
  const now = new Date()
  const month = toPositiveInt(req.query.month, now.getMonth() + 1)
  const year = toPositiveInt(req.query.year, now.getFullYear())
  const today = String(req.query.today || now.toISOString().slice(0, 10))

  try {
    const [accounts, villages, currentMonthCollections, todayPayments, allCollections] = await Promise.all([
      getAccounts(),
      getVillages(),
      getCollectionsForMonth(month, year),
      getCollectionsForDate(today),
      getAllCollections()
    ])

    const syncedVillages = await syncVillagesFromAccounts(accounts, villages)

    res.json({
      accounts,
      villages: syncedVillages,
      currentMonthCollections,
      todayPayments,
      allCollections
    })
  } catch (error) {
    res.status(500).json({ error: normalizeError(error, 'Failed to load bootstrap data.') })
  }
})

app.get('/api/accounts', async (_req, res) => {
  try {
    const accounts = await getAccounts()
    res.json({ data: accounts })
  } catch (error) {
    res.status(500).json({ error: normalizeError(error, 'Failed to fetch accounts.') })
  }
})

app.post('/api/accounts', async (req, res) => {
  try {
    const payload = req.body || {}
    const { data, error } = await supabaseAdmin.from('accounts').insert(payload).select('*').single()
    if (error) throw error
    res.status(201).json({ data })
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not add account.') })
  }
})

app.patch('/api/accounts/:id', async (req, res) => {
  const accountId = Number(req.params.id)
  if (!Number.isFinite(accountId)) {
    res.status(400).json({ error: 'Invalid account id.' })
    return
  }

  try {
    const payload = req.body || {}
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .update(payload)
      .eq('id', accountId)
      .select('id, village, phone, remarks, cif_number')

    if (error) throw error
    if (!data || data.length === 0) {
      res.status(404).json({ error: 'No account updated.' })
      return
    }

    res.json({ data: data[0] })
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not update account.') })
  }
})

app.delete('/api/accounts/:id', async (req, res) => {
  const accountId = Number(req.params.id)
  if (!Number.isFinite(accountId)) {
    res.status(400).json({ error: 'Invalid account id.' })
    return
  }

  try {
    const { error } = await supabaseAdmin.from('accounts').delete().eq('id', accountId)
    if (error) throw error
    res.status(204).send()
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not delete account.') })
  }
})

app.get('/api/villages', async (_req, res) => {
  try {
    const villages = await getVillages()
    res.json({ data: villages })
  } catch (error) {
    res.status(500).json({ error: normalizeError(error, 'Failed to fetch villages.') })
  }
})

app.post('/api/villages', async (req, res) => {
  const trimmedName = String(req.body?.village_name || '').trim()
  if (!trimmedName) {
    res.status(400).json({ error: 'Village name is required.' })
    return
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('villages')
      .insert({ village_name: trimmedName })
      .select('id, village_name')
      .single()

    if (error) throw error
    res.status(201).json({ data })
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not add village.') })
  }
})

app.patch('/api/villages/:id', async (req, res) => {
  const villageId = Number(req.params.id)
  if (!Number.isFinite(villageId)) {
    res.status(400).json({ error: 'Invalid village id.' })
    return
  }

  const trimmedName = String(req.body?.village_name || '').trim()
  if (!trimmedName) {
    res.status(400).json({ error: 'Village name is required.' })
    return
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('villages')
      .update({ village_name: trimmedName })
      .eq('id', villageId)
      .select('id, village_name')
      .single()

    if (error) throw error
    res.json({ data })
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not update village.') })
  }
})

app.delete('/api/villages/:id', async (req, res) => {
  const villageId = Number(req.params.id)
  if (!Number.isFinite(villageId)) {
    res.status(400).json({ error: 'Invalid village id.' })
    return
  }

  try {
    const { error } = await supabaseAdmin.from('villages').delete().eq('id', villageId)
    if (error) throw error
    res.status(204).send()
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not delete village.') })
  }
})

app.get('/api/emi-collections/monthly', async (req, res) => {
  const now = new Date()
  const month = toPositiveInt(req.query.month, now.getMonth() + 1)
  const year = toPositiveInt(req.query.year, now.getFullYear())

  try {
    const data = await getCollectionsForMonth(month, year)
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: normalizeError(error, 'Could not load monthly collections.') })
  }
})

app.get('/api/emi-collections/daily', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const dateIso = String(req.query.date || today)

  try {
    const data = await getCollectionsForDate(dateIso)
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: normalizeError(error, 'Could not load daily collections.') })
  }
})

app.get('/api/emi-collections/all', async (_req, res) => {
  try {
    const data = await getAllCollections()
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: normalizeError(error, 'Could not load collections.') })
  }
})

app.post('/api/emi-collections', async (req, res) => {
  try {
    const payload = req.body || {}
    const { data, error } = await supabaseAdmin.from('emi_collections').insert(payload).select('*').single()
    if (error) throw error
    res.status(201).json({ data })
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not create collection.') })
  }
})

app.post('/api/emi-collections/delete-by-ids', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
  if (ids.length === 0) {
    res.status(400).json({ error: 'No payment ids provided.' })
    return
  }

  try {
    const { data, error } = await supabaseAdmin.from('emi_collections').delete().in('id', ids).select('id')
    if (error) throw error
    res.json({ data: data || [] })
  } catch (error) {
    res.status(400).json({ error: normalizeError(error, 'Could not delete collections.') })
  }
})

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: normalizeError(error, 'Unexpected server error.') })
})

export default app
