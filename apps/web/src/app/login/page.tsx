'use client';

import { useState, useEffect, useRef, useMemo, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, Lock, Fingerprint, ShieldCheck, Terminal, Radar, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { ThemeToggle } from '@/components/ThemeToggle';

const AUTH_STAGES = ['AUTHENTICATING', 'VERIFYING SESSION', 'ACCESS GRANTED'] as const;

const CODE_FRAGMENTS = [
  'TRACE_BLOCK(0x8F...)',
  'wallet.detect()',
  'risk_score = 0.92',
  'TX_HASH_VERIFY',
  'graph.trace(path)',
  'node.cluster()',
  'VASP_MATCH',
  'cross_chain.detect()',
  'AML_ALERT',
  'address.resolve()',
  'chain.scan()',
  'block.verify()',
  'hash.match()',
  'ledger.sync()',
  'shield.protect()',
  'threat.analyze()',
  'cluster.detect()',
  'pattern.match()',
  'anomaly.flag()',
  'intel.correlate()',
];

const SOC_PANELS = [
  { label: 'THREAT LVL', value: 'LOW', color: '#00ff88' },
  { label: 'BLOCKS/SEC', value: '1,247', color: '#00f0ff' },
  { label: 'ACTIVE NODES', value: '342', color: '#3b82f6' },
  { label: 'UPTIME', value: '99.97%', color: '#00ff88' },
  { label: 'ALERTS', value: '3 PENDING', color: '#f59e0b' },
  { label: 'SCAN DEPTH', value: 'L4', color: '#8b5cf6' },
];

// Seeded PRNG - deterministic across server/client renders
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ──────────────────────────────────────────
   LAYER 1: Binary Rain (enhanced)
   ────────────────────────────────────────── */
function BinaryRain({ isDark }: { isDark: boolean }) {
  const columnsData = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: 18 }).map((_, col) => {
      const len = 8 + Math.floor(rand() * 12);
      const chars = Array.from({ length: len })
        .map(() => (rand() > 0.5 ? '1' : '0'))
        .join('');
      return {
        chars,
        left: (col / 18) * 100 + rand() * (100 / 18),
        delay: rand() * 10,
        duration: 10 + rand() * 15,
        opacity: 0.03 + rand() * 0.07,
        blur: col % 4 === 0 ? 'blur(1px)' : 'none',
      };
    });
  }, []);

  return (
    <div className="binary-rain absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {columnsData.map((col, i) => (
        <div
          key={`bin-${i}`}
          className="absolute text-xs font-mono whitespace-pre"
          style={{
            left: `${col.left}%`,
            top: '-10%',
            color: isDark ? '#00f0ff' : '#0891b2',
            opacity: col.opacity,
            animation: `binaryFall ${col.duration}s linear ${col.delay}s infinite`,
            filter: col.blur,
            fontSize: '10px',
            lineHeight: '14px',
          }}
        >
          {col.chars.split('').map((c, j) => (
            <div key={j}>{c}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 2: Code Stream (enhanced)
   ────────────────────────────────────────── */
function CodeStream({ isDark }: { isDark: boolean }) {
  const fragmentsData = useMemo(() => {
    const rand = seededRandom(137);
    return CODE_FRAGMENTS.map((fragment, i) => ({
      fragment,
      left: 3 + (i * 5) % 94,
      delay: i * 1.2 + rand() * 4,
      duration: 12 + rand() * 10,
      opacity: 0.025 + rand() * 0.04,
    }));
  }, []);

  return (
    <div className="code-stream absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {fragmentsData.map((item) => (
        <div
          key={item.fragment}
          className="absolute text-[9px] font-mono whitespace-nowrap"
          style={{
            left: `${item.left}%`,
            top: '-5%',
            color: isDark ? '#00f0ff' : '#0e7490',
            opacity: item.opacity,
            animation: `codeScroll ${item.duration}s linear ${item.delay}s infinite`,
            filter: 'blur(0.5px)',
          }}
        >
          {item.fragment}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 3: Blockchain Network (enhanced)
   ────────────────────────────────────────── */
function BlockchainNetwork({ isDark }: { isDark: boolean }) {
  const nodesRef = useRef<Array<{ x: number; y: number; r: number; pulse: number }>>([]);
  const animFrameRef = useRef<number>(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const rand = seededRandom(256);
    nodesRef.current = Array.from({ length: 20 }).map(() => ({
      x: rand() * 100,
      y: rand() * 100,
      r: 0.8 + rand() * 2,
      pulse: rand() * Math.PI * 2,
    }));
  }, []);

  useEffect(() => {
    let lastTime = 0;
    const animate = (time: number) => {
      if (time - lastTime < 80) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastTime = time;
      nodesRef.current.forEach((n) => {
        n.pulse += 0.025;
      });
      forceUpdate((v) => v + 1);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const color = isDark ? '#00f0ff' : '#0891b2';
  const nodes = nodesRef.current;

  return (
    <div className="blockchain-network absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {nodes.map((node, i) => {
          const nextNode = nodes[(i + 1) % nodes.length];
          return (
            <g key={`net-${i}`}>
              {/* Connection lines */}
              <line
                x1={node.x} y1={node.y}
                x2={nextNode.x} y2={nextNode.y}
                stroke={color} strokeWidth="0.12" opacity={0.06}
              />
              {i % 3 === 0 && i + 2 < nodes.length && (
                <line
                  x1={node.x} y1={node.y}
                  x2={nodes[i + 2].x} y2={nodes[i + 2].y}
                  stroke={color} strokeWidth="0.08" opacity={0.04}
                />
              )}
              {/* Node core */}
              <circle
                cx={node.x} cy={node.y} r={node.r}
                fill={color}
                opacity={0.1 + Math.sin(node.pulse) * 0.06}
              />
              {/* Glow ring */}
              <circle
                cx={node.x} cy={node.y} r={node.r * 3.5}
                fill={color}
                opacity={0.015 + Math.sin(node.pulse) * 0.012}
              />
              {/* Outer pulse ring */}
              <circle
                cx={node.x} cy={node.y} r={node.r * 5}
                fill="none"
                stroke={color}
                strokeWidth="0.08"
                opacity={Math.max(0, 0.05 * Math.sin(node.pulse + 1))}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 4: Perspective Grid
   ────────────────────────────────────────── */
function PerspectiveGrid() {
  return <div className="perspective-grid" aria-hidden="true" />;
}

/* ──────────────────────────────────────────
   LAYER 5: Scan Sweep Line
   ────────────────────────────────────────── */
function ScanSweep() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="scan-sweep-line" />
      <div className="scan-sweep-line" style={{ animationDelay: '4s' }} />
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 6: Hex Overlay
   ────────────────────────────────────────── */
function HexOverlay() {
  return <div className="hex-overlay" aria-hidden="true" />;
}

/* ──────────────────────────────────────────
   LAYER 7: Corner Brackets (SOC targeting feel)
   ────────────────────────────────────────── */
function CornerBrackets() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div className="corner-bracket corner-bracket--tl" />
      <div className="corner-bracket corner-bracket--tr" />
      <div className="corner-bracket corner-bracket--bl" />
      <div className="corner-bracket corner-bracket--br" />
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 8: Data Flow Lines (horizontal pulses)
   ────────────────────────────────────────── */
function DataFlowLines({ isDark }: { isDark: boolean }) {
  const lines = useMemo(() => {
    const rand = seededRandom(800);
    return Array.from({ length: 6 }).map((_, i) => ({
      top: 15 + rand() * 70,
      width: 15 + rand() * 30,
      left: rand() * 60,
      dur: 3 + rand() * 5,
      delay: rand() * 8,
      opacity: 0.15 + rand() * 0.2,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {lines.map((line, i) => (
        <div
          key={`df-${i}`}
          className="data-flow-line"
          style={{
            top: `${line.top}%`,
            left: `${line.left}%`,
            width: `${line.width}%`,
            opacity: line.opacity,
            '--dur': `${line.dur}s`,
            '--delay': `${line.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 9: Vertical Data Streams
   ────────────────────────────────────────── */
function VerticalStreams() {
  const streams = useMemo(() => {
    const rand = seededRandom(900);
    return Array.from({ length: 8 }).map((_, i) => ({
      left: 5 + rand() * 90,
      height: 20 + rand() * 40,
      top: rand() * 80,
      dur: 5 + rand() * 8,
      delay: rand() * 10,
      opacity: 0.1 + rand() * 0.15,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {streams.map((s, i) => (
        <div
          key={`vs-${i}`}
          className="vertical-stream"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            height: `${s.height}%`,
            opacity: s.opacity,
            '--dur': `${s.dur}s`,
            '--delay': `${s.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 10: Floating Security Icons
   ────────────────────────────────────────── */
function FloatingIcons({ isDark }: { isDark: boolean }) {
  const icons = useMemo(() => {
    const iconComponents = [Lock, Fingerprint, ShieldCheck, Terminal, Radar, KeyRound];
    const rand = seededRandom(600);
    return iconComponents.map((Icon, i) => ({
      Icon,
      left: 8 + rand() * 84,
      top: 10 + rand() * 80,
      size: 16 + Math.floor(rand() * 16),
      dur: 14 + rand() * 12,
      delay: rand() * 8,
      rotation: -15 + rand() * 30,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {icons.map(({ Icon, left, top, size, dur, delay, rotation }, i) => (
        <div
          key={`fi-${i}`}
          className="floating-icon"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            '--size': `${size}px`,
            '--dur': `${dur}s`,
            '--delay': `${delay}s`,
            transform: `rotate(${rotation}deg)`,
          } as React.CSSProperties}
        >
          <Icon style={{ stroke: isDark ? 'rgba(0, 240, 255, 0.06)' : 'rgba(8, 145, 178, 0.08)' }} />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 11: SOC Mini Panels
   ────────────────────────────────────────── */
function SOCMiniPanels({ isDark }: { isDark: boolean }) {
  const panels = useMemo(() => {
    const rand = seededRandom(700);
    return SOC_PANELS.map((panel, i) => ({
      ...panel,
      left: i < 3 ? 4 + rand() * 18 : 78 + rand() * 18,
      top: 12 + (i % 3) * 28 + rand() * 8,
      delay: i * 0.7,
      flickerDelay: rand() * 6,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {panels.map((panel, i) => (
        <div
          key={`soc-${i}`}
          className="soc-panel"
          style={{
            left: `${panel.left}%`,
            top: `${panel.top}%`,
            animationDelay: `${panel.flickerDelay}s, ${panel.delay}s`,
          }}
        >
          <div style={{ opacity: 0.5, marginBottom: 2 }}>{panel.label}</div>
          <div style={{ color: isDark ? panel.color : '#0891b2', opacity: 0.5 }}>
            {panel.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 12: Threat Monitor Bars
   ────────────────────────────────────────── */
function ThreatBars({ isDark }: { isDark: boolean }) {
  const groups = useMemo(() => {
    const rand = seededRandom(500);
    return [
      { left: 3, top: 45, heights: [8, 14, 6, 18, 10, 22, 12, 8, 16, 6, 20, 14, 10, 8] },
      { left: 90, top: 35, heights: [12, 8, 20, 14, 6, 18, 10, 24, 8, 16, 12, 6] },
    ].map((g) => ({
      ...g,
      heights: g.heights.map((h) => h + Math.floor(rand() * 8)),
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {groups.map((group, gi) => (
        <div
          key={`tg-${gi}`}
          className="threat-bars"
          style={{ left: `${group.left}%`, top: `${group.top}%` }}
        >
          {group.heights.map((h, hi) => (
            <div
              key={`tb-${gi}-${hi}`}
              className="threat-bar"
              style={{
                height: `${h}px`,
                '--fill': `${40 + h * 2}%`,
                animationDelay: `${hi * 0.08}s`,
                animationDuration: '1.5s',
              } as React.CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   LAYER 13: Shield Pulse Rings
   ────────────────────────────────────────── */
function ShieldPulseRings() {
  const rings = useMemo(() => {
    const rand = seededRandom(550);
    return Array.from({ length: 3 }).map((_, i) => ({
      left: 20 + rand() * 60,
      top: 20 + rand() * 60,
      size: 40 + rand() * 80,
      delay: i * 1.2,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {rings.map((ring, i) => (
        <div
          key={`spr-${i}`}
          className="shield-pulse-ring"
          style={{
            left: `${ring.left}%`,
            top: `${ring.top}%`,
            width: `${ring.size}px`,
            height: `${ring.size}px`,
            animationDelay: `${ring.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   Composite: All Parallax Background Layers
   ────────────────────────────────────────── */
function CyberBackground({ isDark }: { isDark: boolean }) {
  return (
    <>
      {/* Depth Layer 0: Hex overlay (deepest) */}
      <HexOverlay />

      {/* Depth Layer 1: Slow parallax — perspective grid */}
      <div
        className="login-bg-layer"
        style={{ animation: 'parallaxSlow 30s ease-in-out infinite' }}
      >
        <PerspectiveGrid />
      </div>

      {/* Depth Layer 1: Binary rain (slow) */}
      <div
        className="login-bg-layer"
        style={{ animation: 'parallaxSlow 25s ease-in-out infinite' }}
      >
        <BinaryRain isDark={isDark} />
      </div>

      {/* Depth Layer 2: Medium parallax — network, code stream */}
      <div
        className="login-bg-layer"
        style={{ animation: 'parallaxMedium 20s ease-in-out infinite' }}
      >
        <BlockchainNetwork isDark={isDark} />
      </div>
      <div
        className="login-bg-layer"
        style={{ animation: 'parallaxMedium 22s ease-in-out infinite' }}
      >
        <CodeStream isDark={isDark} />
      </div>

      {/* Depth Layer 3: Fast parallax — data flow, vertical streams */}
      <div
        className="login-bg-layer"
        style={{ animation: 'parallaxFast 15s ease-in-out infinite' }}
      >
        <DataFlowLines isDark={isDark} />
      </div>
      <div
        className="login-bg-layer"
        style={{ animation: 'parallaxFast 18s ease-in-out infinite' }}
      >
        <VerticalStreams />
      </div>

      {/* Scan sweep */}
      <ScanSweep />

      {/* Floating icons */}
      <FloatingIcons isDark={isDark} />

      {/* SOC panels */}
      <SOCMiniPanels isDark={isDark} />

      {/* Threat bars */}
      <ThreatBars isDark={isDark} />

      {/* Shield pulse rings */}
      <ShieldPulseRings />

      {/* Corner brackets */}
      <CornerBrackets />
    </>
  );
}

/* ═══════════════════════════════════════════
   MAIN LOGIN PAGE
   ═══════════════════════════════════════════ */
export default function LoginPage() {
  const router = useRouter();
  const { login, error, clearError } = useAuthStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authStage, setAuthStage] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  // Field-level validation errors (shown inline below inputs)
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Track whether user has interacted with each field (for blur validation)
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  // ── Validation helpers ──
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const validateEmail = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Email is required.';
    if (!isValidEmail(trimmed)) return 'Enter a valid email address.';
    return null;
  }, []);

  const validatePassword = useCallback((value: string): string | null => {
    if (!value) return 'Password is required.';
    return null;
  }, []);

  // ── Blur handlers (validate when user leaves the field) ──
  const handleEmailBlur = useCallback(() => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  }, [email, validateEmail]);

  const handlePasswordBlur = useCallback(() => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  }, [password, validatePassword]);

  // ── Change handlers (clear error on typing after it was shown) ──
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    // Clear the store error (the API-level "Invalid email or password." banner)
    clearError();
    // Clear inline error only if the field was previously touched and had an error
    if (emailTouched && emailError) {
      setEmailError(null);
    }
  }, [clearError, emailTouched, emailError]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    // Clear the store error (the API-level "Invalid email or password." banner)
    clearError();
    // Clear inline error only if the field was previously touched and had an error
    if (passwordTouched && passwordError) {
      setPasswordError(null);
    }
  }, [clearError, passwordTouched, passwordError]);

  // ── Submit handler ──
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    // Mark both fields as touched so blur-style errors show
    setEmailTouched(true);
    setPasswordTouched(true);

    // Validate both fields
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);

    // If any field-level validation fails, stop here
    if (eErr || pErr) {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 600);
      return;
    }

    setIsLoading(true);
    setAuthStage(AUTH_STAGES[0]);

    try {
      await new Promise((r) => setTimeout(r, 400));
      setAuthStage(AUTH_STAGES[1]);

      const trimmedEmail = email.trim();
      await login(trimmedEmail, password);

      setAuthStage(AUTH_STAGES[2]);
      await new Promise((r) => setTimeout(r, 300));

      router.replace('/dashboard');
    } catch {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 600);
    } finally {
      setIsLoading(false);
      setAuthStage(null);
    }
  }, [email, password, login, clearError, router, validateEmail, validatePassword]);

  useEffect(() => {
    const handleCapsLock = (event: KeyboardEvent) => {
      const enabled =
        typeof event?.getModifierState === 'function'
          ? event.getModifierState('CapsLock')
          : false;
      setCapsLock(enabled);
    };
    window.addEventListener('keydown', handleCapsLock);
    window.addEventListener('keyup', handleCapsLock);
    return () => {
      window.removeEventListener('keydown', handleCapsLock);
      window.removeEventListener('keyup', handleCapsLock);
    };
  }, []);

  // ── Shared input style ──
  const getInputStyle = (hasError: boolean) => ({
    background: isDark ? '#1a1e2f' : '#ffffff',
    border: `1px solid ${hasError ? '#ef4444' : isDark ? '#2a304a' : '#e2e8f0'}`,
    color: isDark ? '#ffffff' : '#0f172a',
  });

  return (
    <div
      className="min-h-screen bg-grid flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: isDark ? '#0a0c14' : '#f8fafc',
      }}
    >
      {/* ═══ ALL BACKGROUND LAYERS ═══ */}
      <CyberBackground isDark={isDark} />

      {/* Ambient color glows (parallax depth) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ animation: 'parallaxSlow 35s ease-in-out infinite' }}
      >
        <div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: isDark ? 'rgba(0, 240, 255, 0.025)' : 'rgba(0, 150, 180, 0.03)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: isDark ? 'rgba(139, 92, 246, 0.025)' : 'rgba(139, 92, 246, 0.03)' }}
        />
      </div>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ animation: 'parallaxMedium 28s ease-in-out infinite' }}
      >
        <div
          className="absolute top-2/3 left-1/2 w-[600px] h-[400px] rounded-full blur-3xl"
          style={{ background: isDark ? 'rgba(0, 255, 136, 0.015)' : 'rgba(0, 200, 120, 0.02)' }}
        />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle size="md" />
      </div>

      {/* ═══ LOGIN CARD ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-4"
          >
            <img
              src="/images/ChainSentinel_AI.png"
              alt="ChainSentinel AI Logo"
              className="mx-auto"
              style={{ width: 64, height: 64, objectFit: 'contain' }}
              draggable={false}
            />
          </motion.div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
          >
            Chain<span style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>Sentinel</span> AI
          </h1>
          <p
            className="text-sm mt-1 font-mono tracking-wider"
            style={{ color: isDark ? '#64748b' : '#64748b' }}
          >
            INTELLIGENCE COMMAND CENTER
          </p>
        </div>

        {/* Login Form Card */}
        <motion.div
          animate={shakeError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="login-card rounded-2xl p-8"
          style={{
            background: isDark
              ? 'rgba(26, 30, 47, 0.85)'
              : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(24px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
            border: isDark
              ? '1px solid rgba(0, 240, 255, 0.1)'
              : '1px solid rgba(0, 150, 180, 0.2)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.04), inset 0 1px 0 rgba(0, 240, 255, 0.05)'
              : '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 40px rgba(0, 150, 180, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <h2
            className="text-lg font-semibold mb-6"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
          >
            Secure Access
          </h2>

          {/* API-level error banner (e.g. "Invalid email or password.") */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
                role="alert"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: isDark ? '#cbd5e1' : '#334155' }}
              >
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                className="login-input w-full px-4 py-3 rounded-lg text-sm font-mono outline-none transition-all duration-200"
                style={getInputStyle(!!emailError)}
                placeholder="you@agency.gov.in"
                required
                autoFocus
                autoComplete="email"
                disabled={isLoading}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
              {/* Inline email validation error */}
              <AnimatePresence>
                {emailError && (
                  <motion.p
                    id="email-error"
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    className="text-xs mt-1.5 font-medium"
                    style={{ color: '#ef4444' }}
                    role="alert"
                  >
                    {emailError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium"
                  style={{ color: isDark ? '#cbd5e1' : '#334155' }}
                >
                  Password
                </label>
                {capsLock && (
                  <span className="text-[10px] font-mono text-amber-500">CAPS LOCK</span>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  className="login-input w-full px-4 py-3 pr-12 rounded-lg text-sm font-mono outline-none transition-all duration-200"
                  style={getInputStyle(!!passwordError)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: isDark ? '#64748b' : '#64748b' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Inline password validation error */}
              <AnimatePresence>
                {passwordError && (
                  <motion.p
                    id="password-error"
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    className="text-xs mt-1.5 font-medium"
                    style={{ color: '#ef4444' }}
                    role="alert"
                  >
                    {passwordError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="login-button w-full py-3 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(0, 120, 200, 0.15))'
                  : 'linear-gradient(135deg, #0891b2, #0e7490)',
                border: isDark
                  ? '1px solid rgba(0, 240, 255, 0.4)'
                  : '1px solid transparent',
                color: isDark ? '#00f0ff' : '#ffffff',
                boxShadow: isDark
                  ? '0 0 20px rgba(0, 240, 255, 0.15)'
                  : '0 4px 12px rgba(8, 145, 178, 0.3)',
              }}
            >
              {isLoading ? (
                <>
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{
                      borderColor: isDark ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 255, 255, 0.3)',
                      borderTopColor: isDark ? '#00f0ff' : '#ffffff',
                    }}
                  />
                  <span className="font-mono text-sm">{authStage || 'AUTHENTICATING...'}</span>
                </>
              ) : (
                'Access Command Center'
              )}
            </button>
          </form>

          {/* Security Status */}
          <div
            className="mt-6 pt-4"
            style={{ borderTop: `1px solid ${isDark ? 'rgba(42, 48, 74, 0.8)' : 'rgba(0, 0, 0, 0.06)'}` }}
          >
            <div
              className="flex items-center justify-center gap-2 text-xs"
              style={{ color: isDark ? '#64748b' : '#64748b' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span className="font-mono">Security Status: Active</span>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <p
          className="text-center text-xs mt-6 font-mono"
          style={{ color: isDark ? '#475569' : '#94a3b8' }}
        >
          ChainSentinel AI • Secure Intelligence Environment
        </p>
      </motion.div>
    </div>
  );
}
