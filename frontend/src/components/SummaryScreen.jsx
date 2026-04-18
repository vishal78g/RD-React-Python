import { useMemo, useState } from 'react'
import { getEmiStatus, getPaymentBreakdown } from '../lib/utils'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount || 0))
}

function PieChart({ segments }) {
  const total = segments.reduce((sum, s) => sum + Number(s.value || 0), 0)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="summary-pie-wrap">
      <svg viewBox="0 0 140 140" className="summary-pie">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="16" />
        {total > 0 &&
          segments.map((segment) => {
            const value = Number(segment.value || 0)
            const fraction = value / total
            const segmentLength = fraction * circumference
            const dashArray = `${segmentLength} ${circumference - segmentLength}`
            const circle = (
              <circle
                key={segment.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="16"
                strokeDasharray={dashArray}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                strokeLinecap="butt"
              />
            )
            offset += segmentLength
            return circle
          })}
      </svg>
      <div className="summary-chart-legend">
        {segments.map((segment) => (
          <div className="summary-legend-row" key={segment.label}>
            <span className="summary-legend-dot" style={{ backgroundColor: segment.color }} />
            <span>{segment.label}</span>
            <strong>{segment.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ items, maxValue }) {
  if (items.length === 0) {
    return <p className="muted">No data available.</p>
  }

  return (
    <div className="summary-bar-list">
      {items.map((item) => {
        const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        return (
          <div className="summary-bar-row" key={item.label}>
            <div className="summary-bar-top">
              <span className="summary-bar-label">{item.label}</span>
              <span className="summary-bar-value">{item.displayValue}</span>
            </div>
            <div className="summary-bar-track">
              <div className="summary-bar-fill" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryScreen({ accounts, currentMonthCollections, todayPayments, allCollections, paidAccountIds, closedAccountsCount = 0 }) {
  const [analysisType, setAnalysisType] = useState('account')
  const [rangeType, setRangeType] = useState('current-month')
  const now = new Date()
  const [customMonth, setCustomMonth] = useState(now.getMonth() + 1)
  const [customYear, setCustomYear] = useState(now.getFullYear())

  const availableYears = useMemo(() => {
    const years = new Set([now.getFullYear()])
    ;(allCollections || []).forEach((payment) => {
      const d = new Date(payment.payment_date)
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
    })
    return [...years].sort((a, b) => b - a)
  }, [allCollections, now])

  const filteredCollections = useMemo(() => {
    const base = allCollections || []

    if (rangeType === 'current-month') {
      return currentMonthCollections || []
    }

    if (rangeType === 'last-7-days') {
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      start.setHours(0, 0, 0, 0)

      return base.filter((payment) => {
        const paymentDate = new Date(payment.payment_date)
        return paymentDate >= start && paymentDate <= end
      })
    }

    return base.filter((payment) => {
      const paymentDate = new Date(payment.payment_date)
      return (
        paymentDate.getFullYear() === customYear &&
        paymentDate.getMonth() + 1 === customMonth
      )
    })
  }, [allCollections, currentMonthCollections, customMonth, customYear, now, rangeType])

  const periodLabel = useMemo(() => {
    if (rangeType === 'current-month') {
      return 'Current Month'
    }

    if (rangeType === 'last-7-days') {
      return 'Last 7 Days'
    }

    const monthName = new Date(customYear, customMonth - 1, 1).toLocaleString('en-US', {
      month: 'short'
    })
    return `${monthName} ${customYear}`
  }, [customMonth, customYear, rangeType])

  const accountSummary = useMemo(() => {
    const totalAccounts = accounts.length
    const uniqueVillages = new Set(accounts.map((a) => (a.village || '').trim()).filter(Boolean)).size
    const hasVillage = (account) => Boolean((account?.village || '').trim())
    const hasMobile = (account) => /^\d{10}$/.test(String(account?.phone || '').trim()) && String(account?.phone || '').trim() !== '0'
    const hasCif = (account) => Boolean(String(account?.cif_number || '').trim())

    const overdueAccounts = accounts.filter((account) => getEmiStatus(account.next_emi_date).status === 'PENDING').length
    const paidThisMonthCount = paidAccountIds.size
    const paymentCoverage = totalAccounts > 0 ? (paidThisMonthCount / totalAccounts) * 100 : 0

    const accountsWithVillage = accounts.filter(hasVillage).length
    const accountsWithMobile = accounts.filter(hasMobile).length
    const accountsWithVillageAndMobile = accounts.filter(
      (account) => hasVillage(account) && hasMobile(account)
    ).length
    const accountsWithCif = accounts.filter(hasCif).length
    const missingVillageCount = totalAccounts - accountsWithVillage
    const missingMobileCount = totalAccounts - accountsWithMobile
    const missingCifCount = totalAccounts - accountsWithCif

    const villageDistribution = accounts.reduce((map, account) => {
      const village = (account?.village || '').trim() || 'Not Set'
      map[village] = (map[village] || 0) + 1
      return map
    }, {})

    const topVillageByAccountsEntry = Object.entries(villageDistribution).sort((a, b) => b[1] - a[1])[0]
    const topVillageByAccounts = topVillageByAccountsEntry ? topVillageByAccountsEntry[0] : '-'
    const topVillageByAccountsCount = topVillageByAccountsEntry ? topVillageByAccountsEntry[1] : 0

    return {
      totalAccounts,
      closedAccountsCount,
      uniqueVillages,
      overdueAccounts,
      paidThisMonthCount,
      paymentCoverage,
      accountsWithVillage,
      accountsWithMobile,
      accountsWithVillageAndMobile,
      accountsWithCif,
      missingVillageCount,
      missingMobileCount,
      missingCifCount,
      topVillageByAccounts,
      topVillageByAccountsCount
    }
  }, [accounts, closedAccountsCount, paidAccountIds])

  const paymentSummary = useMemo(() => {
    const todayTotal = todayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const todayDue = todayPayments.reduce((sum, payment) => sum + getPaymentBreakdown(payment).dueAmount, 0)
    const todayCashTotal = todayPayments.reduce(
      (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'CASH') ? Number(payment.amount || 0) : 0),
      0
    )
    const todayOnlineTotal = todayPayments.reduce(
      (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'ONLINE') ? Number(payment.amount || 0) : 0),
      0
    )

    const monthTotal = filteredCollections.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const monthDue = filteredCollections.reduce((sum, payment) => sum + getPaymentBreakdown(payment).dueAmount, 0)
    const monthCashTotal = filteredCollections.reduce(
      (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'CASH') ? Number(payment.amount || 0) : 0),
      0
    )
    const monthOnlineTotal = filteredCollections.reduce(
      (sum, payment) => sum + ((String(payment.payment_mode || 'CASH').toUpperCase() === 'ONLINE') ? Number(payment.amount || 0) : 0),
      0
    )

    const totalEmisCollected = filteredCollections.reduce(
      (sum, payment) => sum + Number(payment.emis_paid || 1),
      0
    )

    const paymentCountThisMonth = filteredCollections.length
    const averageTicketSize = paymentCountThisMonth > 0 ? monthTotal / paymentCountThisMonth : 0

    const villageBuckets = filteredCollections.reduce((map, payment) => {
      const village = payment?.accounts?.village || '-'
      const amount = Number(payment.amount || 0)
      map[village] = (map[village] || 0) + amount
      return map
    }, {})

    const topVillageEntry = Object.entries(villageBuckets).sort((a, b) => b[1] - a[1])[0]
    const topVillageName = topVillageEntry ? topVillageEntry[0] : '-'
    const topVillageAmount = topVillageEntry ? topVillageEntry[1] : 0

    const villageCollectionsTop5 = Object.entries(villageBuckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({
        label,
        value,
        displayValue: `₹ ${formatCurrency(value)}`
      }))

    const maxVillageCollection = villageCollectionsTop5.reduce(
      (max, row) => (row.value > max ? row.value : max),
      0
    )

    return {
      todayTotal,
      todayDue,
      todayCashTotal,
      todayOnlineTotal,
      monthTotal,
      monthDue,
      monthCashTotal,
      monthOnlineTotal,
      totalEmisCollected,
      paymentCountThisMonth,
      averageTicketSize,
      topVillageName,
      topVillageAmount,
      villageCollectionsTop5,
      maxVillageCollection
    }
  }, [filteredCollections, todayPayments])

  const accountCompletenessSegments = useMemo(() => {
    const both = accountSummary.accountsWithVillageAndMobile
    const villageOnly = Math.max(0, accountSummary.accountsWithVillage - both)
    const mobileOnly = Math.max(0, accountSummary.accountsWithMobile - both)
    const missingBoth = Math.max(
      0,
      accountSummary.totalAccounts - (both + villageOnly + mobileOnly)
    )

    return [
      { label: 'Village + Mobile', value: both, color: '#16a34a' },
      { label: 'Only Village', value: villageOnly, color: '#0ea5e9' },
      { label: 'Only Mobile', value: mobileOnly, color: '#f59e0b' },
      { label: 'Missing Both', value: missingBoth, color: '#ef4444' }
    ]
  }, [accountSummary])

  const paymentStatusSegments = useMemo(() => {
    const paid = accountSummary.paidThisMonthCount
    const unpaid = Math.max(0, accountSummary.totalAccounts - paid)

    return [
      { label: 'Paid This Month', value: paid, color: '#2563eb' },
      { label: 'Not Paid This Month', value: unpaid, color: '#94a3b8' }
    ]
  }, [accountSummary])

  const collectionSplitBars = useMemo(() => {
    const emiOnly = Math.max(0, paymentSummary.monthTotal - paymentSummary.monthDue)
    const due = paymentSummary.monthDue
    const rows = [
      { label: 'EMI Amount', value: emiOnly, displayValue: `₹ ${formatCurrency(emiOnly)}` },
      { label: 'Due Amount', value: due, displayValue: `₹ ${formatCurrency(due)}` }
    ]
    const maxValue = rows.reduce((max, row) => (row.value > max ? row.value : max), 0)

    return { rows, maxValue }
  }, [paymentSummary])

  return (
    <section>
      <h2 className="screen-title">Summary</h2>

      <div className="summary-select-grid">
        <button
          type="button"
          className={`summary-select-card ${analysisType === 'account' ? 'active' : ''}`}
          onClick={() => setAnalysisType('account')}
        >
          <p className="summary-select-title">Account Analysis</p>
          <p className="summary-select-subtitle">Village, mobile and coverage insights</p>
        </button>
        <button
          type="button"
          className={`summary-select-card ${analysisType === 'payment' ? 'active' : ''}`}
          onClick={() => setAnalysisType('payment')}
        >
          <p className="summary-select-title">Payment Analysis</p>
          <p className="summary-select-subtitle">Collections, dues and village trends</p>
        </button>
      </div>

      {analysisType === 'account' ? (
        <article className="card summary-card">
          <h3>Account Analysis</h3>
          <div className="account-details">
            <div className="detail-row">
              <span className="label">Total Accounts:</span>
              <span>{accountSummary.totalAccounts}</span>
            </div>
            <div className="detail-row">
              <span className="label">Closed Accounts:</span>
              <span>{accountSummary.closedAccountsCount}</span>
            </div>
            <div className="detail-row">
              <span className="label">Villages Covered:</span>
              <span>{accountSummary.uniqueVillages}</span>
            </div>
            <div className="detail-row">
              <span className="label">Overdue Accounts:</span>
              <span>{accountSummary.overdueAccounts}</span>
            </div>
            <div className="detail-row">
              <span className="label">Paid This Month:</span>
              <span>
                {accountSummary.paidThisMonthCount} ({accountSummary.paymentCoverage.toFixed(1)}%)
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Accounts With Village:</span>
              <span>{accountSummary.accountsWithVillage}</span>
            </div>
            <div className="detail-row">
              <span className="label">Accounts With Mobile:</span>
              <span>{accountSummary.accountsWithMobile}</span>
            </div>
            <div className="detail-row">
              <span className="label">Accounts With CIF:</span>
              <span>{accountSummary.accountsWithCif}</span>
            </div>
            <div className="detail-row">
              <span className="label">Missing Village:</span>
              <span>{accountSummary.missingVillageCount}</span>
            </div>
            <div className="detail-row">
              <span className="label">Missing Mobile:</span>
              <span>{accountSummary.missingMobileCount}</span>
            </div>
            <div className="detail-row">
              <span className="label">Missing CIF:</span>
              <span>{accountSummary.missingCifCount}</span>
            </div>
            <div className="detail-row">
              <span className="label">Top Village By Accounts:</span>
              <span>
                {accountSummary.topVillageByAccounts} ({accountSummary.topVillageByAccountsCount})
              </span>
            </div>
          </div>

          <div className="summary-chart-grid">
            <div className="summary-chart-card">
              <h4>Profile Completeness</h4>
              <PieChart segments={accountCompletenessSegments} />
            </div>
            <div className="summary-chart-card">
              <h4>Payment Coverage</h4>
              <PieChart segments={paymentStatusSegments} />
            </div>
          </div>
        </article>
      ) : (
        <>
          <article className="card summary-filters-card">
            <h3>Summary Filters</h3>
            <div className="summary-filter-row">
              <button
                className={`sort-pill ${rangeType === 'last-7-days' ? 'active' : ''}`}
                onClick={() => setRangeType('last-7-days')}
                type="button"
              >
                Last 7 Days
              </button>
              <button
                className={`sort-pill ${rangeType === 'current-month' ? 'active' : ''}`}
                onClick={() => setRangeType('current-month')}
                type="button"
              >
                Current Month
              </button>
              <button
                className={`sort-pill ${rangeType === 'custom-month' ? 'active' : ''}`}
                onClick={() => setRangeType('custom-month')}
                type="button"
              >
                Custom Month
              </button>
            </div>

            {rangeType === 'custom-month' ? (
              <div className="summary-filter-pickers">
                <label className="input-label">
                  Month
                  <select
                    className="input"
                    value={customMonth}
                    onChange={(e) => setCustomMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }).map((_, index) => {
                      const value = index + 1
                      const label = new Date(2000, index, 1).toLocaleString('en-US', { month: 'short' })
                      return (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label className="input-label">
                  Year
                  <select
                    className="input"
                    value={customYear}
                    onChange={(e) => setCustomYear(Number(e.target.value))}
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <p className="summary-range-label">Showing payment analytics for: {periodLabel}</p>
          </article>

          <article className="card summary-card" style={{ marginTop: 12 }}>
            <h3>Payment Analysis</h3>
            <div className="account-details">
              <div className="detail-row">
                <span className="label">Collected Today:</span>
                <span>₹ {formatCurrency(paymentSummary.todayTotal)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Cash Collected Today:</span>
                <span>₹ {formatCurrency(paymentSummary.todayCashTotal)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Online Collected Today:</span>
                <span>₹ {formatCurrency(paymentSummary.todayOnlineTotal)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Due Collected Today:</span>
                <span>₹ {formatCurrency(paymentSummary.todayDue)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Collected ({periodLabel}):</span>
                <span>₹ {formatCurrency(paymentSummary.monthTotal)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Cash Collected ({periodLabel}):</span>
                <span>₹ {formatCurrency(paymentSummary.monthCashTotal)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Online Collected ({periodLabel}):</span>
                <span>₹ {formatCurrency(paymentSummary.monthOnlineTotal)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Due Collected ({periodLabel}):</span>
                <span>₹ {formatCurrency(paymentSummary.monthDue)}</span>
              </div>
              <div className="detail-row">
                <span className="label">EMIs Collected ({periodLabel}):</span>
                <span>{paymentSummary.totalEmisCollected}</span>
              </div>
              <div className="detail-row">
                <span className="label">Collection Entries ({periodLabel}):</span>
                <span>{paymentSummary.paymentCountThisMonth}</span>
              </div>
              <div className="detail-row">
                <span className="label">Average Collection Entry:</span>
                <span>₹ {formatCurrency(paymentSummary.averageTicketSize)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Top Village ({periodLabel}):</span>
                <span>
                  {paymentSummary.topVillageName} (₹ {formatCurrency(paymentSummary.topVillageAmount)})
                </span>
              </div>
            </div>

            <div className="summary-chart-grid">
              <div className="summary-chart-card">
                <h4>Top Villages By Collection</h4>
                <BarChart
                  items={paymentSummary.villageCollectionsTop5}
                  maxValue={paymentSummary.maxVillageCollection}
                />
              </div>
              <div className="summary-chart-card">
                <h4>Monthly Collection Split</h4>
                <BarChart items={collectionSplitBars.rows} maxValue={collectionSplitBars.maxValue} />
              </div>
            </div>
          </article>
        </>
      )}
    </section>
  )
}

export default SummaryScreen
