import * as cheerio from 'cheerio';

const TIMEOUT_MS = 8000;
const CACHE_MS = 60 * 60 * 1000;
const MAX_URLS = 30;

export interface SeoPage {
  url: string; status: number; title: string | null; titleLength: number;
  description: string | null; descriptionLength: number; h1Count: number;
  canonical: string | null; hreflang: string[]; ogImage: boolean;
  jsonLdTypes: string[]; wordCount: number; issues: string[];
}
export interface SeoHealth {
  checkedAt: string; sitemapUrl: string; pages: SeoPage[];
  summary: { pages: number; withIssues: number; issueCounts: Record<string, number> };
}

let cache: { at: number; base: string; data: SeoHealth } | null = null;

async function fetchText(url: string): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'AgentfySEOHealthCheck/1.0', accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
    });
    const text = await r.text();
    return { status: r.status, text };
  } finally {
    clearTimeout(t);
  }
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s]+?)\s*(?:\]\]>)?\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
}

async function collectUrls(base: string, sitemapUrl: string): Promise<string[]> {
  const host = new URL(base).host;
  const urls: string[] = [];
  try {
    const { status, text } = await fetchText(sitemapUrl);
    if (status < 400) {
      let locs = extractLocs(text);
      if (/<sitemapindex/i.test(text)) {
        const nested: string[] = [];
        for (const child of locs.slice(0, 5)) {
          try {
            const r = await fetchText(child);
            if (r.status < 400) nested.push(...extractLocs(r.text));
          } catch { /* ignore */ }
        }
        locs = nested;
      }
      urls.push(...locs);
    }
  } catch { /* sitemap unreachable: fall back to defaults */ }
  const all = [`${base}/`, `${base}/faq`, ...urls.slice(0, MAX_URLS)];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of all) {
    try {
      const p = new URL(u);
      if (p.host !== host) continue; // evita SSRF via sitemap
      const key = p.origin + (p.pathname.replace(/\/+$/, '') || '/') + p.search;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(u);
    } catch { /* skip invalid */ }
  }
  return result;
}

function collectJsonLdTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) { node.forEach((x) => collectJsonLdTypes(x, out)); return; }
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    const t = o['@type'];
    if (typeof t === 'string') out.add(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && out.add(x));
    if (o['@graph']) collectJsonLdTypes(o['@graph'], out);
  }
}

async function checkUrl(url: string): Promise<SeoPage> {
  const page: SeoPage = {
    url, status: 0, title: null, titleLength: 0, description: null, descriptionLength: 0,
    h1Count: 0, canonical: null, hreflang: [], ogImage: false, jsonLdTypes: [], wordCount: 0, issues: [],
  };
  let html = '';
  try {
    const r = await fetchText(url);
    page.status = r.status;
    html = r.text;
  } catch {
    page.status = 0;
  }
  if (page.status === 0 || page.status >= 400) {
    page.issues.push('http_error');
    return page;
  }
  const $ = cheerio.load(html);
  const title = $('head title').first().text().trim() || null;
  const description = $('meta[name="description"]').attr('content')?.trim() || null;
  page.title = title;
  page.titleLength = title?.length ?? 0;
  page.description = description;
  page.descriptionLength = description?.length ?? 0;
  page.h1Count = $('h1').length;
  page.canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  page.hreflang = $('link[rel="alternate"][hreflang]').map((_, el) => $(el).attr('hreflang') ?? '').get().filter(Boolean);
  page.ogImage = !!$('meta[property="og:image"]').attr('content')?.trim();
  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try { collectJsonLdTypes(JSON.parse($(el).contents().text()), types); } catch { /* ignore invalid */ }
  });
  page.jsonLdTypes = [...types];
  $('script,style,noscript,template').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  page.wordCount = text ? text.split(' ').length : 0;

  if (!title) page.issues.push('missing_title');
  else if (page.titleLength > 60) page.issues.push('title_too_long');
  else if (page.titleLength < 25) page.issues.push('title_too_short');
  if (!description) page.issues.push('missing_description');
  else if (page.descriptionLength < 120 || page.descriptionLength > 165) page.issues.push('description_length');
  if (page.h1Count !== 1) page.issues.push('h1_count');
  if (!page.canonical) page.issues.push('missing_canonical');
  if (!page.ogImage) page.issues.push('missing_og_image');
  if (page.jsonLdTypes.length === 0) page.issues.push('no_structured_data');
  return page;
}

export async function getSeoHealth(): Promise<SeoHealth> {
  const base = (process.env.PUBLIC_SITE_URL || 'https://agentfy.shaklabs.tech').replace(/\/+$/, '');
  if (cache && cache.base === base && Date.now() - cache.at < CACHE_MS) return cache.data;

  const sitemapUrl = `${base}/sitemap.xml`;
  const urls = await collectUrls(base, sitemapUrl);
  const pages: SeoPage[] = new Array(urls.length);
  let i = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (i < urls.length) {
      const idx = i++;
      pages[idx] = await checkUrl(urls[idx]);
    }
  }));

  const issueCounts: Record<string, number> = {};
  for (const p of pages) for (const c of p.issues) issueCounts[c] = (issueCounts[c] ?? 0) + 1;
  const data: SeoHealth = {
    checkedAt: new Date().toISOString(),
    sitemapUrl,
    pages,
    summary: { pages: pages.length, withIssues: pages.filter((p) => p.issues.length > 0).length, issueCounts },
  };
  cache = { at: Date.now(), base, data };
  return data;
}
