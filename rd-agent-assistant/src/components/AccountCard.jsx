function AccountCard({ account, isPaid, onMarkPaid }) {
  return (
    <article className="card account-card">
      <div className="account-top-row">
        <h3>{account.name}</h3>
        <span className={`status-pill ${isPaid ? 'paid' : 'pending'}`}>
          {isPaid ? 'Paid' : 'Pending'}
        </span>
      </div>

      <p className="muted">Village: {account.village}</p>
      <p className="amount">₹ {Number(account.emi_amount).toFixed(2)}</p>

      <div className="account-actions">
        {account.phone ? (
          <a className="btn btn-secondary" href={`tel:${account.phone}`}>
            Call
          </a>
        ) : null}

        <button className="btn btn-primary" onClick={() => onMarkPaid(account)} disabled={isPaid}>
          {isPaid ? 'Already Paid' : 'Mark Paid'}
        </button>
      </div>
    </article>
  )
}

export default AccountCard
