import { Router, Request, Response } from 'express';
import express from 'express';
import { createHash, randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import prisma from '../lib/prisma.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const BOT_RE = /bot|crawl|spider|slurp|bing|yandex|baidu|duckduck|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|go-http|java\/|okhttp|httpclient|scrapy|phantom|selenium|puppeteer|playwright|whatsapp|telegram|discord|slack|vercel-screenshot/i;

// Sal diário: env AGENTFY_ANALYTICS_SALT (+ data) ou segredo aleatório por dia em memória.
const memSalts = new Map<string, string>();
function dailySalt(day: string): string {
  const env = process.env.AGENTFY_ANALYTICS_SALT;
  if (env) return `${env}:${day}`;
  let s = memSalts.get(day);
  if (!s) {
    memSalts.clear();
    s = randomBytes(24).toString('hex');
    memSalts.set(day, s);
  }
  return s;
}

function visitorHash(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}|${ua}|${dailySalt(day)}`).digest('hex');
}

function deviceFromUA(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function firstHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function countryFromRequest(req: Request): string | null {
  for (const h of ['cf-ipcountry', 'x-vercel-ip-country', 'x-country']) {
    const v = firstHeader(req, h)?.trim().toUpperCase();
    if (v && /^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1') return v;
  }
  const al = firstHeader(req, 'accept-language');
  if (al) {
    const first = al.split(',')[0]?.trim() ?? '';
    const m = first.match(/^[a-zA-Z]{2,3}-([a-zA-Z]{2})(?:[;-]|$)/);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

const clean = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const bodySchema = z.object({
  path: z.string().trim().min(1).max(2000),
  referrer: clean(2000),
  utmSource: clean(100),
  utmMedium: clean(100),
  utmCampaign: clean(150),
  locale: clean(10),
});

function normalizePath(raw: string): string | null {
  let p = raw;
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch { return null; }
  p = p.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p.slice(0, 300);
}

function referrerHost(ref: string | null): string | null {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.toLowerCase().replace(/^www\./, '');
    let own = '';
    try { own = new URL(process.env.PUBLIC_SITE_URL || 'https://agentfy.shaklabs.tech').hostname.replace(/^www\./, ''); } catch { /* ignore */ }
    if (!h || h === own) return null;
    return h.slice(0, 120);
  } catch { return null; }
}

// POST /api/analytics/pageview — público. text/plain aceite para navigator.sendBeacon.
router.post(
  '/pageview',
  limiter,
  express.json({ type: ['application/json', 'text/plain'], limit: '8kb' }),
  (req: Request, res: Response) => {
    res.status(204).end();
    try {
      let body: unknown = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return; } }
      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) return;
      const d = parsed.data;

      const ua = firstHeader(req, 'user-agent') ?? '';
      if (!ua || BOT_RE.test(ua)) return;

      const path = normalizePath(d.path);
      if (!path || /^\/(dashboard|api)(\/|$)/i.test(path)) return;

      const locale = d.locale ? d.locale.toLowerCase().slice(0, 10) : null;

      prisma.pageView
        .create({
          data: {
            path,
            referrerHost: referrerHost(d.referrer ?? null),
            utmSource: d.utmSource ?? null,
            utmMedium: d.utmMedium ?? null,
            utmCampaign: d.utmCampaign ?? null,
            locale,
            country: countryFromRequest(req),
            device: deviceFromUA(ua),
            visitorHash: visitorHash(req.ip ?? '', ua),
            isBot: false,
          },
        })
        .catch((e: unknown) => console.error('[Analytics]', (e as Error).message));
    } catch (e) {
      console.error('[Analytics]', (e as Error).message);
    }
  },
);

export default router;
