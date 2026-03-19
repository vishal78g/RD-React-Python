function PaymentConfirmationModal({ account, quantity, totalAmount, onClose }) {
  const emiAmount = Number(account.emi_amount)

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>✓ Payment Recorded</h2>
        </div>

        <div className="modal-content">
          <div className="confirmation-message">
            <p className="success-text">Payment successfully recorded!</p>

            <div className="confirmation-details">
              <p>
                <strong>Account:</strong> {account.name}
              </p>
              <p>
                <strong>EMI Amount:</strong> ₹ {emiAmount.toFixed(2)}
              </p>
              <p>
                <strong>Number of EMIs:</strong> {quantity}
              </p>
              <p>
                <strong>Total Amount:</strong> ₹ {totalAmount.toFixed(2)}
              </p>
              <p>
                <strong>Payment Date:</strong> {new Date().toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentConfirmationModal
