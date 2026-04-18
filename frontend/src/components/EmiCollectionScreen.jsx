import { useEffect, useMemo, useState } from 'react'
import AccountCard from './AccountCard'
import { formatDateLong } from '../lib/utils'

function EmiCollectionScreen({ accounts, paidAccountIds, onMarkPaidClick, onEditAccount }) {
  const [selectedVillage, setSelectedVillage] = useState('all')
  const [selectedCycle, setSelectedCycle] = useState('all')
  const [searchName, setSearchName] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [infoAccount, setInfoAccount] = useState(null)

  const villages = useMemo(() => {
    const allVillages = accounts.map((account) => account.village).filter(Boolean)
    return [...new Set(allVillages)].sort((a, b) => a.localeCompare(b))
  }, [accounts])

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const villageMatch = selectedVillage === 'all' || account.village === selectedVillage
      const cycleMatch = selectedCycle === 'all' || String(account.emi_cycle) === selectedCycle
      const nameMatch = !searchName.trim() || account.name.toLowerCase().includes(searchName.toLowerCase())
      return villageMatch && cycleMatch && nameMatch
    })
  }, [accounts, selectedVillage, selectedCycle, searchName])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(''), 2200)
    return () => clearTimeout(timer)
  }, [toastMessage])

  function handleCallClick(account) {
    const phone = String(account?.phone || '').trim()
    const hasValidPhone = /^\d{10}$/.test(phone) && phone !== '0'

    if (hasValidPhone) {
      window.location.href = `tel:${phone}`
      return
    }

    setToastMessage('No mobile number linked')
  }

  return (
    <section>
      <h2 className="screen-title">EMI Collection</h2>

      <div className="card filters-card">
        <input
          className="input"
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(event) => setSearchName(event.target.value)}
        />

        <label className="input-label">
          Village
          <select
            className="input"
            value={selectedVillage}
            onChange={(event) => setSelectedVillage(event.target.value)}
          >
            <option value="all">All</option>
            {villages.map((village) => (
              <option value={village} key={village}>
                {village}
              </option>
            ))}
          </select>
        </label>

        <label className="input-label">
          EMI Cycle
          <select
            className="input"
            value={selectedCycle}
            onChange={(event) => setSelectedCycle(event.target.value)}
          >
            <option value="all">All</option>
            <option value="15">15</option>
            <option value="30">30</option>
          </select>
        </label>
      </div>

      {filteredAccounts.length === 0 ? <p className="empty">No accounts found.</p> : null}

      <div className="list-stack">
        {filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            isPaid={paidAccountIds.has(account.id)}
            onMarkPaid={onMarkPaidClick}
            onCall={handleCallClick}
            onInfo={setInfoAccount}
          />
        ))}
      </div>

      {toastMessage ? <div className="toast-message">{toastMessage}</div> : null}

      {infoAccount ? (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Account Summary</h2>
              <button className="btn-close" onClick={() => setInfoAccount(null)}>✕</button>
            </div>

            <div className="modal-content">
              <div className="modal-summary-compact">
                <div className="summary-item">
                  <span className="summary-item-label">Account Number</span>
                  <span className="summary-item-value">{infoAccount.account_number || '-'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">Name</span>
                  <span className="summary-item-value">{infoAccount.name || '-'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">Village</span>
                  <span className="summary-item-value">{infoAccount.village || '-'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">Mobile</span>
                  <span className="summary-item-value">{infoAccount.phone || '-'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">CIF Number</span>
                  <span className="summary-item-value">{infoAccount.cif_number || '-'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">EMI Amount</span>
                  <span className="summary-item-value">₹ {Number(infoAccount.emi_amount || 0).toFixed(2)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">EMI Cycle</span>
                  <span className="summary-item-value">{infoAccount.emi_cycle || '-'} days</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">Next EMI Date</span>
                  <span className="summary-item-value">{formatDateLong(infoAccount.next_emi_date)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-item-label">Remarks</span>
                  <span className="summary-item-value">{infoAccount.remarks || '-'}</span>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onEditAccount(infoAccount)
                    setInfoAccount(null)
                  }}
                >
                  Edit
                </button>
                <button className="btn btn-secondary" onClick={() => setInfoAccount(null)}>
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default EmiCollectionScreen
