import { useEffect, useMemo, useState } from 'react'
import AccountCard from './AccountCard'

function EmiCollectionScreen({ accounts, paidAccountIds, onMarkPaidClick }) {
  const [selectedVillage, setSelectedVillage] = useState('all')
  const [selectedCycle, setSelectedCycle] = useState('all')
  const [searchName, setSearchName] = useState('')
  const [toastMessage, setToastMessage] = useState('')

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
          />
        ))}
      </div>

      {toastMessage ? <div className="toast-message">{toastMessage}</div> : null}
    </section>
  )
}

export default EmiCollectionScreen
