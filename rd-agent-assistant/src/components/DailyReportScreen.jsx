import { useMemo, useState } from 'react'
import { formatDateLong, getPaymentBreakdown } from '../lib/utils'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

function groupByAccount(payments) {
  const grouped = {}
  payments.forEach((payment) => {
    const accountId = payment.account_id
    if (!grouped[accountId]) {
      grouped[accountId] = {
        accountId,
        accountName: payment.accounts?.name || 'Unknown',
        village: payment.accounts?.village || '-',
        emisPaid: 0,
        totalAmount: 0,
        dueAmount: 0,
        payments: []
      }
    }
    const paymentBreakdown = getPaymentBreakdown(payment)
    grouped[accountId].emisPaid += Number(payment.emis_paid || 1)
    grouped[accountId].totalAmount += paymentBreakdown.totalAmount
    grouped[accountId].dueAmount += paymentBreakdown.dueAmount
    grouped[accountId].payments.push(payment)
  })
  return Object.values(grouped)
}

function getMonthChipsForPayment(payment) {
  const nextEmiDateRaw = payment?.accounts?.next_emi_date
  const nextEmiDate = new Date(nextEmiDateRaw)
  if (Number.isNaN(nextEmiDate.getTime())) return []

  const emisPaid = Math.max(1, Number(payment?.emis_paid || 1))
  const start = new Date(nextEmiDate.getFullYear(), nextEmiDate.getMonth(), 1)

  return Array.from({ length: emisPaid }).map((_, index) => {
    const monthDate = new Date(start)
    monthDate.setMonth(start.getMonth() + index)

    const month = monthDate.getMonth() + 1
    const year = monthDate.getFullYear()
    const label = monthDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()

    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      label,
      year
    }
  })
}

function getGroupMonthChips(payments) {
  const chipsByKey = new Map()

  ;(payments || []).forEach((payment) => {
    getMonthChipsForPayment(payment).forEach((chip) => {
      chipsByKey.set(chip.key, chip)
    })
  })

  return Array.from(chipsByKey.values()).sort((a, b) => a.key.localeCompare(b.key))
}

