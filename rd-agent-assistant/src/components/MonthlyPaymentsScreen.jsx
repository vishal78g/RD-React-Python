import { useMemo } from 'react'
import { formatDateLong } from '../lib/utils'

function MonthlyPaymentsScreen({ payments, month, year, onClose }) {
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' })

  const totalCollected = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments]
  )

  return (
    <section>
      <div className="screen-header">
        <h2 className="screen-title">
          {monthName} {year}
        </h2>
        <button className="btn btn-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      <article className="metric-card total-card">
        <p className="metric-label">Total Collected This Month</p>
        <h3 className="metric-value">₹ {totalCollected.toFixed(2)}</h3>
      </article>

      {payments.length === 0 ? (
        <p className="empty">No payments collected this month.</p>
      ) : (
        <div className="list-stack">
          {payments.map((payment) => (
            <article className="card" key={payment.id}>
              <div className="account-top-row">
                <h3>{payment.accounts?.name || 'Unknown'}</h3>
                {payment.emis_paid > 1 && (
                  <span className="payment-count-badge" title={`${payment.emis_paid} EMIs paid`}>
                    {payment.emis_paid}
                  </span>
                )}
              </div>
              <p className="muted">Village: {payment.accounts?.village || '-'}</p>
              <div className="detail-row">
                <span className="label">Payment Date:</span>
                <span>{formatDateLong(payment.payment_date)}</span>
              </div>
              <p className="amount">₹ {Number(payment.amount).toFixed(2)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default MonthlyPaymentsScreen
