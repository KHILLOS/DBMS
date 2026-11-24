import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, ShieldQuestion } from 'lucide-react'

/** Self-hosted math captcha — server signs the question, we never see the answer. */
export default function Captcha({ value, onChange }: { value: { token: string; answer: string }, onChange: (v: { token: string; answer: string }) => void }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchNew = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/auth/captcha', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      const d = await r.json()
      setQuestion(d.question)
      onChange({ token: d.token, answer: '' })
    } catch {
      setQuestion('error — retry')
    } finally {
      setLoading(false)
    }
  }, [onChange])

  useEffect(() => { void fetchNew() }, [fetchNew])

  return (
    <div>
      <label htmlFor="captcha" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
        <ShieldQuestion size={14} color="var(--green)" /> Quick human check
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.span
          key={question}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="neu-inset"
          style={{ flex: 1.2, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15, color: 'var(--green)', letterSpacing: '0.06em', minHeight: 48 }}
          aria-live="polite"
        >
          {loading ? '…' : question}
        </motion.span>
        <input
          id="captcha"
          className="input"
          inputMode="numeric"
          placeholder="answer"
          value={value.answer}
          onChange={(e) => onChange({ ...value, answer: e.target.value })}
          required
          autoComplete="off"
          style={{ flex: 1 }}
          aria-label="Captcha answer"
        />
        <motion.button
          type="button"
          onClick={() => void fetchNew()}
          whileTap={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          className="btn-ghost"
          style={{ padding: '0 14px' }}
          aria-label="New captcha"
        >
          <RefreshCw size={16} />
        </motion.button>
      </div>
    </div>
  )
}
