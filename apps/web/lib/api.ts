const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://baqsha-worker.nurbakhyt.workers.dev";

export async function apiFetch(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res.json();
}
