import { useMemo, useState } from 'react'
import AccountCard from './AccountCard'

function EmiCollectionScreen({ accounts, paidAccountIds, onMarkPaidClick }) {
  const [selectedVillage, setSelectedVillage] = useState('all')
  const [selectedCycle, setSelectedCycle] = useState('all')
  const [searchName, setSearchName] = useState('')

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
          />
        ))}
      </div>
    </section>
  )
}

export default EmiCollectionScreen
