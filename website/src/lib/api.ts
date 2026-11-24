/* API client — cookie sessions, CSRF header, JSON everywhere.
   Uploads use XHR so real progress bars work. */

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
  })
  const data = (await r.json().catch(() => ({}))) as T & { error?: string }
  if (!r.ok) throw new ApiError(data.error ?? `Request failed (${r.status})`, r.status)
  return data
}

export const apiGet = <T>(path: string) => request<T>(path)
export const apiPost = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
export const apiPut = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
export const apiPatch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const apiDelete = <T>(path: string) => request<T>(path, { method: 'DELETE' })

/* Real upload progress via XHR (fetch has no upload progress events) */
export function uploadReport(file: File, onProgress: (pct: number) => void): Promise<Report> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/reports')
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) resolve(data as Report)
        else reject(new ApiError(data.error ?? 'Upload failed', xhr.status))
      } catch {
        reject(new ApiError('Upload failed', xhr.status))
      }
    }
    xhr.onerror = () => reject(new ApiError('Network error during upload', 0))
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

/** Fetch a protected file with the session cookie and return an object URL. Caller revokes it. */
export async function fetchFileUrl(id: string): Promise<string> {
  const r = await fetch(`/api/reports/${id}/file`, { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
  if (!r.ok) throw new ApiError('Could not load file', r.status)
  return URL.createObjectURL(await r.blob())
}

/* ---------- shared types ---------- */

/** Backend lists may arrive as a bare array or a paginated { data: [...] }
    envelope. Normalize at the boundary so pages always consume an array. */
export function asList<T>(r: T[] | { data?: T[] } | null | undefined): T[] {
  if (Array.isArray(r)) return r
  const d = (r as { data?: T[] } | null | undefined)?.data
  return Array.isArray(d) ? d : []
}
export interface User {
  id: number
  email: string
  name: string
  phone: string
  age: string
  role: 'user' | 'admin'
  created_at: string
  last_login: string | null
}

export interface Report {
  id: string
  file_name: string
  mime: string
  size: number
  report_type: string
  status: string
  created_at: string
  user_id?: number
  user_name?: string
  user_email?: string
}

export interface ConsultRequest {
  id: number
  user_id: number
  doctor_id: string
  doctor_name: string
  date: string
  time: string
  reason: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  created_at: string
  user_name?: string
  user_email?: string
}

export interface NotificationRow {
  id: number
  title: string
  body: string
  read: number
  created_at: string
}

export interface AdminStats {
  users: number
  admins: number
  reports: number
  storageBytes: number
  consults: number
  notifications: number
  aiMessages: number
}

export interface AuditRow {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  detail: string
  ip: string
  created_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  created_at?: string
}
