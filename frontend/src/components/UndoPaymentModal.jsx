function UndoPaymentModal({ accountName, paymentAmount, emisPaid, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Undo Payment</h2>
        <p>
          Are you sure you want to undo the payment for <strong>{accountName}</strong>?
        </p>
        <div className="modal-info">
          <p>
            Total Amount: <strong>₹ {Number(paymentAmount).toFixed(2)}</strong>
          </p>
          {emisPaid > 1 && (
            <p>
              This will undo <strong>{emisPaid} EMIs</strong> collected today for this account.
            </p>
          )}
        </div>
        <p className="warning-text">This will permanently remove the payment record.</p>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={onConfirm}>
            Yes, Undo
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default UndoPaymentModal
