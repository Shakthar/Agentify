import { useRouter } from 'next/router';

const LANGUAGES = [
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
];

export default function LanguageSwitcher() {
  const router = useRouter();
  const { locale, pathname, asPath, query } = router;

  const switchLocale = (newLocale: string) => {
    router.push({ pathname, query }, asPath, { locale: newLocale });
  };

  return (
    <div role="group" aria-label="Idioma" className="flex items-center rounded-full bg-app-sheet p-0.5">
      {LANGUAGES.map((lang) => {
        const active = locale === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            aria-pressed={active}
            onClick={() => switchLocale(lang.code)}
            className={`h-7 rounded-full px-2.5 text-xs font-semibold transition-colors ${
              active ? 'bg-app-ink text-app-sheet' : 'text-app-muted hover:text-app-ink'
            }`}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
