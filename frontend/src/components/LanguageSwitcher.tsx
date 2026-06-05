import { useRouter } from 'next/router';

const LANGUAGES = [
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
];

export default function LanguageSwitcher() {
  const router = useRouter();
  const { locale, pathname, asPath, query } = router;

  const switchLocale = (newLocale: string) => {
    router.push({ pathname, query }, asPath, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => switchLocale(lang.code)}
          title={lang.label}
          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
            locale === lang.code
              ? 'bg-brand-100 text-brand-700 font-semibold'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          {lang.flag} {lang.label}
        </button>
      ))}
    </div>
  );
}
