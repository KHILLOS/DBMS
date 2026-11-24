import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { FileText, Trash2, Eye, Search, Image as ImageIcon, MessageSquareText, X, Server } from 'lucide-react'
import { Link } from 'react-router-dom'
import UploadCard from '../components/UploadCard'
import { EmptyState, StatusChip, Modal, Skeleton, CountUp } from '../components/ui'
import { listRow, staggerContainer, springBouncy } from '../lib/motion'
import { asList, apiGet, apiDelete, fetchFileUrl, ApiError, type Report } from '../lib/api'
import { formatDate, formatSize } from '../lib/store'
import { usePageTitle } from '../lib/usePageTitle'

export default function Reports() {
  usePageTitle('My Reports')
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [serverHits, setServerHits] = useState<Report[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState<{ report: Report; url: string | null; kind: 'image' | 'pdf' | 'none' } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Report | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = async () => {
    setLoading(true); setError('')
    try { setReports(asList(await apiGet<Report[] | { data: Report[] }>('/reports'))) } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  // Client-side fallback filter (instant, over the loaded page)
  const filtered = reports.filter((r) =>
    (r.file_name + ' ' + r.report_type).toLowerCase().includes(query.toLowerCase())
  )

  // Server-side FTS5 search for real queries (debounced 250ms, ≥2 chars) —
  // searches the user's ENTIRE locker, not just the loaded page.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setServerHits(null); setSearching(false); return }
    setSearching(true)
    const t = window.setTimeout(async () => {
      try {
        const r = await apiGet<Report[] | { data: Report[] }>(`/search/reports?q=${encodeURIComponent(q)}&limit=50`)
        setServerHits(asList(r))
      } catch {
        setServerHits(null)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => { window.clearTimeout(t) }
  }, [query])

  const visible = serverHits ?? filtered

  const openPreview = async (r: Report) => {
    setPreview({ report: r, url: null, kind: 'none' })
    setPreviewLoading(true)
    try {
      const url = await fetchFileUrl(r.id)
      const kind = r.mime === 'application/pdf' ? 'pdf' : r.mime.startsWith('image/') ? 'image' : 'none'
      setPreview({ report: r, url, kind })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not load file')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    return () => { if (preview?.url) URL.revokeObjectURL(preview.url) }
  }, [preview])

  const doDelete = async () => {
    if (!confirmDelete) return
    const id = confirmDelete.id
    setDeleting(true)
    try {
      await apiDelete(`/reports/${id}`)
      setReports((rs) => rs.filter((x) => x.id !== id))
      toast.success('Report deleted')
      setConfirmDelete(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <span className="overline">Locker</span>
        <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0 }}>My Reports</h1>
        <p className="muted" style={{ margin: '8px 0 20px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>
            Upload, preview and manage your medical reports. <strong className="font-display" style={{ color: 'var(--green)', fontSize: 15 }}><CountUp value={reports.length} /></strong> stored on the server, private to you.
          </span>
          {reports.length > 0 && (
            <span className="chip chip-green">{formatSize(reports.reduce((s, r) => s + r.size, 0))} total</span>
          )}
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 }}>
        <UploadCard onUploaded={() => void refresh()} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }} className="card" style={{ marginTop: 22, padding: '18px 20px' }}>
        <div className="neu-inset" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px', marginBottom: 10 }}>
          <Search size={16} color="var(--muted)" />
          <input
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 0', outline: 'none', fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--ink)' }}
            placeholder="Search reports by name or type…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search reports"
          />
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={15} />
            </motion.button>
          )}
        </div>
        {serverHits !== null && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
            <Server size={13} />
            {searching ? 'Searching your entire locker…' : `${serverHits.length} result${serverHits.length === 1 ? '' : 's'} from full-locker search`}
          </motion.div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0' }}>
                <Skeleton width={38} height={38} radius={12} />
                <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                  <Skeleton height={12} width="52%" />
                  <Skeleton height={10} width="34%" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Could not load reports" body={error} action={<button className="btn-soft" onClick={() => void refresh()}>Retry</button>} />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            body="Upload your first medical report above — it stays private, tied to your account on the server."
            action={<Link to="/" className="btn-soft" style={{ textDecoration: 'none' }}>Go to upload</Link>}
          />
        ) : visible.length === 0 ? (
          <EmptyState title="No matches" body={`Nothing found for “${query}”. Try a different search.`} />
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            <AnimatePresence initial={false}>
              {visible.map((r) => (
                <motion.div
                  key={r.id}
                  variants={listRow}
                  exit="exit"
                  layout
                  className={`report-row report-row-${r.mime.startsWith('image/') ? 'img' : 'pdf'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 8px', borderBottom: '1px solid var(--line)', borderRadius: 12 }}
                >
                  <motion.div className={`icon-bubble ${r.mime.startsWith('image/') ? 'violet' : ''}`} whileHover={{ rotate: -8, scale: 1.06 }} transition={springBouncy}>
                    {r.mime.startsWith('image/') ? <ImageIcon size={19} /> : <FileText size={19} />}
                  </motion.div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file_name}</p>
                    <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{r.report_type} · {formatDate(r.created_at)} · {formatSize(r.size)}</p>
                  </div>
                  <StatusChip status={r.status} />
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} className="btn-ghost" style={{ padding: '8px 12px' }} onClick={() => void openPreview(r)} aria-label={`Preview ${r.file_name}`}>
                    <Eye size={16} /> <span className="hidden sm:inline">Preview</span>
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} className="btn-danger" style={{ padding: '8px 12px' }} onClick={() => setConfirmDelete(r)} aria-label={`Delete ${r.file_name}`}>
                    <Trash2 size={16} />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>

      {/* Preview modal */}
      <Modal open={!!preview} onClose={() => { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null) }} title={preview?.report.file_name ?? 'Preview'} wide progress>
        {previewLoading && (
          <div style={{ display: 'grid', gap: 12 }} aria-busy="true">
            <Skeleton height={Math.min(320, window.innerHeight * 0.5)} radius={14} />
            <Skeleton height={13} width="42%" />
          </div>
        )}
        {preview && !previewLoading && (
          preview.kind === 'image' && preview.url ? (
            <div className="zoom-frame" style={{ border: '1px solid var(--line)' }}>
              <motion.img initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} src={preview.url} alt={preview.report.file_name} style={{ width: '100%', borderRadius: 14 }} />
            </div>
          ) : preview.kind === 'pdf' && preview.url ? (
            <motion.iframe initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={preview.url} title={preview.report.file_name} style={{ width: '100%', height: '62vh', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--page-elevated)' }} />
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>Preview is not available for this file type. The file is still stored securely on the server.</p>
          )
        )}
        {preview && (
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            {preview.report.report_type} · {formatDate(preview.report.created_at)} · {formatSize(preview.report.size)} · private to your account
          </p>
        )}
        {preview && (
          <Link to="/ask-ai" className="btn-ghost" style={{ marginTop: 14, textDecoration: 'none', display: 'inline-flex' }}>
            <MessageSquareText size={16} /> Ask AI about reports
          </Link>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => !deleting && setConfirmDelete(null)} title="Delete report?">
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 52, height: 52, margin: '2px auto 14px' }}>
            <span className="ripple-ring" style={{ borderColor: 'var(--danger)' }} />
            <div className="icon-bubble rose" style={{ width: 52, height: 52, borderRadius: 999, margin: 0 }}>
              <Trash2 size={22} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            Delete <strong>{confirmDelete?.file_name}</strong>? The file is removed from the server permanently.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</button>
            <button className="btn-danger" onClick={() => void doDelete()} disabled={deleting}>
              {deleting ? <><span className="btn-spinner" style={{ borderColor: 'rgba(179,38,30,.35)', borderTopColor: 'var(--danger)' }} aria-hidden /> Deleting…</> : <><Trash2 size={16} /> Delete</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
