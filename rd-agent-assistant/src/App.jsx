import { useEffect, useMemo, useState } from 'react'
import DashboardScreen from './components/DashboardScreen'
import DailyReportScreen from './components/DailyReportScreen'
import EmiCollectionScreen from './components/EmiCollectionScreen'
import AccountsListScreen from './components/AccountsListScreen'
import EditAccountModalScreen from './components/EditAccountModalScreen'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import UndoPaymentModal from './components/UndoPaymentModal'
import MonthlyPaymentsScreen from './components/MonthlyPaymentsScreen'
import MarkPaidModal from './components/MarkPaidModal'
import PaymentConfirmationModal from './components/PaymentConfirmationModal'
import { supabase } from './lib/supabase'

const screens = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'emi', label: 'EMI' },
  { key: 'report', label: 'Report' }
]

function App() {
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [showAccountsList, setShowAccountsList] = useState(false)
  const [showMonthlyPayments, setShowMonthlyPayments] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false)
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState(null)
  const [pendingUpdatePayload, setPendingUpdatePayload] = useState(null)
  const [markPaidAccount, setMarkPaidAccount] = useState(null)
  const [lastPaymentConfirm, setLastPaymentConfirm] = useState(null)
  const [undoPaymentGroup, setUndoPaymentGroup] = useState(null)
  const [reportMonthlyPayments, setReportMonthlyPayments] = useState(null)
  const [reportMonthlyLoading, setReportMonthlyLoading] = useState(false)
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
          .select('id, account_id, amount, emis_paid, payment_date, month, year, accounts(name, village)')
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .order('payment_date', { ascending: false }),
        supabase
          .from('emi_collections')
          .select('id, account_id, amount, emis_paid, payment_date, accounts(name, village, phone)')
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

  async function handleUpdateAccountSubmit(payload) {
    // Store the payload and show confirmation
    setPendingUpdatePayload(payload)
    setShowUpdateConfirm(true)
  }

  async function handleConfirmUpdate() {
    if (!editingAccount || !pendingUpdatePayload) return

    setSubmitting(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('accounts')
        .update(pendingUpdatePayload)
        .eq('id', editingAccount.id)

      if (updateError) throw updateError

      // Update the local state with the new payload
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === editingAccount.id ? { ...acc, ...pendingUpdatePayload } : acc
        )
      )
      setEditingAccount(null)
      setShowEditModal(false)
      setShowUpdateConfirm(false)
      setPendingUpdatePayload(null)
      setShowAccountsList(false)
    } catch (updateError) {
      setError(updateError.message || 'Could not update account.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmAccount) return

    setError('')

    try {
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('id', deleteConfirmAccount.id)

      if (deleteError) throw deleteError

      setAccounts((prev) => prev.filter((acc) => acc.id !== deleteConfirmAccount.id))
      setCurrentMonthCollections((prev) =>
        prev.filter((col) => col.account_id !== deleteConfirmAccount.id)
      )
      setTodayPayments((prev) => prev.filter((pay) => pay.account_id !== deleteConfirmAccount.id))
      setDeleteConfirmAccount(null)
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete account.')
      setDeleteConfirmAccount(null)
    }
  }

  function handleMarkPaidClick(account) {
    if (paidAccountIds.has(account.id)) return
    setMarkPaidAccount(account)
  }

  async function handleConfirmMarkPaid(quantity) {
    if (!markPaidAccount) return

    setSubmitting(true)
    setError('')

    try {
      const emiAmount = Number(markPaidAccount.emi_amount)
      const totalAmount = emiAmount * quantity

      // Insert ONE record with emis_paid count and total amount
      const { error: insertError } = await supabase
        .from('emi_collections')
        .insert({
          account_id: markPaidAccount.id,
          amount: totalAmount,
          emis_paid: quantity,
          payment_date: todayIso,
          month: currentMonth,
          year: currentYear
        })

      if (insertError) throw insertError

      // Reload data to reflect changes
      const [monthRes, todayRes] = await Promise.all([
        supabase
          .from('emi_collections')
          .select('id, account_id, amount, emis_paid, payment_date, month, year, accounts(name, village)')
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .order('payment_date', { ascending: false }),
        supabase
          .from('emi_collections')
          .select('id, account_id, amount, emis_paid, payment_date, accounts(name, village, phone)')
          .eq('payment_date', todayIso)
      ])

      if (monthRes.error) throw monthRes.error
      if (todayRes.error) throw todayRes.error

      setCurrentMonthCollections(monthRes.data || [])
      setTodayPayments(todayRes.data || [])

      // Show confirmation modal
      setLastPaymentConfirm({
        account: markPaidAccount,
        quantity,
        totalAmount: emiAmount * quantity
      })
      setMarkPaidAccount(null)
    } catch (paymentError) {
      setError(paymentError.message || 'Could not mark EMI as paid.')
      setMarkPaidAccount(null)
    } finally {
      setSubmitting(false)
    }
  }

  function handleClosePaymentConfirm() {
    setLastPaymentConfirm(null)
  }

  function handleUndoPayment(paymentGroup) {
    setUndoPaymentGroup(paymentGroup)
  }

  async function handleConfirmUndo() {
    if (!undoPaymentGroup) return

    setError('')

    try {
      const paymentIdsToDelete = (undoPaymentGroup.payments || [])
        .filter((payment) => payment.payment_date === todayIso)
        .map((payment) => payment.id)

      if (paymentIdsToDelete.length === 0) {
        throw new Error('No today payments found to undo.')
      }

      // Delete exact payment records for today and verify deleted rows
      const { data: deletedRows, error: deleteError } = await supabase
        .from('emi_collections')
        .delete()
        .in('id', paymentIdsToDelete)
        .select('id')

      if (deleteError) throw deleteError

      const deletedIds = new Set((deletedRows || []).map((row) => row.id))
      if (deletedIds.size === 0) {
        throw new Error('Undo failed: no rows were deleted in database. Check RLS delete policy and filters.')
      }

      // Update today's payments
      setTodayPayments((prev) =>
        prev.filter((payment) => !deletedIds.has(payment.id))
      )

      // Update month's collections
      setCurrentMonthCollections((prev) =>
        prev.filter((payment) => !deletedIds.has(payment.id))
      )

      // Update fetched monthly report cache if it exists
      setReportMonthlyPayments((prev) =>
        prev ? prev.filter((payment) => !deletedIds.has(payment.id)) : prev
      )

      setUndoPaymentGroup(null)
    } catch (deleteError) {
      setError(deleteError.message || 'Could not undo payment.')
      setUndoPaymentGroup(null)
    }
  }

  function handleCancelUndo() {
    setUndoPaymentGroup(null)
  }

  async function fetchReportMonthlyPayments(month, year) {
    setReportMonthlyLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('emi_collections')
        .select('id, account_id, amount, emis_paid, payment_date, month, year, accounts(name, village)')
        .eq('month', month)
        .eq('year', year)
        .order('payment_date', { ascending: false })
      if (fetchError) throw fetchError
      setReportMonthlyPayments(data || [])
    } catch (fetchError) {
      setError(fetchError.message || 'Could not load monthly payments.')
    } finally {
      setReportMonthlyLoading(false)
    }
  }

  function handleStartEdit(account) {
    setEditingAccount(account)
    setShowEditModal(true)
  }

  function handleCancelEdit() {
    setEditingAccount(null)
    setShowEditModal(false)
    setShowUpdateConfirm(false)
    setPendingUpdatePayload(null)
  }

  function handleStartDelete(account) {
    setDeleteConfirmAccount(account)
  }

  function handleCancelDelete() {
    setDeleteConfirmAccount(null)
  }

  function handleViewAccounts() {
    setShowAccountsList(true)
  }

  function handleCloseAccountsList() {
    setShowAccountsList(false)
  }

  function handleViewMonthlyPayments() {
    setShowMonthlyPayments(true)
  }

  function handleCloseMonthlyPayments() {
    setShowMonthlyPayments(false)
  }

  function renderScreen() {
    if (showMonthlyPayments) {
      return (
        <MonthlyPaymentsScreen
          payments={currentMonthCollections}
          month={currentMonth}
          year={currentYear}
          onClose={handleCloseMonthlyPayments}
        />
      )
    }

    if (showAccountsList) {
      return (
        <AccountsListScreen
          accounts={accounts}
          onEdit={handleStartEdit}
          onDelete={handleStartDelete}
          onClose={handleCloseAccountsList}
        />
      )
    }

    if (activeScreen === 'dashboard') {
      return (
        <DashboardScreen
          {...dashboardData}
          onViewAccounts={handleViewAccounts}
          onViewMonthlyPayments={handleViewMonthlyPayments}
        />
      )
    }

    if (activeScreen === 'emi') {
      return (
        <EmiCollectionScreen
          accounts={accounts}
          paidAccountIds={paidAccountIds}
          onMarkPaidClick={handleMarkPaidClick}
        />
      )
    }

    return (
      <DailyReportScreen
        payments={todayPayments}
        onUndoPayment={handleUndoPayment}
        currentMonthPayments={currentMonthCollections}
        currentMonth={currentMonth}
        currentYear={currentYear}
        reportMonthlyPayments={reportMonthlyPayments}
        reportMonthlyLoading={reportMonthlyLoading}
        onFetchMonthlyPayments={fetchReportMonthlyPayments}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>RD Agent Assistant</h1>
      </header>

      <main className="app-main">
        {loading ? <p className="state-text">Loading...</p> : renderScreen()}
        {error ? <p className="error-text">⚠ {error}</p> : null}
      </main>

      {showEditModal && editingAccount && (
        <EditAccountModalScreen
          account={editingAccount}
          onSave={handleUpdateAccountSubmit}
          onCancel={handleCancelEdit}
          submitting={submitting}
          showConfirm={showUpdateConfirm}
          onConfirmUpdate={handleConfirmUpdate}
        />
      )}

      {deleteConfirmAccount && (
        <DeleteConfirmModal
          accountName={deleteConfirmAccount.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {markPaidAccount && (
        <MarkPaidModal
          account={markPaidAccount}
          onConfirm={handleConfirmMarkPaid}
          onCancel={() => setMarkPaidAccount(null)}
          submitting={submitting}
        />
      )}

      {lastPaymentConfirm && (
        <PaymentConfirmationModal
          account={lastPaymentConfirm.account}
          quantity={lastPaymentConfirm.quantity}
          totalAmount={lastPaymentConfirm.totalAmount}
          onClose={handleClosePaymentConfirm}
        />
      )}

      {undoPaymentGroup && (
        <UndoPaymentModal
          accountName={undoPaymentGroup.accountName}
          paymentAmount={undoPaymentGroup.totalAmount}
          emisPaid={undoPaymentGroup.emisPaid}
          onConfirm={handleConfirmUndo}
          onCancel={handleCancelUndo}
        />
      )}

      {!showAccountsList && !showMonthlyPayments && !showEditModal && !deleteConfirmAccount && !markPaidAccount && !lastPaymentConfirm && !undoPaymentGroup && (
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
      )}
    </div>
  )
}

export default App
