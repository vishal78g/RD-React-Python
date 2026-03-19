import { useState } from 'react'

const initialForm = {
  name: '',
  village: '',
  phone: '',
  emiAmount: '',
  emiCycle: '15'
}

function AddAccountScreen({ onAddAccount, submitting }) {
  const [form, setForm] = useState(initialForm)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await onAddAccount({
      name: form.name.trim(),
      village: form.village.trim(),
      phone: form.phone.trim(),
      emi_amount: Number(form.emiAmount),
      emi_cycle: Number(form.emiCycle)
    })
    setForm(initialForm)
  }

  return (
    <section>
      <h2 className="screen-title">Add Account</h2>
      <form className="card form-card" onSubmit={handleSubmit}>
        <label className="input-label">
          Name
          <input
            className="input"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </label>

        <label className="input-label">
          Village
          <input
            className="input"
            type="text"
            name="village"
            value={form.village}
            onChange={handleChange}
            required
          />
        </label>

        <label className="input-label">
          Mobile Number
          <input
            className="input"
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="10-digit mobile"
          />
        </label>

        <label className="input-label">
          EMI Amount
          <input
            className="input"
            type="number"
            name="emiAmount"
            value={form.emiAmount}
            onChange={handleChange}
            min="1"
            required
          />
        </label>

        <label className="input-label">
          EMI Cycle
          <select
            className="input"
            name="emiCycle"
            value={form.emiCycle}
            onChange={handleChange}
            required
          >
            <option value="15">15</option>
            <option value="30">30</option>
          </select>
        </label>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Submit'}
        </button>
      </form>
    </section>
  )
}

export default AddAccountScreen
