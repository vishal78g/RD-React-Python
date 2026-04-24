import { useEffect, useMemo, useRef, useState } from 'react'
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
import LoginScreen from './components/LoginScreen'
import EmiDueListScreen from './components/EmiDueListScreen'
import SummaryScreen from './components/SummaryScreen'
import VillagesScreen from './components/VillagesScreen'
import { api, setApiAuthTokenProvider } from './lib/api'
import {
  getMonthsBetweenOpeningAndNextEmi,
  getOutstandingEmiMonths,
  getPaymentBreakdown,
  getPaymentTotals
} from './lib/utils'
import rdLogo from './public/images/rdLogo.png'

async function cacheImageInBrowser(imageUrl) {
  if (!imageUrl || typeof window === 'undefined' || !('caches' in window)) return

  const cache = await window.caches.open('rd-agent-static-v1')
  const alreadyCached = await cache.match(imageUrl)
  if (!alreadyCached) {
    await cache.add(imageUrl)
  }
}

const AUTH_STORAGE_KEY = 'rd_agent_auth'

const screens = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'emi', label: 'EMI' },
  { key: 'report', label: 'Report' },
  { key: 'summary', label: 'Summary' }
]

function App() {
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [authLoading, setAuthLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [showAccountsList, setShowAccountsList] = useState(false)
  const [accountsListType, setAccountsListType] = useState('active')
  const [showMonthlyPayments, setShowMonthlyPayments] = useState(false)
  const [showEmiDueList, setShowEmiDueList] = useState(false)
  const [showVillagesList, setShowVillagesList] = useState(false)
  const [focusedAccountId, setFocusedAccountId] = useState(null)
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
  const [allCollections, setAllCollections] = useState([])
  const [accounts, setAccounts] = useState([])
  const [villages, setVillages] = useState([])
  const [currentMonthCollections, setCurrentMonthCollections] = useState([])
  const [todayPayments, setTodayPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [villageSubmitting, setVillageSubmitting] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  const todayIso = today.toISOString().slice(0, 10)

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.active_status !== false),
    [accounts]
  )

  const closedAccounts = useMemo(
    () => accounts.filter((account) => account.active_status === false),
    [accounts]
  )

  const activeAccountIds = useMemo(
    () => new Set(activeAccounts.map((account) => account.id)),
    [activeAccounts]
  )

  const activeCurrentMonthCollections = useMemo(
    () => currentMonthCollections.filter((record) => activeAccountIds.has(record.account_id)),
    [currentMonthCollections, activeAccountIds]
  )

  const activeTodayPayments = useMemo(
    () => todayPayments.filter((payment) => activeAccountIds.has(payment.account_id)),
    [todayPayments, activeAccountIds]
  )

  const activeAllCollections = useMemo(
    () => allCollections.filter((payment) => activeAccountIds.has(payment.account_id)),
    [allCollections, activeAccountIds]
  )

  const activeReportMonthlyPayments = useMemo(() => {
    if (reportMonthlyPayments === null) return null
    return reportMonthlyPayments.filter((payment) => activeAccountIds.has(payment.account_id))
  }, [reportMonthlyPayments, activeAccountIds])

  const paidAccountIds = useMemo(
    () => new Set(activeCurrentMonthCollections.map((record) => record.account_id)),
    [activeCurrentMonthCollections]
  )

  const villagesWithCounts = useMemo(() => {
    const accountCountByVillage = accounts.reduce((map, account) => {
      const villageName = (account.village || '').trim()
      if (!villageName) return map

      map[villageName] = (map[villageName] || 0) + 1
      return map
    }, {})

    const villageByName = new Map()

    for (const village of villages) {
      const villageName = (village.village_name || '').trim()
      if (!villageName) continue

      villageByName.set(villageName, {
        ...village,
        village_name: villageName,
        accountsCount: accountCountByVillage[villageName] || 0
      })
    }

    for (const villageName of Object.keys(accountCountByVillage)) {
      if (!villageByName.has(villageName)) {
        villageByName.set(villageName, {
          id: null,
          village_name: villageName,
          accountsCount: accountCountByVillage[villageName],
          derivedFromAccounts: true
        })
      }
    }

    return Array.from(villageByName.values()).sort((a, b) =>
      a.village_name.localeCompare(b.village_name, undefined, { sensitivity: 'base' })
    )
  }, [accounts, villages])

  const dashboardData = useMemo(() => {
    const totalAccounts = activeAccounts.length
    const totalClosedAccounts = closedAccounts.length
    const totalAmountPaidTillNow = activeAccounts.reduce(
      (sum, account) => {
        const emiAmount = Number(account.emi_amount || 0)
        const paidMonths = getMonthsBetweenOpeningAndNextEmi(
          account.account_opening_date,
          account.next_emi_date
        )
        return sum + emiAmount * paidMonths
      },
      0
    )

    const totalEmiDue = activeAccounts.reduce((sum, account) => {
      const emiAmount = Number(account.emi_amount || 0)
      const paidThisMonth = paidAccountIds.has(account.id)

      const monthsDue = getOutstandingEmiMonths(account.next_emi_date, paidThisMonth)

      return sum + emiAmount * monthsDue
    }, 0)

    const totalCollectedToday = activeTodayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const totalCollectedTodayDue = activeTodayPayments.reduce(
      (sum, payment) => sum + getPaymentBreakdown(payment).dueAmount,
      0
    )
    const totalCollectedThisMonth = activeCurrentMonthCollections.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    )
    const totalCollectedThisMonthDue = activeCurrentMonthCollections.reduce(
      (sum, payment) => sum + getPaymentBreakdown(payment).dueAmount,
      0
    )
    const totalVillages = villagesWithCounts.length

    return {
      totalAccounts,
      totalClosedAccounts,
      totalAmountPaidTillNow,
      totalEmiDue,
      totalVillages,
      totalCollectedToday,
      totalCollectedTodayDue,
      totalCollectedThisMonth,
      totalCollectedThisMonthDue
    }
  }, [
    activeAccounts,
    activeCurrentMonthCollections,
    activeTodayPayments,
    closedAccounts,
    paidAccountIds,
    villagesWithCounts
  ])

  // Ref to always access latest overlay state inside popstate handler
  const overlayStateRef = useRef({})
  overlayStateRef.current = { showVillagesList, showMonthlyPayments, showEmiDueList, showAccountsList }

  // Intercept browser back button so it closes overlays instead of leaving the app
  useEffect(() => {
    history.replaceState({ page: 'app' }, '')

    function handlePopState() {
      // Re-push a state so repeated back presses stay within the app
      history.pushState({ page: 'app' }, '')

      const { showVillagesList, showMonthlyPayments, showEmiDueList, showAccountsList } =
        overlayStateRef.current

      if (showVillagesList) {
        setShowVillagesList(false)
      } else if (showMonthlyPayments) {
        setShowMonthlyPayments(false)
      } else if (showEmiDueList) {
        setShowEmiDueList(false)
      } else if (showAccountsList) {
        setShowAccountsList(false)
        setAccountsListType('active')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    cacheImageInBrowser(rdLogo).catch(() => {
      // Best-effort cache warmup only.
    })
  }, [])

  useEffect(() => {
    setApiAuthTokenProvider(() => accessToken)
  }, [accessToken])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!raw) {
        setAuthLoading(false)
        return
      }

      const parsed = JSON.parse(raw)
      const token = String(parsed?.token || '')
      const expiresAt = Number(parsed?.expiresAt || 0)

      if (!token || !expiresAt || expiresAt <= Date.now()) {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        setAuthLoading(false)
        return
      }

      setAccessToken(token)
      setIsAuthenticated(true)
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } finally {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData()
    }
  }, [isAuthenticated])

  async function handleLogin(pin) {
    setAuthError('')
    setAuthSubmitting(true)

    try {
      const session = await api.loginWithPin(pin)
      const token = String(session?.token || '')
      const expiresAt = Number(session?.expiresAt || 0)

      if (!token) {
        throw new Error('No access token returned from login.')
      }

      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          token,
          expiresAt
        })
      )

      setAccessToken(token)
      setIsAuthenticated(true)
      setActiveScreen('dashboard')
    } catch (loginError) {
      setAuthError(loginError.message || 'Login failed.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  async function loadInitialData() {
    setLoading(true)
    setError('')

    try {
      const data = await api.getBootstrap({
        month: currentMonth,
        year: currentYear,
        today: todayIso
      })

      setAccounts(data.accounts || [])
      setVillages(data.villages || [])
      setCurrentMonthCollections(data.currentMonthCollections || [])
      setTodayPayments(data.todayPayments || [])
      setAllCollections(data.allCollections || [])
    } catch (loadError) {
      const errorMessage = String(loadError.message || '')
      if (errorMessage.toLowerCase().includes('unauthorized')) {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        setAccessToken('')
        setIsAuthenticated(false)
        setAuthError('Session expired. Please login again.')
        setError('')
        return
      }

      setError(loadError.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAccount(payload) {
    setSubmitting(true)
    setError('')

    try {
      const data = await api.addAccount(payload)

      setAccounts((prev) => [data, ...prev])
      setActiveScreen('dashboard')
    } catch (insertError) {
      setError(insertError.message || 'Could not add account.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddVillage(villageName) {
    const trimmedName = (villageName || '').trim()
    if (!trimmedName) {
      setError('Village name is required.')
      return false
    }

    setVillageSubmitting(true)
    setError('')

    try {
      const data = await api.addVillage(trimmedName)

      setVillages((prev) => [...prev, data])
      return true
    } catch (insertError) {
      setError(insertError.message || 'Could not add village.')
      return false
    } finally {
      setVillageSubmitting(false)
    }
  }

  async function handleUpdateVillage(villageId, currentName, nextName) {
    const trimmedName = (nextName || '').trim()
    if (!trimmedName) {
      setError('Village name is required.')
      return false
    }

    if (trimmedName === currentName) {
      return true
    }

    setVillageSubmitting(true)
    setError('')

    try {
      const updatedVillage = await api.updateVillage(villageId, trimmedName)

      setVillages((prev) =>
        prev.map((village) => (village.id === villageId ? updatedVillage : village))
      )

      // Reflect FK cascade rename immediately in UI.
      setAccounts((prev) =>
        prev.map((account) =>
          account.village === currentName ? { ...account, village: updatedVillage.village_name } : account
        )
      )

      return true
    } catch (updateError) {
      setError(updateError.message || 'Could not update village.')
      return false
    } finally {
      setVillageSubmitting(false)
    }
  }

  async function handleDeleteVillage(village) {
    const villageName = village?.village_name || ''
    if (!village || !village.id) {
      setError('Invalid village selected.')
      return false
    }

    if (villageName === '') {
      setError('Default blank village cannot be deleted.')
      return false
    }

    const linkedAccountsCount = accounts.filter((account) => (account.village || '') === villageName).length
    if (linkedAccountsCount > 0) {
      setError('Cannot delete village because linked accounts exist.')
      return false
    }

    setVillageSubmitting(true)
    setError('')

    try {
      await api.deleteVillage(village.id)

      setVillages((prev) => prev.filter((item) => item.id !== village.id))
      return true
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete village.')
      return false
    } finally {
      setVillageSubmitting(false)
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
      const updatedRow = await api.updateAccount(editingAccount.id, pendingUpdatePayload)

      // Update the local state with the new payload
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === editingAccount.id
            ? {
                ...acc,
                village: updatedRow.village,
                phone: updatedRow.phone,
                remarks: updatedRow.remarks,
                cif_number: updatedRow.cif_number
              }
            : acc
        )
      )
      setFocusedAccountId(editingAccount.id)
      setEditingAccount(null)
      setShowEditModal(false)
      setShowUpdateConfirm(false)
      setPendingUpdatePayload(null)
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
      await api.deleteAccount(deleteConfirmAccount.id)

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

  async function handleConfirmMarkPaid(paymentDetails) {
    if (!markPaidAccount) return

    const quantity = Number(paymentDetails?.quantity || 0)
    const selectedMonths = Array.isArray(paymentDetails?.selectedMonths)
      ? paymentDetails.selectedMonths
      : []
    const paymentMode = paymentDetails?.paymentMode === 'ONLINE' ? 'ONLINE' : 'CASH'

    if (quantity < 1) {
      setError('Please select at least one month.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const { dueAmount, totalAmount } = getPaymentTotals({
        emiAmount: markPaidAccount.emi_amount,
        nextEmiDate: markPaidAccount.next_emi_date,
        quantity
      })

      // Insert ONE record with emis_paid count and total amount
      await api.addCollection({
        account_id: markPaidAccount.id,
        amount: totalAmount,
        emis_paid: quantity,
        payment_mode: paymentMode,
        payment_date: todayIso,
        month: currentMonth,
        year: currentYear
      })

      // Reload data to reflect changes
      const [monthData, todayData] = await Promise.all([
        api.getMonthlyCollections(currentMonth, currentYear),
        api.getDailyCollections(todayIso)
      ])

      setCurrentMonthCollections(monthData || [])
      setTodayPayments(todayData || [])

      // Show confirmation modal
      setLastPaymentConfirm({
        account: markPaidAccount,
        quantity,
        paymentMode,
        selectedMonths,
        dueAmount,
        totalAmount
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
      const deletedRows = await api.deleteCollectionsByIds(paymentIdsToDelete)

      const deletedIds = new Set((deletedRows || []).map((row) => row.id))
      if (deletedIds.size === 0) {
        throw new Error('Undo failed: no rows were deleted in database.')
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
      const data = await api.getMonthlyCollections(month, year)
      setReportMonthlyPayments(data || [])
    } catch (fetchError) {
      setError(fetchError.message || 'Could not load monthly payments.')
    } finally {
      setReportMonthlyLoading(false)
    }
  }

  function handleStartEdit(account) {
    setFocusedAccountId(account.id)
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
    setFocusedAccountId(null)
    setAccountsListType('active')
    setShowAccountsList(true)
  }

  function handleViewClosedAccounts() {
    setFocusedAccountId(null)
    setAccountsListType('closed')
    setShowAccountsList(true)
  }

  function handleCloseAccountsList() {
    setShowAccountsList(false)
    setAccountsListType('active')
  }

  function handleViewMonthlyPayments() {
    setShowMonthlyPayments(true)
  }

  function handleCloseMonthlyPayments() {
    setShowMonthlyPayments(false)
  }

  function handleViewEmiDueList() {
    setShowEmiDueList(true)
  }

  function handleCloseEmiDueList() {
    setShowEmiDueList(false)
  }

  function handleViewVillages() {
    setShowVillagesList(true)
  }

  function handleCloseVillages() {
    setShowVillagesList(false)
  }

  function renderScreen() {
    if (showVillagesList) {
      return (
        <VillagesScreen
          villages={villagesWithCounts}
          submitting={villageSubmitting}
          onAddVillage={handleAddVillage}
          onUpdateVillage={handleUpdateVillage}
          onDeleteVillage={handleDeleteVillage}
          onClose={handleCloseVillages}
        />
      )
    }

    if (showMonthlyPayments) {
      return (
        <MonthlyPaymentsScreen
          payments={activeCurrentMonthCollections}
          month={currentMonth}
          year={currentYear}
          onClose={handleCloseMonthlyPayments}
        />
      )
    }

    if (showEmiDueList) {
      return (
        <EmiDueListScreen
          accounts={activeAccounts}
          paidAccountIds={paidAccountIds}
          onClose={handleCloseEmiDueList}
        />
      )
    }

    if (showAccountsList) {
      return (
        <AccountsListScreen
          accounts={accountsListType === 'closed' ? closedAccounts : activeAccounts}
          title={accountsListType === 'closed' ? 'Closed Accounts' : 'All Active Accounts'}
          showActions={true}
          focusedAccountId={focusedAccountId}
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
          onViewClosedAccounts={handleViewClosedAccounts}
          onViewMonthlyPayments={handleViewMonthlyPayments}
          onViewEmiDueList={handleViewEmiDueList}
          onViewVillages={handleViewVillages}
        />
      )
    }

    if (activeScreen === 'emi') {
      return (
        <EmiCollectionScreen
          accounts={activeAccounts}
          paidAccountIds={paidAccountIds}
          onMarkPaidClick={handleMarkPaidClick}
          onEditAccount={handleStartEdit}
        />
      )
    }

    if (activeScreen === 'summary') {
      return (
        <SummaryScreen
          accounts={activeAccounts}
          closedAccountsCount={closedAccounts.length}
          currentMonthCollections={activeCurrentMonthCollections}
          todayPayments={activeTodayPayments}
          allCollections={activeAllCollections}
          paidAccountIds={paidAccountIds}
        />
      )
    }

    return (
      <DailyReportScreen
        payments={activeTodayPayments}
        onUndoPayment={handleUndoPayment}
        currentMonthPayments={activeCurrentMonthCollections}
        currentMonth={currentMonth}
        currentYear={currentYear}
        reportMonthlyPayments={activeReportMonthlyPayments}
        reportMonthlyLoading={reportMonthlyLoading}
        onFetchMonthlyPayments={fetchReportMonthlyPayments}
      />
    )
  }

  if (authLoading) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p className="state-text">Checking login...</p>
        </main>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <LoginScreen onLogin={handleLogin} authError={authError} submitting={authSubmitting} />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title-row">
          <h1>RD Agent Assistant</h1>
          <img src={rdLogo} alt="RD Agent logo" className="header-logo" />
        </div>
      </header>

      <main className="app-main">
        {loading ? <p className="state-text">Loading...</p> : renderScreen()}
        {error ? <p className="error-text">⚠ {error}</p> : null}
      </main>

      {showEditModal && editingAccount && (
        <EditAccountModalScreen
          account={editingAccount}
          villages={villages}
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
          paymentMode={lastPaymentConfirm.paymentMode}
          selectedMonths={lastPaymentConfirm.selectedMonths}
          dueAmount={lastPaymentConfirm.dueAmount}
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

      {!showAccountsList && !showMonthlyPayments && !showEmiDueList && !showVillagesList && !showEditModal && !deleteConfirmAccount && !markPaidAccount && !lastPaymentConfirm && !undoPaymentGroup && (
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
