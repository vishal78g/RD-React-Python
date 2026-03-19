import { useEffect, useMemo, useState } from 'react'
import AddAccountScreen from './components/AddAccountScreen'
import DashboardScreen from './components/DashboardScreen'
import DailyReportScreen from './components/DailyReportScreen'
import EmiCollectionScreen from './components/EmiCollectionScreen'
import { supabase } from './lib/supabase'

const screens = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'add-account', label: 'Add Account' },
  { key: 'emi', label: 'EMI' },
  { key: 'report', label: 'Report' }
]

function App() {
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [accounts, setAccounts] = useState([])
  const [currentMonthCollections, setCurrentMonthCollections] = useState([])
  const [todayPayments, setTodayPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  const todayIso = today.toISOString().slice(0, 10)

  const paidAccountIds = useMemo(
    () => new Set(currentMonthCollections.map((record) => record.account_id)),
    [currentMonthCollections]
  )

  const dashboardData = useMemo(() => {
    const totalAccounts = accounts.length
    const totalEmiDue = accounts.reduce((sum, account) => sum + Number(account.emi_amount || 0), 0)
    const totalCollectedToday = todayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const totalCollectedThisMonth = currentMonthCollections.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    )

    return { totalAccounts, totalEmiDue, totalCollectedToday, totalCollectedThisMonth }
  }, [accounts, todayPayments, currentMonthCollections])

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoading(true)
    setError('')

    try {
      const [accountsRes, monthRes, todayRes] = await Promise.all([
        supabase.from('accounts').select('*').order('created_at', { ascending: false }),
        supabase
          .from('emi_collections')
          .select('id, account_id, amount, payment_date, month, year')
          .eq('month', currentMonth)
          .eq('year', currentYear),
        supabase
          .from('emi_collections')
          .select('id, account_id, amount, payment_date, accounts(name, village, phone)')
          .eq('payment_date', todayIso)
      ])

      if (accountsRes.error) throw accountsRes.error
      if (monthRes.error) throw monthRes.error
      if (todayRes.error) throw todayRes.error

      setAccounts(accountsRes.data || [])
      setCurrentMonthCollections(monthRes.data || [])
      setTodayPayments(todayRes.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAccount(payload) {
    setSubmitting(true)
    setError('')

    try {
      const { data, error: insertError } = await supabase
        .from('accounts')
        .insert(payload)
        .select('*')
        .single()

      if (insertError) throw insertError

      setAccounts((prev) => [data, ...prev])
      setActiveScreen('dashboard')
    } catch (insertError) {
      setError(insertError.message || 'Could not add account.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkPaid(account) {
    if (paidAccountIds.has(account.id)) return

    setError('')
    const payload = {
      account_id: account.id,
      amount: Number(account.emi_amount),
      payment_date: todayIso,
      month: currentMonth,
      year: currentYear
    }

    try {
      const { data, error: insertError } = await supabase
        .from('emi_collections')
        .insert(payload)
        .select('id, account_id, amount, payment_date, month, year')
        .single()

      if (insertError) throw insertError

      setCurrentMonthCollections((prev) => [data, ...prev])
      setTodayPayments((prev) => [
        {
          ...data,
          accounts: {
            name: account.name,
            village: account.village,
            phone: account.phone || ''
          }
        },
        ...prev
      ])
    } catch (paymentError) {
      setError(paymentError.message || 'Could not mark EMI as paid.')
    }
  }

  function renderScreen() {
    if (activeScreen === 'dashboard') {
      return <DashboardScreen {...dashboardData} />
    }

    if (activeScreen === 'add-account') {
      return <AddAccountScreen onAddAccount={handleAddAccount} submitting={submitting} />
    }

    if (activeScreen === 'emi') {
      return (
        <EmiCollectionScreen
          accounts={accounts}
          paidAccountIds={paidAccountIds}
          onMarkPaid={handleMarkPaid}
        />
      )
    }

    return <DailyReportScreen payments={todayPayments} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>RD Agent Assistant</h1>
      </header>

      <main className="app-main">
        {loading ? <p className="state-text">Loading...</p> : renderScreen()}
        {error ? <p className="error-text">{error}</p> : null}
      </main>

      <nav className="bottom-nav">
        {screens.map((screen) => (
          <button
            key={screen.key}
            className={`nav-btn ${activeScreen === screen.key ? 'active' : ''}`}
            onClick={() => setActiveScreen(screen.key)}
          >
            {screen.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
