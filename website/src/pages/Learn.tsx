import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, BookOpen, Clock, X, Droplet, FlaskConical, HeartPulse, MoonStar, Activity, Leaf, type LucideIcon } from 'lucide-react'
import { Modal, EmptyState, useTilt } from '../components/ui'
import { DEMO_ARTICLES, type DemoArticle } from '../lib/demo'
import { usePageTitle } from '../lib/usePageTitle'

const CATS = ['All', 'Wellness', 'Lab reports'] as const

/** Cover art per article — theme-aware gradient bands with a watermark icon. */
const COVERS: { cls: string; icon: LucideIcon }[] = [
  { cls: 'cover-0', icon: Droplet },
  { cls: 'cover-1', icon: FlaskConical },
  { cls: 'cover-2', icon: HeartPulse },
  { cls: 'cover-3', icon: MoonStar },
  { cls: 'cover-4', icon: Activity },
  { cls: 'cover-5', icon: Leaf },
]

/** Article card with 3D tilt + mouse spotlight (desktop, motion-safe). */
function ArticleCard({ article: a, index, onOpen }: { article: DemoArticle; index: number; onOpen: (a: DemoArticle) => void }) {
  const { tiltRef, tiltBind, tiltStyle } = useTilt<HTMLButtonElement>()
  const cover = COVERS[index % COVERS.length]
  const Icon = cover.icon
  return (
    <motion.button
      ref={tiltRef}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05 }}
      {...tiltBind}
      className="card card-glow spotlight"
      style={{ padding: 18, textAlign: 'left', width: '100%', position: 'relative', overflow: 'hidden', ...tiltStyle }}
      whileHover={{ y: -6, boxShadow: 'var(--shadow-lift)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onOpen(a)}
    >
      <div className={`article-cover ${cover.cls}`} aria-hidden>
        <Icon size={30} strokeWidth={1.8} />
        <span className="article-cover-tag">{a.category}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="chip chip-green">{a.category}</span>
        <span className="chip chip-gray"><Clock size={11} /> {a.minutes} min</span>
      </div>
      <p className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: 15, lineHeight: 1.4 }}>{a.title}</p>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55 }}>{a.excerpt}</p>
      <span className="nudge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>
        <BookOpen size={14} /> Read article
      </span>
    </motion.button>
  )
}

export default function Learn() {
  usePageTitle('Health Library')
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const [reading, setReading] = useState<DemoArticle | null>(null)

  const filtered = DEMO_ARTICLES.filter((a) => {
    const matchesCat = cat === 'All' || a.category === cat
    const matchesQuery = (a.title + ' ' + a.category + ' ' + a.excerpt).toLowerCase().includes(query.toLowerCase())
    return matchesCat && matchesQuery
  })

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <span className="overline">Library</span>
        <h1 className="section-title" style={{ fontSize: '1.5rem', margin: 0 }}>Health Library</h1>
        <p className="muted" style={{ margin: '8px 0 18px', fontSize: 14 }}>
          Plain-language health articles. <span className="chip chip-amber" style={{ verticalAlign: 'middle' }}>Demo content</span>
        </p>

        <div className="neu-inset" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px', marginBottom: 14 }}>
          <Search size={16} color="var(--muted)" />
          <input
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 0', outline: 'none', fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--ink)' }}
            placeholder="Search articles — e.g. vitamin D, blood pressure…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search health articles"
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

        {/* Category filter with animated pill + live counts */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{ position: 'relative', border: 'none', background: 'transparent', padding: '8px 16px', borderRadius: 999, fontWeight: 600, fontSize: 13, color: cat === c ? '#fff' : 'var(--muted)', transition: 'color .2s ease', fontFamily: 'Inter, sans-serif' }}
              aria-pressed={cat === c}
            >
              {cat === c && (
                <motion.span
                  layoutId="learn-cat-pill"
                  style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--btn-grad)', boxShadow: '0 6px 14px -6px var(--green-glow)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {c}
                <span style={{ opacity: 0.65, fontSize: 11.5, marginLeft: 4 }} aria-hidden>
                  {c === 'All' ? DEMO_ARTICLES.length : DEMO_ARTICLES.filter((a) => a.category === c).length}
                </span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState title="Nothing found" body={`No articles match “${query}”.`} /></div>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
          {filtered.map((a, i) => (
            <ArticleCard key={a.id} article={a} index={i} onOpen={setReading} />
          ))}
        </div>
      )}

      <Modal open={!!reading} onClose={() => setReading(null)} title={reading?.title ?? ''} wide progress>
        {reading && (
          <article className="article-body">
            <div className={`article-cover article-cover-flush cover-${DEMO_ARTICLES.findIndex((x) => x.id === reading.id) % 6}`} aria-hidden>
              {(() => {
                const Icon = COVERS[DEMO_ARTICLES.findIndex((x) => x.id === reading.id) % COVERS.length].icon
                return <Icon size={34} strokeWidth={1.8} />
              })()}
              <span className="article-cover-tag">{reading.category}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className="chip chip-green">{reading.category}</span>
              <span className="chip chip-gray"><Clock size={11} /> {reading.minutes} min read</span>
              <span className="chip chip-amber">Demo content</span>
            </div>
            {reading.body.map((p, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.35, ease: 'easeOut' }}
                style={{ fontSize: 14.5, lineHeight: 1.75, margin: '0 0 14px' }}
              >
                {p}
              </motion.p>
            ))}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + reading.body.length * 0.08 }}
              className="muted"
              style={{ fontSize: 12.5, borderTop: '1px solid var(--line)', paddingTop: 12, margin: '18px 0 0' }}
            >
              Educational demo content. Always confirm health decisions with a qualified doctor.
            </motion.p>
          </article>
        )}
      </Modal>
    </div>
  )
}
