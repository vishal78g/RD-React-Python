import { useEffect, useMemo, useState } from 'react'
import { getPaymentTotals } from '../lib/utils'

function MarkPaidModal({ account, onConfirm, onCancel, submitting }) {
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [selectedMonthKeys, setSelectedMonthKeys] = useState([])

  const monthOptions = useMemo(() => {
    const current = new Date()
    const currentMonthStart = new Date(current.getFullYear(), current.getMonth(), 1)

    const nextDate = new Date(account.next_emi_date)
    const nextMonthStart = Number.isNaN(nextDate.getTime())
      ? currentMonthStart
      : new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)

    // For advance accounts, allow only next EMI month.
    if (nextMonthStart > currentMonthStart) {
      const month = nextMonthStart.getMonth() + 1
      const year = nextMonthStart.getFullYear()
      const monthLabel = nextMonthStart.toLocaleString('en-US', { month: 'short' }).toUpperCase()

      return [{
        key: `${year}-${String(month).padStart(2, '0')}`,
        month,
        year,
        monthLabel,
        fullLabel: `${monthLabel} ${year}`
      }]
    }

    const start = nextMonthStart
    const end = currentMonthStart

    const months = []
    const cursor = new Date(start)

    while (cursor <= end) {
      const month = cursor.getMonth() + 1
      const year = cursor.getFullYear()
      const monthLabel = cursor.toLocaleString('en-US', { month: 'short' }).toUpperCase()

      months.push({
        key: `${year}-${String(month).padStart(2, '0')}`,
        month,
        year,
        monthLabel,
        fullLabel: `${monthLabel} ${year}`
      })

      cursor.setMonth(cursor.getMonth() + 1)
    }

    return months
  }, [account.next_emi_date])

  useEffect(() => {
    setSelectedMonthKeys((previous) => {
      const validSelections = previous.filter((key) => monthOptions.some((month) => month.key === key))
      if (validSelections.length > 0) return validSelections

      const defaultMonth = monthOptions[0]
      return defaultMonth ? [defaultMonth.key] : []
    })
  }, [monthOptions])

  const selectedMonths = useMemo(
    () => monthOptions.filter((month) => selectedMonthKeys.includes(month.key)),
    [monthOptions, selectedMonthKeys]
  )

  const quantity = selectedMonths.length

  const { totalAmount } = getPaymentTotals({
    emiAmount: account.emi_amount,
    nextEmiDate: account.next_emi_date,
    quantity
  })

  function handleToggleMonth(monthKey) {
    setSelectedMonthKeys((previous) =>
      previous.includes(monthKey)
        ? previous.filter((key) => key !== monthKey)
        : [...previous, monthKey]
    )
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Mark EMI as Paid</h2>
          <button className="btn-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-content">
          <p>
            <strong>Account:</strong> {account.name}
          </p>
          <p>
            <strong>EMI Amount:</strong> ₹ {Number(account.emi_amount).toFixed(2)}
          </p>

          <label className="input-label">
            Payment Mode
            <div className="payment-mode-switch">
              <button
                type="button"
                className={`mode-btn ${paymentMode === 'CASH' ? 'active' : ''}`}
                onClick={() => setPaymentMode('CASH')}
                disabled={submitting}
              >
                CASH
              </button>
              <button
                type="button"
                className={`mode-btn ${paymentMode === 'ONLINE' ? 'active' : ''}`}
                onClick={() => setPaymentMode('ONLINE')}
                disabled={submitting}
              >
                ONLINE
              </button>
            </div>
          </label>

          <label className="input-label">
            Select Months for EMI
            <div className="month-chip-grid">
              {monthOptions.map((month) => (
                <button
                  type="button"
                  key={month.key}
                  className={`month-chip ${selectedMonthKeys.includes(month.key) ? 'active' : ''}`}
                  onClick={() => handleToggleMonth(month.key)}
                  disabled={submitting}
                  title={month.fullLabel}
                >
                  {month.monthLabel}
                </button>
              ))}
            </div>
          </label>

          <div className="payment-summary">
            <div className="summary-row">
              <span>Number of EMI Due:</span>
              <span>{quantity}</span>
            </div>
            <div className="summary-row total">
              <span>Total:</span>
              <span>₹ {totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={() => onConfirm({ quantity, selectedMonths, paymentMode })}
              disabled={submitting || quantity < 1}
            >
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
            <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarkPaidModal
