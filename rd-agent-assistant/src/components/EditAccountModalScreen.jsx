import { useMemo, useState } from 'react'
import { formatDateLong } from '../lib/utils'

function EditAccountModalScreen({ account, villages = [], onSave, onCancel, submitting, showConfirm, onConfirmUpdate }) {
  const [village, setVillage] = useState(account.village || '')
  const [phone, setPhone] = useState(account.phone || '0')
  const [cifNumber, setCifNumber] = useState(account.cif_number || '')
  const [remarks, setRemarks] = useState(account.remarks || '')
  const [errors, setErrors] = useState({})

  const villageOptions = useMemo(() => {
    const options = new Set(
      (villages || [])
        .map((item) => (item.village_name || '').trim())
        .filter(Boolean)
    )

    const currentVillage = (account.village || '').trim()
    if (currentVillage) {
      options.add(currentVillage)
    }

    return Array.from(options).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [account.village, villages])

  function validateForm() {
    const newErrors = {}

    if (phone && !/^(0|\d{10})$/.test(String(phone).trim())) {
      newErrors.phone = 'Phone must be 0 or 10-digit number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    onSave({
      village: village.trim() || '',
      phone: phone.trim() || '0',
      cif_number: cifNumber.replace(/\D/g, ''),
      remarks: remarks.trim()
    })
  }

  function handleCifChange(event) {
    const digitsOnly = event.target.value.replace(/\D/g, '')
    setCifNumber(digitsOnly)
  }

  return (
    <div className="modal-overlay">
      {showConfirm ? (
        <div className="modal">
          <h2>Confirm Update</h2>
          <p>Are you sure you want to update this account?</p>
          <div className="modal-actions">
            <button className="btn btn-danger" onClick={onConfirmUpdate} disabled={submitting}>
              {submitting ? 'Updating...' : 'Yes, Update'}
            </button>
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="modal">
          <div className="modal-header">
            <h2>Edit Account</h2>
            <button className="btn-close" onClick={onCancel}>✕</button>
          </div>

          <div className="modal-content">
            <div className="modal-summary-compact">
              <div className="summary-item">
                <span className="summary-item-label">Account Number</span>
                <span className="summary-item-value">{account.account_number}</span>
              </div>
              <div className="summary-item">
                <span className="summary-item-label">Name</span>
                <span className="summary-item-value">{account.name}</span>
              </div>
              <div className="summary-item">
                <span className="summary-item-label">Account Opening</span>
                <span className="summary-item-value">{formatDateLong(account.account_opening_date)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-item-label">EMI Amount</span>
                <span className="summary-item-value">₹ {Number(account.emi_amount).toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-item-label">EMI Cycle</span>
                <span className="summary-item-value">{account.emi_cycle} days</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="input-label">
                CIF Number
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cifNumber}
                  onChange={handleCifChange}
                  placeholder="Enter CIF number"
                />
              </label>

              <label className="input-label">
                Village
                <select
                  className="input"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                >
                  <option value="">No village</option>
                  {villageOptions.map((villageName) => (
                    <option key={villageName} value={villageName}>
                      {villageName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-label">
                Mobile Number
                <input
                  className={`input ${errors.phone ? 'input-error' : ''}`}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit or 0"
                />
                {errors.phone && <span className="error-small">{errors.phone}</span>}
              </label>

              <label className="input-label">
                Remarks
                <textarea
                  className="input remarks-input"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Add remarks"
                />
              </label>

              <div className="modal-actions">
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Update'}
                </button>
                <button className="btn btn-secondary" type="button" onClick={onCancel}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditAccountModalScreen
