import { useMemo, useState } from 'react'
import { getEmiStatus } from '../lib/utils'

function EmiDueListScreen({ accounts, paidAccountIds, onClose }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('pending') // 'pending' | 'emi' | 'total'

  const rows = useMemo(() => {
    return accounts
      .map((account) => {
        const emiAmount = Number(account.emi_amount || 0)
        const { status, count } = getEmiStatus(account.next_emi_date)
        const paidThisMonth = paidAccountIds.has(account.id)

        let monthsDue = 0
        if (status === 'PENDING') {
          monthsDue = count + (paidThisMonth ? 0 : 1)
        } else if (status === 'REGULAR') {
          monthsDue = paidThisMonth ? 0 : 1
        }

        return {
          id: account.id,
          name: account.name || '-',
          accountNumber: account.account_number || account.id,
          emiAmount,
          monthsDue,
          totalDue: emiAmount * monthsDue,
        }
      })
      .filter((row) => row.totalDue > 0)
  }, [accounts, paidAccountIds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows

    return [...list].sort((a, b) => {
      if (sortBy === 'pending') return b.monthsDue - a.monthsDue
      if (sortBy === 'emi') return b.emiAmount - a.emiAmount
      if (sortBy === 'total') return b.totalDue - a.totalDue
      return 0
    })
  }, [rows, search, sortBy])

  const grandTotal = useMemo(() => filtered.reduce((s, r) => s + r.totalDue, 0), [filtered])

  return (
    <section>
      <div className="screen-header">
        <h2>EMI Due List</h2>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      {/* Search */}
      <div className="emi-due-controls">
        <input
          className="input"
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Sort */}
        <div className="sort-row">
          <span className="sort-label">Sort by:</span>
          {[
            { key: 'pending', label: "EMI's Pending" },
            { key: 'emi', label: 'EMI Amount' },
            { key: 'total', label: 'Total Due' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`sort-pill ${sortBy === key ? 'active' : ''}`}
              onClick={() => setSortBy(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary badge */}
      <p className="emi-due-summary">
        {filtered.length} account{filtered.length !== 1 ? 's' : ''} &nbsp;·&nbsp; Total ₹&nbsp;{grandTotal.toFixed(2)}
      </p>

      {filtered.length === 0 ? (
        <p className="empty">No outstanding EMIs found.</p>
      ) : (
        <div className="emi-due-list">
          {filtered.map((row) => (
            <article key={row.id} className="emi-due-card card">
              <div className="emi-due-top">
                <div>
                  <p className="emi-due-name">{row.name}</p>
                  <p className="account-number">{row.accountNumber}</p>
                </div>
                <span className="emi-due-total">₹ {row.totalDue.toFixed(2)}</span>
              </div>
              <div className="emi-due-bottom">
                <span className="emi-due-chip">EMI ₹ {row.emiAmount.toFixed(2)}</span>
                <span className={`emi-due-chip pending-chip`}>
                  {row.monthsDue} month{row.monthsDue !== 1 ? 's' : ''} pending
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default EmiDueListScreen
