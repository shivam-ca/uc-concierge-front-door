import LiquidGlass from 'liquid-glass-react';
import { useRef } from 'react';

const NOOP = () => {}; // keeps the library's press effect; the wrapper owns the click

/**
 * Liquid glass control built on liquid-glass-react (refraction, chromatic edge,
 * elastic hover). The library centres itself with top/left 50% + translate, so a
 * hidden "sizer" copy of the content gives the wrapper its in-flow size and the
 * glass is absolutely centred on top of it.
 */
export function LG({ children, onClick, radius = 999, padding = '9px 16px', className = '', strong = false, title, ariaLabel, pressed, tone = 'default' }) {
  const content = <span className={`lg-content lg-${tone}`}>{children}</span>;
  const onKey = (e) => {
    if (!onClick || e.repeat) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  };
  return (
    <span
      className={`lg-wrap ${onClick ? 'lg-clickable' : ''} ${className}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={title}
      onKeyDown={onKey}
      onClick={onClick}
    >
      <span className="lg-sizer" aria-hidden="true" style={{ padding }}>{content}</span>
      <LiquidGlass
        style={{ position: 'absolute', top: '50%', left: '50%' }}
        cornerRadius={radius}
        padding={padding}
        displacementScale={strong ? 70 : 52}
        blurAmount={strong ? 0.1 : 0.07}
        saturation={160}
        aberrationIntensity={strong ? 2 : 1.4}
        elasticity={0.2}
        onClick={onClick ? NOOP : undefined}
      >
        {content}
      </LiquidGlass>
    </span>
  );
}

/** Large surfaces: CSS liquid-glass material with specular rim and a cursor spotlight. */
export function Panel({ children, className = '', as: Tag = 'section', spot = true, ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!spot || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <Tag ref={ref} className={`gp ${spot ? 'gp-spot' : ''} ${className}`} onMouseMove={onMove} {...rest}>
      {children}
    </Tag>
  );
}

export function Pill({ tone = 'muted', icon: Icon, children, pulse }) {
  return (
    <span className={`pill pill-${tone} ${pulse ? 'pill-pulse' : ''}`}>
      {Icon ? <Icon size={12} strokeWidth={2.2} aria-hidden="true" /> : <i aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <i /><i /><i /><i />
      <div className="grain" />
    </div>
  );
}
