import { getEmiStatus } from '../lib/utils'

function AccountCard({ account, isPaid, onMarkPaid }) {
  const emiStatus = getEmiStatus(account.next_emi_date)

  const statusTagClass = emiStatus.status === 'PENDING' ? 'pending' : emiStatus.status === 'ADVANCE' ? 'advance' : 'regular'
  const statusLabel = emiStatus.status === 'PENDING' ? `PENDING (${emiStatus.count})` : emiStatus.status === 'ADVANCE' ? `ADVANCE (${emiStatus.count})` : 'REGULAR'

  return (
    <article className="card account-card">
      <div className="account-top-row">
        <div>
          <p className="muted" style={{ marginTop: 0 }}>Acc #{account.account_number}</p>
          <h3>{account.name}</h3>
        </div>
        <span className={`status-pill ${isPaid ? 'paid' : 'pending'}`}>
          {isPaid ? 'Paid' : 'Pending'}
        </span>
      </div>

      <p className="muted">Village: {account.village || '-'}</p>
      <p className="amount">₹ {Number(account.emi_amount).toFixed(2)} / {account.emi_cycle} days</p>

      <div className="emi-status">
        <span className={`emi-status-tag ${statusTagClass}`}>{statusLabel}</span>
      </div>

      <div className="account-actions">
        {account.phone && account.phone !== '0' ? (
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
