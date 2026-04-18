import { getEmiStatus } from '../lib/utils'

function AccountCard({ account, isPaid, onMarkPaid, onCall, onInfo }) {
  const emiStatus = getEmiStatus(account.next_emi_date)

  const statusTagClass = emiStatus.status === 'PENDING' ? 'pending' : emiStatus.status === 'ADVANCE' ? 'advance' : 'regular'
  const statusLabel = emiStatus.status === 'PENDING' ? `PENDING (${emiStatus.count})` : emiStatus.status === 'ADVANCE' ? `ADVANCE (${emiStatus.count})` : 'REGULAR'

  return (
    <article className={`card account-card ${isPaid ? 'paid-card paid-compact' : ''}`}>
      <div className="account-top-row">
        <div>
          <div className="account-number-row">
            <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>Acc #{account.account_number}</p>
            <button
              type="button"
              className="info-btn"
              onClick={() => onInfo(account)}
              title="Account info"
              aria-label="Account info"
            >
              i
            </button>
          </div>
          <h3>{account.name}</h3>
        </div>
      </div>

      <p className="muted">Village: {account.village || '-'}</p>
      <p className="amount">₹ {Number(account.emi_amount).toFixed(2)} / {account.emi_cycle} days</p>

      <div className="emi-status">
        <span className={`emi-status-tag ${statusTagClass}`}>{statusLabel}</span>
      </div>

      {!isPaid ? (
        <div className="account-actions">
          <button className="btn btn-secondary" onClick={() => onCall(account)}>
            Call
          </button>

          <button className="btn btn-primary" onClick={() => onMarkPaid(account)}>
            Mark Paid
          </button>
        </div>
      ) : null}
    </article>
  )
}

export default AccountCard
