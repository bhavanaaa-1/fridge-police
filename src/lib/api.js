const BASE_URL = "/api";

export function getToken() {
  const token = sessionStorage.getItem("fridgepolice_token");
  return token && token !== "undefined" && token !== "null" ? token : null;
}

export function setToken(token) {
  if (token && token !== "undefined" && token !== "null") {
    sessionStorage.setItem("fridgepolice_token", token);
  } else {
    sessionStorage.removeItem("fridgepolice_token");
  }
}

export function clearToken() {
  sessionStorage.removeItem("fridgepolice_token");
}

export async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    clearToken();
    const error = new Error(data?.message || "Your session has expired. Please log in again.");
    error.status = 401;
    if (Array.isArray(data?.errors)) {
      error.fieldErrors = data.errors;
    }
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;
    if (Array.isArray(data?.errors)) {
      error.fieldErrors = data.errors;
    }
    throw error;
  }

  return data;
}