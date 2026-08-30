'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, Tag, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme.store';
import glossaryData from '@/data/glossary.json';

// ── Category icon colours ────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'Platform':              '#00f0ff',
  'Blockchain & Crypto':   '#f59e0b',
  'Fraud Typologies':      '#f87171',
  'Investigation Pipeline':'#a78bfa',
  'Legal & Compliance':    '#34d399',
  'Technology & APIs':     '#60a5fa',
  'Dashboard Pages':       '#fb923c',
};

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  key:          { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
  government:   { bg: 'rgba(16,185,129,0.12)',  text: '#34d399' },
  blockchain:   { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  fraud:        { bg: 'rgba(248,113,113,0.12)', text: '#f87171' },
  pattern:      { bg: 'rgba(239,68,68,0.12)',   text: '#fb923c' },
  pipeline:     { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa' },
  algorithm:    { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
  legal:        { bg: 'rgba(52,211,153,0.12)',  text: '#34d399' },
  compliance:   { bg: 'rgba(16,185,129,0.12)',  text: '#6ee7b7' },
  tech:         { bg: 'rgba(96,165,250,0.12)',  text: '#60a5fa' },
  database:     { bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24' },
  auth:         { bg: 'rgba(139,92,246,0.12)',  text: '#c4b5fd' },
  api:          { bg: 'rgba(6,182,212,0.12)',   text: '#22d3ee' },
  intelligence: { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c' },
  ui:           { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' },
  admin:        { bg: 'rgba(239,68,68,0.12)',   text: '#fca5a5' },
  platform:     { bg: 'rgba(0,240,255,0.10)',   text: '#00f0ff' },
  core:         { bg: 'rgba(0,255,136,0.10)',   text: '#00ff88' },
};

function TagBadge({ tag }: { tag: string }) {
  const c = TAG_COLORS[tag] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
      padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase',
    }}>
      {tag}
    </span>
  );
}

function GlossaryCard({ item, isDark }: { item: any; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      style={{
        background: isDark ? '#111827' : '#ffffff',
        border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Abbreviation box */}
        <div style={{
          minWidth: 70, padding: '4px 8px', borderRadius: 6, textAlign: 'center',
          background: isDark ? '#1a1e2f' : '#f1f5f9',
          border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: '#00f0ff', letterSpacing: 0.5 }}>
            {item.abbr}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b' }}>
              {item.full}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {item.tags?.map((t: string) => <TagBadge key={t} tag={t} />)}
            </div>
          </div>
          {!open && (
            <p style={{ fontSize: 12, color: isDark ? '#64748b' : '#94a3b8', marginTop: 4, lineHeight: 1.5 }}
              className="line-clamp-1">
              {item.description}
            </p>
          )}
        </div>

        <div style={{ color: isDark ? '#475569' : '#cbd5e1', flexShrink: 0, marginTop: 2 }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 18px 16px 102px',
              borderTop: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
              paddingTop: 12,
            }}>
              <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#475569', lineHeight: 1.7 }}>
                {item.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CategorySection({ category, items, isDark, searchQuery }: {
  category: string; items: any[]; isDark: boolean; searchQuery: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const color = CATEGORY_COLORS[category] || '#94a3b8';

  const filtered = items.filter(item =>
    !searchQuery ||
    item.abbr.toLowerCase().includes(searchQuery) ||
    item.full.toLowerCase().includes(searchQuery) ||
    item.description.toLowerCase().includes(searchQuery) ||
    item.tags?.some((t: string) => t.toLowerCase().includes(searchQuery))
  );

  if (filtered.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Category header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
          padding: 0,
        }}
      >
        <div style={{ width: 3, height: 20, borderRadius: 2, background: color }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: color, letterSpacing: 0.3 }}>
          {category}
        </h2>
        <span style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', fontFamily: 'monospace', marginLeft: 4 }}>
          ({filtered.length} terms)
        </span>
        <div style={{ marginLeft: 'auto', color: isDark ? '#475569' : '#cbd5e1' }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {filtered.map(item => (
              <GlossaryCard key={item.abbr} item={item} isDark={isDark} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GlossaryPage() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const query = search.toLowerCase().trim();

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    glossaryData.forEach(cat => cat.items.forEach(item => item.tags?.forEach((t: string) => tags.add(t))));
    return Array.from(tags).sort();
  }, []);

  const totalTerms = glossaryData.reduce((sum, cat) => sum + cat.items.length, 0);

  const filteredData = useMemo(() => {
    return glossaryData.map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        const matchesTag = !activeTag || item.tags?.includes(activeTag);
        const matchesSearch = !query ||
          item.abbr.toLowerCase().includes(query) ||
          item.full.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags?.some((t: string) => t.toLowerCase().includes(query));
        return matchesTag && matchesSearch;
      }),
    })).filter(cat => cat.items.length > 0);
  }, [query, activeTag]);

  const filteredCount = filteredData.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 8px 40px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <BookOpen className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: isDark ? '#ffffff' : '#101318' }}>
            Project Glossary
          </h1>
        </div>
        <p style={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', lineHeight: 1.6 }}>
          Full forms, definitions, and context for every abbreviation, acronym, and technical term used across
          ChainSentinel AI. <strong style={{ color: isDark ? '#94a3b8' : '#475569' }}>{totalTerms} terms</strong> across{' '}
          {glossaryData.length} categories — all driven by{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 11, padding: '1px 5px', borderRadius: 4,
            background: isDark ? '#1a1e2f' : '#f1f5f9' }}>
            src/data/glossary.json
          </code>
          . Add a new entry there and it appears here instantly.
        </p>
      </div>

      {/* Search + tag filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} size={15} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search abbreviations, full forms, or descriptions..."
            style={{
              width: '100%', padding: '11px 16px 11px 40px', borderRadius: 10, fontSize: 13,
              background: isDark ? '#111827' : '#ffffff',
              border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
              color: isDark ? '#ffffff' : '#101318',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {(search || activeTag) && (
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', fontFamily: 'monospace' }}>
              {filteredCount} result{filteredCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tag filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tag size={12} style={{ color: isDark ? '#475569' : '#94a3b8' }} />
          <button
            onClick={() => setActiveTag(null)}
            style={{
              padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: !activeTag ? '#00f0ff' : (isDark ? '#1e293b' : '#f1f5f9'),
              color: !activeTag ? '#000' : (isDark ? '#94a3b8' : '#64748b'),
            }}
          >
            All
          </button>
          {allTags.map(tag => {
            const c = TAG_COLORS[tag] || { bg: '#1e293b', text: '#94a3b8' };
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(t => t === tag ? null : tag)}
                style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: 0.5,
                  background: activeTag === tag ? c.bg : (isDark ? '#1a1e2f' : '#f1f5f9'),
                  color: activeTag === tag ? c.text : (isDark ? '#64748b' : '#94a3b8'),
                  outline: activeTag === tag ? `1px solid ${c.text}44` : 'none',
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10,
        background: isDark ? 'rgba(0,240,255,0.05)' : 'rgba(8,145,178,0.04)',
        border: `1px solid ${isDark ? 'rgba(0,240,255,0.15)' : 'rgba(8,145,178,0.2)'}`,
        marginBottom: 28,
      }}>
        <Info size={14} style={{ color: '#00f0ff', marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#475569', lineHeight: 1.6 }}>
          <strong style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>How to add a new term:</strong>{' '}
          Open <code style={{ fontFamily: 'monospace' }}>apps/web/src/data/glossary.json</code>, find the right
          category (or add a new one), and add an object with{' '}
          <code style={{ fontFamily: 'monospace' }}>abbr</code>,{' '}
          <code style={{ fontFamily: 'monospace' }}>full</code>,{' '}
          <code style={{ fontFamily: 'monospace' }}>description</code>, and{' '}
          <code style={{ fontFamily: 'monospace' }}>tags</code> fields. It will appear here instantly.
        </p>
      </div>

      {/* Glossary sections */}
      {filteredData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <BookOpen size={40} style={{ color: isDark ? '#334155' : '#cbd5e1', margin: '0 auto 12px' }} />
          <p style={{ color: isDark ? '#475569' : '#94a3b8', fontSize: 14 }}>
            No terms match "{search}"
          </p>
        </div>
      ) : (
        filteredData.map(cat => (
          <CategorySection
            key={cat.category}
            category={cat.category}
            items={cat.items}
            isDark={isDark}
            searchQuery={query}
          />
        ))
      )}
    </div>
  );
}
