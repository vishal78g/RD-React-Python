import { useState } from 'react'
import { getEmiStatus, getPaymentTotals } from '../lib/utils'

function MarkPaidModal({ account, onConfirm, onCancel, submitting }) {
  const [quantityInput, setQuantityInput] = useState('1')

  const parsedQuantity = Number(quantityInput)
  const quantity = Number.isInteger(parsedQuantity)
    ? Math.max(1, Math.min(12, parsedQuantity))
    : 0

  const emiStatus = getEmiStatus(account.next_emi_date)
  const { baseAmount, dueAmount, totalAmount } = getPaymentTotals({
    emiAmount: account.emi_amount,
    nextEmiDate: account.next_emi_date,
    quantity
  })

  function handleQuantityChange(event) {
    const value = event.target.value

    if (value === '') {
      setQuantityInput('')
      return
    }

    if (!/^\d+$/.test(value)) return

    const numeric = Math.max(1, Math.min(12, Number(value)))
    setQuantityInput(String(numeric))
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Mark EMI as Paid</h2>
          <button className="btn-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-content">
          <p>
            <strong>Account:</strong> {account.name}
          </p>
          <p>
            <strong>EMI Amount:</strong> ₹ {Number(account.emi_amount).toFixed(2)}
          </p>
          <p>
            <strong>Pending Months:</strong> {emiStatus.status === 'PENDING' ? emiStatus.count : 0}
          </p>

          <label className="input-label">
            Number of EMIs to Mark as Paid
            <input
              className="input"
              type="number"
              min="1"
              max="12"
              value={quantityInput}
              onChange={handleQuantityChange}
            />
          </label>

          <div className="payment-summary">
            <div className="summary-row">
              <span>EMI Amount:</span>
              <span>₹ {Number(account.emi_amount).toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Number of EMIs:</span>
              <span>{quantity}</span>
            </div>
            <div className="summary-row">
              <span>EMI Total:</span>
              <span>₹ {baseAmount.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Due Amount:</span>
              <span>₹ {dueAmount.toFixed(2)}</span>
            </div>
            <div className="summary-row total">
              <span>Total Amount:</span>
              <span>₹ {totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={() => onConfirm(quantity)}
              disabled={submitting || !Number.isInteger(parsedQuantity) || quantity < 1}
            >
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
            <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarkPaidModal
