function DashboardScreen({ totalAccounts, totalEmiDue, totalCollectedToday, totalCollectedThisMonth }) {
  const cards = [
    { label: 'Total Accounts', value: totalAccounts },
    { label: 'Total EMI Due', value: `₹ ${totalEmiDue.toFixed(2)}` },
    { label: 'Collected Today', value: `₹ ${totalCollectedToday.toFixed(2)}` },
    { label: 'Collected This Month', value: `₹ ${totalCollectedThisMonth.toFixed(2)}` }
  ]

  return (
    <section>
      <h2 className="screen-title">Dashboard</h2>
      <div className="grid-cards">
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <p className="metric-label">{card.label}</p>
            <h3 className="metric-value">{card.value}</h3>
          </article>
        ))}
      </div>
    </section>
  )
}

export default DashboardScreen
