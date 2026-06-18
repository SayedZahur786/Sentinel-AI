const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export const api = {
  dashboard: () => request("/analytics/dashboard"),
  moderate: (payload) => request("/moderations", { method: "POST", body: JSON.stringify(payload) }),
  moderations: (limit = 100) => request(`/moderations?limit=${limit}`),
  policies: () => request("/policies"),
  updatePolicy: (slug, payload) =>
    request(`/policies/${slug}`, { method: "PUT", body: JSON.stringify(payload) }),
  reviews: (status = "") => request(`/reviews?status=${status}`),
  decideReview: (id, payload) =>
    request(`/reviews/${id}/decision`, { method: "POST", body: JSON.stringify(payload) }),
  samples: () => request("/evaluation/samples"),
  evaluate: (payload) => request("/evaluation/run", { method: "POST", body: JSON.stringify(payload) }),
}

