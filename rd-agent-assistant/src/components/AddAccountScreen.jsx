import { useState, useEffect } from 'react'
import { calculateEmiCycle, calculateNextEmiDate, toIsoDate } from '../lib/utils'

const initialForm = {
  accountNumber: '',
  name: '',
  village: '',
  phone: '',
  emiAmount: '',
  accountOpeningDate: '',
  emiCycle: '15'
}

function AddAccountScreen({ onAddAccount, onUpdateAccount, submitting, editingAccount, onCancel }) {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (editingAccount) {
      setForm({
        accountNumber: editingAccount.account_number || '',
        name: editingAccount.name || '',
        village: editingAccount.village || '',
        phone: editingAccount.phone || '',
        emiAmount: editingAccount.emi_amount || '',
        accountOpeningDate: editingAccount.account_opening_date || '',
        emiCycle: String(editingAccount.emi_cycle || '15')
      })
    } else {
      setForm(initialForm)
    }
    setErrors({})
  }, [editingAccount])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))

    // Auto-calculate EMI cycle if opening date changes
    if (name === 'accountOpeningDate' && value) {
      const cycle = calculateEmiCycle(value)
      setForm((prev) => ({ ...prev, emiCycle: String(cycle) }))
    }
  }

  function validateForm() {
    const newErrors = {}

    if (!form.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required'
    }

    if (!form.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!form.emiAmount || Number(form.emiAmount) <= 0) {
      newErrors.emiAmount = 'EMI amount must be greater than 0'
    }

    if (!form.accountOpeningDate) {
      newErrors.accountOpeningDate = 'Account opening date is required'
    } else {
      const openingDate = new Date(form.accountOpeningDate)
      if (openingDate > new Date()) {
        newErrors.accountOpeningDate = 'Opening date cannot be in the future'
      }
    }

    if (form.phone && !/^(0|\d{10})$/.test(String(form.phone).trim())) {
      newErrors.phone = 'Phone must be 0 or 10-digit number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    const nextEmiDate = calculateNextEmiDate(form.accountOpeningDate, Number(form.emiCycle))

    const payload = {
      account_number: form.accountNumber.trim(),
      name: form.name.trim(),
      village: form.village.trim() || '',
      phone: form.phone.trim() || '0',
      emi_amount: Number(form.emiAmount),
      account_opening_date: form.accountOpeningDate,
      emi_cycle: Number(form.emiCycle),
      next_emi_date: toIsoDate(nextEmiDate),
      month_paid_upto: editingAccount?.month_paid_upto || 0
    }

    if (editingAccount) {
      await onUpdateAccount(editingAccount.id, payload)
    } else {
      await onAddAccount(payload)
    }

    setForm(initialForm)
  }

  return (
    <section>
      <div className="screen-header">
        <h2 className="screen-title">{editingAccount ? 'Edit Account' : 'Add Account'}</h2>
        {editingAccount && (
          <button className="btn btn-close" onClick={onCancel} title="Cancel">
            ✕
          </button>
        )}
      </div>

      <form className="card form-card" onSubmit={handleSubmit}>
        <label className="input-label">
          Account Number
          <input
            className={`input ${errors.accountNumber ? 'input-error' : ''}`}
            type="text"
            name="accountNumber"
            value={form.accountNumber}
            onChange={handleChange}
            placeholder="e.g., ACC001"
            readOnly={!!editingAccount}
          />
          {errors.accountNumber && <span className="error-small">{errors.accountNumber}</span>}
        </label>

        <label className="input-label">
          Name
          <input
            className={`input ${errors.name ? 'input-error' : ''}`}
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
          {errors.name && <span className="error-small">{errors.name}</span>}
        </label>

        <label className="input-label">
          Account Opening Date
          <input
            className={`input ${errors.accountOpeningDate ? 'input-error' : ''}`}
            type="date"
            name="accountOpeningDate"
            value={form.accountOpeningDate}
            onChange={handleChange}
            required
          />
          {errors.accountOpeningDate && (
            <span className="error-small">{errors.accountOpeningDate}</span>
          )}
        </label>

        <label className="input-label">
          Village
          <input
            className="input"
            type="text"
            name="village"
            value={form.village}
            onChange={handleChange}
            placeholder="Leave empty for no village"
          />
        </label>

        <label className="input-label">
          Mobile Number
          <input
            className={`input ${errors.phone ? 'input-error' : ''}`}
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="10-digit or 0"
          />
          {errors.phone && <span className="error-small">{errors.phone}</span>}
        </label>

        <label className="input-label">
          Monthly EMI Amount
          <input
            className={`input ${errors.emiAmount ? 'input-error' : ''}`}
            type="number"
            name="emiAmount"
            value={form.emiAmount}
            onChange={handleChange}
            min="1"
            step="0.01"
            required
          />
          {errors.emiAmount && <span className="error-small">{errors.emiAmount}</span>}
        </label>

        <label className="input-label">
          EMI Cycle (Auto-calculated)
          <input
            className="input"
            type="text"
            value={`${form.emiCycle} days`}
            disabled
          />
        </label>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : editingAccount ? 'Update' : 'Add'}
          </button>
          {editingAccount && (
            <button className="btn btn-secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

export default AddAccountScreen
