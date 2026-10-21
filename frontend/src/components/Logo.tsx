interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  /** Wordmark claro, para fundos escuros (ex.: rodapé). */
  inverted?: boolean;
}

/** Símbolo "azulejo": três quadrados do negócio + um balão de conversa. */
export function LogoMark({ size = 36, inverted = false }: { size?: number; inverted?: boolean }) {
  const ink = inverted ? '#FFFFFF' : '#13213C';
  const dots = inverted ? '#13213C' : '#FFFFFF';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="29" height="29" rx="3" fill={ink} />
      <rect x="33" y="2" width="29" height="29" rx="3" fill="#2346D8" />
      <rect x="2" y="33" width="29" height="29" rx="3" fill="#2346D8" />
      <path d="M36 33h23a3 3 0 0 1 3 3v19a7 7 0 0 1-7 7H33V36a3 3 0 0 1 3-3z" fill={ink} />
      <circle cx="42" cy="47.5" r="2.8" fill={dots} />
      <circle cx="51" cy="47.5" r="2.8" fill={dots} />
    </svg>
  );
}

export default function Logo({ size = 36, showText = true, className = '', inverted = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} inverted={inverted} />
      {showText && (
        <span
          className={`font-display font-extrabold tracking-tight select-none ${inverted ? 'text-white' : 'text-ink dark:text-white'}`}
          style={{ fontSize: Math.round(size * 0.8), letterSpacing: '-0.03em', lineHeight: 1 }}
        >
          agentfy
        </span>
      )}
    </div>
  );
}
