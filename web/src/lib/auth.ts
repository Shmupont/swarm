const TOKEN_KEY = "swarm_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function checkAuth(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
