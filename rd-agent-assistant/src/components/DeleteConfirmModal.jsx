function DeleteConfirmModal({ accountName, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Delete Account</h2>
        <p>
          Are you sure you want to delete <strong>{accountName}</strong>? This action cannot be undone.
        </p>
        <p className="warning-text">All related EMI collection records will also be deleted.</p>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={onConfirm}>
            Yes, Delete
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
