import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Sparkles, Send, Info } from 'lucide-react'
import { asList, apiGet, apiPost, type ChatMessage } from '../lib/api'
import { QUICK_QUESTIONS } from '../lib/demo'
import { TypingDots } from '../components/ui'
import { useAuth } from '../lib/auth'
import { usePageTitle } from '../lib/usePageTitle'

interface Msg { role: 'user' | 'assistant'; text: string }

export default function AskAI() {
  usePageTitle('Ask AI')
  const { user } = useAuth()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the composer as text wraps (max ~4 lines).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  useEffect(() => {
    if (!user) { setLoadingHistory(false); return }
    apiGet<ChatMessage[]>('/ai/history')
      .then((rows) => setMessages(asList(rows).map((r) => ({ role: r.role, text: r.text }))))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [user])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || typing) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setTyping(true)
    try {
      const { reply } = await apiPost<{ reply: string }>('/ai/ask', { message: q })
      setMessages((m) => [...m, { role: 'assistant', text: reply }])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
      setMessages((m) => m.slice(0, -1))
    } finally {
      setTyping(false)
    }
  }

  const allMessages: Msg[] = loadingHistory
    ? [{ role: 'assistant', text: 'Loading your archive…' }]
    : messages

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 235px)', minHeight: 420 }}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <span className="overline">Assistant</span>
        <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={22} color="var(--green)" /> Ask AI
        </h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Report summaries and health questions. History persists in your archive.</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 14, background: 'var(--mint-2)', border: '1px solid var(--line)' }}>
          <Info size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--ink)' }}>Honest demo state:</strong> I give safe placeholder answers until the AI backend is wired in. I will never invent medical findings from your files.
          </p>
        </div>
      </motion.div>

      <div className="card" style={{ flex: 1, marginTop: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!loadingHistory && messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '24px 12px' }}
            >
              <div className="icon-bubble floaty empty-orbit" style={{ width: 54, height: 54, margin: '0 auto 16px', borderRadius: 18 }}>
                <Sparkles size={22} />
              </div>
              <p className="font-display" style={{ fontWeight: 700, fontSize: 16.5, margin: 0 }}>
                Hi{user ? `, ${user.name.split(' ')[0]}` : ''} — I'm your health assistant
              </p>
              <p className="muted" style={{ fontSize: 13.5, maxWidth: 400, margin: '8px 0 0', lineHeight: 1.6 }}>
                Ask about lab terms or how to read a report. I stay honest in demo mode — I never invent findings until a real AI service is connected.
              </p>
            </motion.div>
          ) : allMessages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}
            >
              {m.role === 'assistant' && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                  className="icon-bubble"
                  style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, marginBottom: 2 }}
                  aria-hidden
                >
                  <Sparkles size={13} />
                </motion.div>
              )}
              <div
                className={m.role === 'assistant' && i === allMessages.length - 1 && !loadingHistory ? 'msg-glow' : undefined}
                style={{
                  maxWidth: '85%', padding: '12px 15px', borderRadius: 16, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-line',
                  background: m.role === 'user' ? 'var(--btn-grad)' : 'var(--mint-2)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink)',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                  borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                  border: m.role === 'user' ? 'none' : '1px solid var(--line)',
                  boxShadow: m.role === 'user' ? '0 8px 18px -10px var(--green-glow)' : 'none',
                }}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
          {typing && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div className="icon-bubble" style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0 }} aria-hidden>
                <Sparkles size={13} />
              </div>
              <div style={{ padding: '13px 18px', borderRadius: 16, borderBottomLeftRadius: 4, background: 'var(--mint-2)', border: '1px solid var(--line)', fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!loadingHistory && messages.length === 0 && (
          <div style={{ padding: '0 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <motion.button
                key={q}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.3, ease: 'easeOut' }}
                whileHover={{ y: -2, scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="btn-soft"
                style={{ fontSize: 12.5, padding: '8px 12px', borderRadius: 999 }}
                onClick={() => void send(q)}
              >
                {q}
              </motion.button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); void send(input) }}
          style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid var(--line)', background: 'var(--mint-2)', alignItems: 'flex-end' }}
        >
          <textarea
            ref={inputRef}
            className="input"
            rows={1}
            placeholder={user ? 'Ask about a lab term or how to read a report…' : 'Sign in to ask questions (your history is saved)…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) }
            }}
            aria-label="Ask the assistant"
            disabled={!user}
            style={{ resize: 'none', minHeight: 46, maxHeight: 120, lineHeight: 1.5 }}
          />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }} className="btn-primary" type="submit" disabled={!input.trim() || typing || !user} aria-label="Send message" style={{ padding: '13px 18px', borderRadius: 14, height: 46 }}>
            <Send size={17} />
          </motion.button>
        </form>
      </div>
    </div>
  )
}
