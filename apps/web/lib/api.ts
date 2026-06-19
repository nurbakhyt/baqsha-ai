const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://baqsha-worker.nurbakhyt.workers.dev";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("baqsha_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("baqsha_token", token);
  } else {
    localStorage.removeItem("baqsha_token");
  }
}

export async function apiFetch(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  return res.json();
}
