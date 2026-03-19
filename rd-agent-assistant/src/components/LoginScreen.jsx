import { useState } from 'react'

function LoginScreen({ onLogin, authError }) {
  const [pin, setPin] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onLogin(pin)
  }

  function handlePinChange(event) {
    const value = event.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(value)
  }

  return (
    <div className="login-wrapper">
      <article className="card login-card">
        <h2 className="screen-title">RD Agent Assistant</h2>
        <p className="muted">Enter 4-digit PIN to continue</p>

        <form className="form-card" onSubmit={handleSubmit}>
          <label className="input-label">
            PIN
            <input
              className="input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={handlePinChange}
              required
            />
          </label>

          {authError ? <p className="error-text">⚠ {authError}</p> : null}

          <button className="btn btn-primary" type="submit" disabled={pin.length !== 4}>
            Login
          </button>
        </form>
      </article>
    </div>
  )
}

export default LoginScreen
