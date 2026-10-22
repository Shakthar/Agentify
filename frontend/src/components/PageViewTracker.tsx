import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { API_URL } from '../utils/constants';

/** Rotas da app/ferramentas que nunca são contadas como páginas públicas. */
const PRIVATE = /^\/(?:(?:pt|es|en)\/)?(?:dashboard|chat|w|orders|order-status)(?:\/|$|\?|#)/;

function track(asPath: string, locale: string | undefined) {
  try {
    if (typeof window === 'undefined') return;
    if (navigator.doNotTrack === '1') return;
    const path = asPath.split('#')[0].split('?')[0] || '/';
    if (PRIVATE.test(path) || /^\/(?:(?:pt|es|en)\/)?(?:dashboard|chat|w|orders|order-status)$/.test(path)) return;
    const params = new URLSearchParams(window.location.search);
    let referrer = '';
    try { referrer = document.referrer ? new URL(document.referrer).host : ''; } catch { referrer = ''; }
    if (referrer === window.location.host) referrer = '';
    const body = JSON.stringify({
      path,
      referrer,
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      locale: locale || 'pt',
    });
    void fetch(`${API_URL}/api/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* fire-and-forget: nunca atrapalha a navegação */
  }
}

/** Contagem de visitas das páginas públicas: primeira carga e cada mudança de rota. */
export default function PageViewTracker() {
  const router = useRouter();
  const last = useRef<string>('');

  useEffect(() => {
    if (!router.isReady) return;
    const fire = (url: string) => {
      const key = url.split('#')[0];
      if (key === last.current) return;
      last.current = key;
      track(url, router.locale);
    };
    fire(router.asPath);
    const onDone = (url: string) => fire(url);
    router.events.on('routeChangeComplete', onDone);
    return () => router.events.off('routeChangeComplete', onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  return null;
}
