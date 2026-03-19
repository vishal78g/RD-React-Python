import { useState } from 'react'
import { formatDateLong } from '../lib/utils'

function EditAccountModalScreen({ account, onSave, onCancel, submitting, showConfirm, onConfirmUpdate }) {
  const [village, setVillage] = useState(account.village || '')
  const [phone, setPhone] = useState(account.phone || '0')
  const [errors, setErrors] = useState({})

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
      phone: phone.trim() || '0'
    })
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
            <div className="read-only-field">
              <label>Account Number</label>
              <p>{account.account_number}</p>
            </div>

            <div className="read-only-field">
              <label>Name</label>
              <p>{account.name}</p>
            </div>

            <div className="read-only-field">
              <label>Account Opening Date</label>
              <p>{formatDateLong(account.account_opening_date)}</p>
            </div>

            <div className="read-only-field">
              <label>EMI Amount</label>
              <p>₹ {Number(account.emi_amount).toFixed(2)}</p>
            </div>

            <div className="read-only-field">
              <label>EMI Cycle</label>
              <p>{account.emi_cycle} days</p>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="input-label">
                Village
                <input
                  className="input"
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="Leave empty for no village"
                />
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
