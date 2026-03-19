function DailyReportScreen({ payments }) {
  const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  return (
    <section>
      <h2 className="screen-title">Daily Report</h2>

      <article className="metric-card total-card">
        <p className="metric-label">Total Collected Today</p>
        <h3 className="metric-value">₹ {totalCollected.toFixed(2)}</h3>
      </article>

      <div className="list-stack">
        {payments.map((payment) => (
          <article className="card" key={payment.id}>
            <h3>{payment.accounts?.name || 'Unknown'}</h3>
            <p className="muted">Village: {payment.accounts?.village || '-'}</p>
            <p className="amount">₹ {Number(payment.amount || 0).toFixed(2)}</p>
          </article>
        ))}
      </div>

      {payments.length === 0 ? <p className="empty">No payments collected today.</p> : null}
    </section>
  )
}

export default DailyReportScreen