function DailyReportScreen({
  payments,
  onUndoPayment,
  currentMonthPayments,
  currentMonth,
  currentYear,
  reportMonthlyPayments,
  reportMonthlyLoading,
  onFetchMonthlyPayments
}) {
  const [activeTab, setActiveTab] = useState('today')
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const [pickerMonth, setPickerMonth] = useState(currentMonth)
  const [pickerYear, setPickerYear] = useState(currentYear)

  // Build a range of years: 3 years back up to current year
  const years = []
  for (let y = currentYear; y >= currentYear - 3; y--) years.push(y)

  function handleMonthChange(month, year) {
    setPickerMonth(month)
    setPickerYear(year)
    onFetchMonthlyPayments(month, year)
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (tab === 'monthly' && reportMonthlyPayments === null) {
      // pre-populate with current month on first open
      onFetchMonthlyPayments(currentMonth, currentYear)
    }
  }

  // --- Today tab ---
  const groupedToday = useMemo(() => groupByAccount(payments), [payments])
  const totalToday = groupedToday.reduce((sum, g) => sum + g.totalAmount, 0)
  const todayCashTotal = payments.reduce(
    (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'CASH') ? Number(payment.amount || 0) : 0),
    0
  )
  const todayOnlineTotal = payments.reduce(
    (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'ONLINE') ? Number(payment.amount || 0) : 0),
    0
  )

  // --- Monthly tab ---
  // While reportMonthlyPayments is null (not yet fetched), show currentMonthPayments
  // when the picker is still on the current month
  const isCurrentMonthSelected = pickerMonth === currentMonth && pickerYear === currentYear
  const monthlySource =
    reportMonthlyPayments !== null
      ? reportMonthlyPayments
      : isCurrentMonthSelected
      ? currentMonthPayments
      : []

  // Group monthly payments by account for undo support
  const groupedMonthly = useMemo(() => groupByAccount(monthlySource), [monthlySource])
  const totalMonthly = groupedMonthly.reduce((sum, g) => sum + g.totalAmount, 0)
  const monthlyCashTotal = monthlySource.reduce(
    (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'CASH') ? Number(payment.amount || 0) : 0),
    0
  )
  const monthlyOnlineTotal = monthlySource.reduce(
    (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'ONLINE') ? Number(payment.amount || 0) : 0),
    0
  )

  const selectedMonthLabel = `${MONTHS[pickerMonth - 1]} ${pickerYear}`

  return (
    <section>
      <h2 className="screen-title">Reports</h2>

      {/* Tab switcher */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => handleTabChange('today')}
        >
          Today
        </button>
        <button
          className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => handleTabChange('monthly')}
        >
          Monthly
        </button>
      </div>

      {/* ── TODAY TAB ── */}
      {activeTab === 'today' && (
        <>
          <article className="metric-card total-card">
            <p className="metric-label">Total Collected Today</p>
            <h3 className="metric-value">₹ {totalToday.toFixed(2)}</h3>
            <p className="metric-note">Cash: ₹ {todayCashTotal.toFixed(2)}</p>
            <p className="metric-note">Online: ₹ {todayOnlineTotal.toFixed(2)}</p>
          </article>

          <div className="list-stack">
            {groupedToday.map((group) => (
              <article className="card payment-group-card" key={group.accountId}>
                <div className="payment-group-header">
                  <div>
                    <h3>{group.accountName}</h3>
                    <p className="muted">Village: {group.village}</p>
                  </div>
                  {group.emisPaid > 1 && (
                    <span className="payment-count-badge" title={`${group.emisPaid} EMIs paid`}>
                      {group.emisPaid}
                    </span>
                  )}
                </div>
                <p className="amount">₹ {group.totalAmount.toFixed(2)}</p>
                {getGroupMonthChips(group.payments).length > 0 ? (
                  <div className="report-month-chips">
                    {getGroupMonthChips(group.payments).map((chip) => (
                      <span className="report-month-chip" key={chip.key} title={`${chip.label} ${chip.year}`}>
                        {chip.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="account-actions">
                  <button className="btn btn-secondary" onClick={() => onUndoPayment(group)}>
                    Undo Payment
                  </button>
                </div>
              </article>
            ))}
          </div>

          {groupedToday.length === 0 && (
            <p className="empty">No payments collected today.</p>
          )}
        </>
      )}

      {/* ── MONTHLY TAB ── */}
      {activeTab === 'monthly' && (
        <>
          {/* Month / Year picker */}
          <div className="card month-picker-card">
            <div className="month-picker-row">
              <label className="input-label">
                Month
                <select
                  className="input"
                  value={pickerMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value), pickerYear)}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </label>

              <label className="input-label">
                Year
                <select
                  className="input"
                  value={pickerYear}
                  onChange={(e) => handleMonthChange(pickerMonth, Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {reportMonthlyLoading ? (
            <p className="state-text">Loading…</p>
          ) : (
            <>
              <article className="metric-card total-card">
                <p className="metric-label">Total Collected — {selectedMonthLabel}</p>
                <h3 className="metric-value">₹ {totalMonthly.toFixed(2)}</h3>
                <p className="metric-note">Cash: ₹ {monthlyCashTotal.toFixed(2)}</p>
                <p className="metric-note">Online: ₹ {monthlyOnlineTotal.toFixed(2)}</p>
              </article>

              <div className="list-stack">
                {groupedMonthly.map((group) => {
                  const canUndo = isCurrentMonthSelected
                  const monthChips = getGroupMonthChips(group.payments)
                  return (
                    <article className="card payment-group-card" key={group.accountId}>
                      <div className="payment-group-header">
                        <div>
                          <h3>{group.accountName}</h3>
                          <p className="muted">Village: {group.village}</p>
                        </div>
                        {group.emisPaid > 1 && (
                          <span
                            className="payment-count-badge"
                            title={`${group.emisPaid} EMIs paid`}
                          >
                            {group.emisPaid}
                          </span>
                        )}
                      </div>
                      <div className="detail-row">
                        <span className="label">Date:</span>
                        <span>{formatDateLong(group.payments[0]?.payment_date)}</span>
                      </div>
                      <p className="amount">₹ {group.totalAmount.toFixed(2)}</p>
                      {monthChips.length > 0 ? (
                        <div className="report-month-chips">
                          {monthChips.map((chip) => (
                            <span className="report-month-chip" key={chip.key} title={`${chip.label} ${chip.year}`}>
                              {chip.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {canUndo && (
                        <div className="account-actions">
                          <button
                            className="btn btn-secondary"
                            onClick={() => onUndoPayment(group)}
                          >
                            Undo Payment
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>

              {groupedMonthly.length === 0 && (
                <p className="empty">No payments for {selectedMonthLabel}.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

export default DailyReportScreen
