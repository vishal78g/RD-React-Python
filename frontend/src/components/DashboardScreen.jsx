function DashboardScreen({
  totalAccounts,
  totalClosedAccounts,
  totalVillages,
  totalAmountPaidTillNow,
  totalEmiDue,
  totalCollectedToday,
  totalCollectedTodayDue,
  totalCollectedThisMonth,
  totalCollectedThisMonthDue,
  onViewAccounts,
  onViewClosedAccounts,
  onViewMonthlyPayments,
  onViewEmiDueList,
  onViewVillages
}) {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount || 0))

  const cards = [
    { label: 'Total Accounts', value: totalAccounts, action: onViewAccounts },
    { label: 'Closed Accounts', value: totalClosedAccounts, action: onViewClosedAccounts },
    { label: 'Total Villages', value: totalVillages, action: onViewVillages },
    { label: 'Total Amount Paid Till Now', value: `₹ ${formatCurrency(totalAmountPaidTillNow)}` },
    { label: 'Total EMI Due', value: `₹ ${formatCurrency(totalEmiDue)}`, action: onViewEmiDueList },
    {
      label: 'Collected This Month',
      value: `₹ ${formatCurrency(totalCollectedThisMonth)}`,
      note: `Due ₹ ${formatCurrency(totalCollectedThisMonthDue)}`,
      action: onViewMonthlyPayments
    },
    {
      label: 'Collected Today',
      value: `₹ ${formatCurrency(totalCollectedToday)}`,
      note: `Due ₹ ${formatCurrency(totalCollectedTodayDue)}`
    }
  ]

  return (
    <section>
      <h2 className="screen-title">Dashboard</h2>
      <div className="grid-cards">
        {cards.map((card) => (
          <article
            className={`metric-card ${card.action ? 'clickable' : ''}`}
            key={card.label}
            onClick={card.action}
            role={card.action ? 'button' : undefined}
            tabIndex={card.action ? 0 : undefined}
          >
            <p className="metric-label">{card.label}</p>
            <h3 className="metric-value">{card.value}</h3>
            {card.note ? <p className="metric-note">{card.note}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

export default DashboardScreen
