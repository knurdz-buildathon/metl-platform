const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details ?? null;
  }
}

async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('metl_access_token');
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Try to refresh token
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiFetch(path, options);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('metl_access_token');
      window.location.href = '/signin';
    }
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error?.message || res.statusText,
      data?.error?.code || `ERR_${res.status}`,
      res.status,
      data?.error?.details
    );
  }

  return data as T;
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('metl_access_token', data.accessToken);
      return true;
    }
  } catch {
    // silent fail
  }
  return false;
}

export function setAccessToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('metl_access_token', token);
  }
}

export function removeAccessToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('metl_access_token');
  }
}
