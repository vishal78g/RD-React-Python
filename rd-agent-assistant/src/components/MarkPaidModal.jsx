import { useState } from 'react'

function MarkPaidModal({ account, onConfirm, onCancel, submitting }) {
  const [quantity, setQuantity] = useState(1)
  const totalAmount = Number(account.emi_amount) * quantity

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

          <label className="input-label">
            Number of EMIs to Mark as Paid
            <input
              className="input"
              type="number"
              min="1"
              max="12"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(12, Number(e.target.value))))}
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
            <div className="summary-row total">
              <span>Total Amount:</span>
              <span>₹ {totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={() => onConfirm(quantity)}
              disabled={submitting || quantity < 1}
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
