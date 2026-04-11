import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDateLong } from '../lib/utils'

function AccountsListScreen({
  accounts,
  focusedAccountId,
  onEdit,
  onDelete,
  onClose,
  title = 'All Accounts',
  showActions = true
}) {
  const [searchName, setSearchName] = useState('')
  const accountRefs = useRef(new Map())

  const filteredAccounts = useMemo(() => {
    if (!searchName.trim()) {
      return accounts
    }
    return accounts.filter((account) =>
      account.name.toLowerCase().includes(searchName.toLowerCase())
    )
  }, [accounts, searchName])

  useEffect(() => {
    if (!focusedAccountId) return

    const target = accountRefs.current.get(focusedAccountId)
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [filteredAccounts, focusedAccountId])

  return (
    <section>
      <div className="screen-header">
        <h2 className="screen-title">{title}</h2>
        <button className="btn btn-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      <div className="card search-card">
        <input
          className="input"
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
      </div>

      {filteredAccounts.length === 0 ? (
        <p className="empty">No accounts found.</p>
      ) : (
        <div className="list-stack">
          {filteredAccounts.map((account) => (
            <article
              className={`card account-detail-card ${focusedAccountId === account.id ? 'account-detail-card-focused' : ''}`}
              key={account.id}
              ref={(element) => {
                if (element) {
                  accountRefs.current.set(account.id, element)
                } else {
                  accountRefs.current.delete(account.id)
                }
              }}
            >
              <div className="account-header">
                <div>
                  <p className="account-number">{account.account_number}</p>
                  <h3>{account.name}</h3>
                </div>
              </div>

              <div className="account-details">
                <div className="detail-row">
                  <span className="label">Village:</span>
                  <span>{account.village || '-'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Mobile:</span>
                  <span>{account.phone || '-'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">EMI Amount:</span>
                  <span className="amount">₹ {Number(account.emi_amount).toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">EMI Cycle:</span>
                  <span>{account.emi_cycle} days</span>
                </div>
                <div className="detail-row">
                  <span className="label">Account Opening:</span>
                  <span>{formatDateLong(account.account_opening_date)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Month Paid Upto:</span>
                  <span>{account.month_paid_upto || 0}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Next EMI Date:</span>
                  <span>{formatDateLong(account.next_emi_date)}</span>
                </div>
              </div>

              {showActions ? (
                <div className="account-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => onEdit(account)}
                  >
                    Edit
                  </button>

                  <button className="btn btn-danger" onClick={() => onDelete(account)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AccountsListScreen
