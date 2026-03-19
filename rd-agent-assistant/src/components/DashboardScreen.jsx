function DashboardScreen({ totalAccounts, totalEmiDue, totalCollectedToday, totalCollectedThisMonth, onViewAccounts, onViewMonthlyPayments }) {
  const cards = [
    { label: 'Total Accounts', value: totalAccounts, action: onViewAccounts },
    { label: 'Total EMI Due', value: `₹ ${totalEmiDue.toFixed(2)}` },
    { label: 'Collected Today', value: `₹ ${totalCollectedToday.toFixed(2)}` },
    { label: 'Collected This Month', value: `₹ ${totalCollectedThisMonth.toFixed(2)}`, action: onViewMonthlyPayments }
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
          </article>
        ))}
      </div>
    </section>
  )
}

export default DashboardScreen
