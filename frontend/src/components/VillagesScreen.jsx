import { useState } from 'react'

function VillagesScreen({
  villages,
  submitting,
  onAddVillage,
  onUpdateVillage,
  onDeleteVillage,
  onClose
}) {
  const [newVillageName, setNewVillageName] = useState('')
  const [editingVillageId, setEditingVillageId] = useState(null)
  const [editingVillageName, setEditingVillageName] = useState('')
  const [villageToDelete, setVillageToDelete] = useState(null)

  async function handleAddVillageSubmit(event) {
    event.preventDefault()
    const success = await onAddVillage(newVillageName)
    if (success) {
      setNewVillageName('')
    }
  }

  function handleStartEdit(village) {
    setEditingVillageId(village.id)
    setEditingVillageName(village.village_name)
  }

  function handleCancelEdit() {
    setEditingVillageId(null)
    setEditingVillageName('')
  }

  async function handleSaveEdit(village) {
    const success = await onUpdateVillage(village.id, village.village_name, editingVillageName)
    if (success) {
      handleCancelEdit()
    }
  }

  async function handleConfirmDelete() {
    if (!villageToDelete) return

    const success = await onDeleteVillage(villageToDelete)
    if (success) {
      setVillageToDelete(null)
    }
  }

  return (
    <section>
      <div className="screen-header">
        <h2 className="screen-title">Villages</h2>
        <button className="btn btn-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      <form className="card village-form-card" onSubmit={handleAddVillageSubmit}>
        <label className="input-label">
          Add Village
          <div className="village-form-row">
            <input
              className="input"
              type="text"
              placeholder="Enter village name"
              value={newVillageName}
              onChange={(event) => setNewVillageName(event.target.value)}
              disabled={submitting}
            />
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add'}
            </button>
          </div>
        </label>
      </form>

      {villages.length === 0 ? (
        <p className="empty">No villages found.</p>
      ) : (
        <div className="list-stack">
          {villages.map((village) => {
            const isEditing = editingVillageId === village.id
            const linkedCount = Number(village.accountsCount || 0)
            const hasDatabaseRow = Boolean(village.id)
            const canDelete = hasDatabaseRow && linkedCount === 0

            return (
              <article className="card village-card" key={village.id}>
                <div className="village-card-top">
                  {isEditing ? (
                    <input
                      className="input"
                      type="text"
                      value={editingVillageName}
                      onChange={(event) => setEditingVillageName(event.target.value)}
                      disabled={submitting}
                    />
                  ) : (
                    <h3>{village.village_name}</h3>
                  )}
                  <span className="village-count-chip">Accounts: {linkedCount}</span>
                </div>

                <div className="village-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => handleSaveEdit(village)}
                        disabled={submitting}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => handleStartEdit(village)}
                        disabled={!hasDatabaseRow || submitting}
                        title={!hasDatabaseRow ? 'This village is from accounts data only. Add it to villages table first.' : 'Edit village'}
                      >
                        Edit
                      </button>
                      {canDelete ? (
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => setVillageToDelete(village)}
                          disabled={submitting}
                          title="Delete village"
                        >
                          Delete
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {villageToDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Delete Village</h2>
            <p>
              Are you sure you want to delete <strong>{villageToDelete.village_name}</strong>?
            </p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={submitting}>
                {submitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button className="btn btn-secondary" onClick={() => setVillageToDelete(null)} disabled={submitting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default VillagesScreen
