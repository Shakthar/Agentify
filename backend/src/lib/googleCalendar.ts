/**
 * Google Calendar integration — OAuth 2.0 + Calendar API helpers.
 * Tokens são encriptados com AES-256-GCM antes de serem guardados na DB.
 */
import { encrypt, decrypt } from './encryption.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

const clientId = () => process.env.GOOGLE_CLIENT_ID ?? '';
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET ?? '';
const redirectUri = () => process.env.GOOGLE_REDIRECT_URI ?? '';
const masterKey = () => process.env.ENCRYPTION_MASTER_KEY ?? '';

export function isConfigured(): boolean {
  return !!(clientId() && clientSecret() && redirectUri());
}

// ── OAuth URL ────────────────────────────────────────────────────────────────

export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

// ── Token exchange / refresh ─────────────────────────────────────────────────

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  email: string;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data = await resp.json() as Record<string, unknown>;
  if (!data.access_token) {
    throw new Error(`Google OAuth token exchange failed: ${JSON.stringify(data)}`);
  }
  // Fetch user email
  const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const user = await userResp.json() as Record<string, unknown>;
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    email: (user.email as string) ?? '',
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json() as Record<string, unknown>;
  if (!data.access_token) {
    throw new Error(`Google OAuth token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

// ── Token storage helpers ────────────────────────────────────────────────────

/** Serializa e encripta { refreshToken, email } para guardar na DB */
export function encryptCalendarToken(refreshToken: string, email: string): string {
  const payload = JSON.stringify({ refreshToken, email });
  if (!masterKey()) return payload; // fallback sem encriptação (dev/sem chave)
  const { ciphertext, iv } = encrypt(payload, masterKey());
  return JSON.stringify({ ciphertext, iv });
}

/** Desencripta o calendarToken guardado na DB */
export function decryptCalendarToken(stored: string): { refreshToken: string; email: string } {
  const parsed = JSON.parse(stored) as Record<string, string>;
  if (!parsed.ciphertext) return parsed as { refreshToken: string; email: string }; // não encriptado
  const plaintext = decrypt(parsed.ciphertext, parsed.iv, masterKey());
  return JSON.parse(plaintext);
}

// ── Calendar API ─────────────────────────────────────────────────────────────

export interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end:   { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
}

export interface CreatedEvent {
  id: string;
  htmlLink: string;
  summary: string;
  start: Record<string, string>;
  end:   Record<string, string>;
}

export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent,
): Promise<CreatedEvent> {
  const resp = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    },
  );
  const data = await resp.json() as Record<string, unknown>;
  if (!resp.ok) throw new Error(`Google Calendar createEvent failed: ${JSON.stringify(data)}`);
  return {
    id: data.id as string,
    htmlLink: data.htmlLink as string,
    summary: data.summary as string,
    start: data.start as Record<string, string>,
    end:   data.end   as Record<string, string>,
  };
}

export async function listUpcomingEvents(
  accessToken: string,
  calendarId: string,
  maxResults = 10,
): Promise<Array<Record<string, unknown>>> {
  const timeMin = new Date().toISOString();
  const params = new URLSearchParams({
    timeMin,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const resp = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await resp.json() as Record<string, unknown>;
  return (data.items as Array<Record<string, unknown>>) ?? [];
}

/**
 * Obtém um access token válido a partir do calendarToken guardado na DB.
 * Faz refresh automático se necessário.
 */
export async function getAccessToken(calendarTokenStored: string): Promise<string> {
  const { refreshToken } = decryptCalendarToken(calendarTokenStored);
  return refreshAccessToken(refreshToken);
}
