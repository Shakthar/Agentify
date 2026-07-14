import Image from 'next/image';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 36, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image src="/logo.png" alt="Agentfy" width={size} height={size} priority />
      {showText && (
        <span
          className="font-bold text-xl tracking-tight text-brand-700 dark:text-brand-400 select-none"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          Agentfy
        </span>
      )}
    </div>
  );
}
