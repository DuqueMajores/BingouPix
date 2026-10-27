const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SESSION_STORAGE_KEY = 'bingoupix_session_token_v1';

let sessionPromise: Promise<string> | null = null;

function readSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function createOrResumeSession(displayName: string): Promise<string> {
  const existingToken = readSessionToken();
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (existingToken) headers.set('Authorization', `Bearer ${existingToken}`);

  const response = await fetch(`${API_BASE_URL}/api/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ displayName }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.token !== 'string') {
    throw new Error(data.error || 'Não foi possível validar a sessão do jogador.');
  }

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, data.token);
  } catch {
    throw new Error('Não foi possível guardar a sessão neste navegador.');
  }
  return data.token as string;
}

export async function ensureApiSession(displayName = 'Jogador'): Promise<string> {
  if (!sessionPromise) {
    sessionPromise = createOrResumeSession(displayName).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  displayName = 'Jogador',
): Promise<Response> {
  const token = await ensureApiSession(displayName);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
