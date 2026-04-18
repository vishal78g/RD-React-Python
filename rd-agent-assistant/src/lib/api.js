const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
let authTokenProvider = null

export function setApiAuthTokenProvider(provider) {
  authTokenProvider = typeof provider === 'function' ? provider : null
}

function withBase(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

async function request(path, options = {}) {
  const maybeToken = authTokenProvider ? authTokenProvider() : ''
  const authHeaders = maybeToken ? { Authorization: `Bearer ${maybeToken}` } : {}

  let response
  try {
    response = await fetch(withBase(path), {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {})
      },
      ...options
    })
  } catch {
    throw new Error(
      'Backend API is unreachable. Start backend and verify Supabase backend env settings.'
    )
  }

  if (response.status === 204) {
    return null
  }

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(payload.error || 'Unauthorized. Please login again.')
    }
    throw new Error(payload.error || 'Request failed.')
  }

  return payload
}

export const api = {
  async loginWithPin(pin) {
    return request('/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({ pin })
    })
  },

  async getBootstrap({ month, year, today }) {
    const query = new URLSearchParams({
      month: String(month),
      year: String(year),
      today
    })

    return request(`/bootstrap?${query.toString()}`)
  },

  async addAccount(payload) {
    const result = await request('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    return result.data
  },

  async updateAccount(id, payload) {
    const result = await request(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })

    return result.data
  },

  async deleteAccount(id) {
    await request(`/accounts/${id}`, {
      method: 'DELETE'
    })
  },

  async addVillage(villageName) {
    const result = await request('/villages', {
      method: 'POST',
      body: JSON.stringify({ village_name: villageName })
    })

    return result.data
  },

  async updateVillage(id, villageName) {
    const result = await request(`/villages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ village_name: villageName })
    })

    return result.data
  },

  async deleteVillage(id) {
    await request(`/villages/${id}`, {
      method: 'DELETE'
    })
  },

  async addCollection(payload) {
    const result = await request('/emi-collections', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    return result.data
  },

  async getMonthlyCollections(month, year) {
    const query = new URLSearchParams({ month: String(month), year: String(year) })
    const result = await request(`/emi-collections/monthly?${query.toString()}`)
    return result.data || []
  },

  async getDailyCollections(date) {
    const query = new URLSearchParams({ date })
    const result = await request(`/emi-collections/daily?${query.toString()}`)
    return result.data || []
  },

  async deleteCollectionsByIds(ids) {
    const result = await request('/emi-collections/delete-by-ids', {
      method: 'POST',
      body: JSON.stringify({ ids })
    })

    return result.data || []
  }
}
