import prisma from '../lib/prisma.js';

const TZ = 'Europe/Lisbon';
const LOCAL = `(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`;
const n = (v: unknown) => Number(v ?? 0);
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const lisbonDate = (d: Date) => dayFmt.format(d);

export async function getSeoOverview(days: number) {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);

  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(lisbonDate(new Date(now.getTime() - i * 86400000)));
  const start = dates[0];
  const prevStart = lisbonDate(new Date(now.getTime() - (2 * days - 1) * 86400000));

  const [
    byDayRows, totalsRows, prevRows, signupsByDay, signupsPrevRows,
    pages, refs, camps, devices, countries, locales,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT ${LOCAL}::date::text AS d, COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND ${LOCAL}::date >= $1::date GROUP BY 1`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND ${LOCAL}::date >= $1::date`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND ${LOCAL}::date >= $1::date AND ${LOCAL}::date < $2::date`, prevStart, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT ${LOCAL}::date::text AS d, COUNT(*) AS c FROM "Tenant" WHERE ${LOCAL}::date >= $1::date GROUP BY 1`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS c FROM "Tenant" WHERE ${LOCAL}::date >= $1::date AND ${LOCAL}::date < $2::date`, prevStart, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT "path", COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND ${LOCAL}::date >= $1::date GROUP BY 1 ORDER BY views DESC LIMIT 10`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE("referrerHost", '(direto)') AS host, COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND ${LOCAL}::date >= $1::date GROUP BY 1 ORDER BY visitors DESC LIMIT 8`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT "utmSource" AS source, "utmMedium" AS medium, "utmCampaign" AS campaign, COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND "utmSource" IS NOT NULL AND ${LOCAL}::date >= $1::date
       GROUP BY 1,2,3 ORDER BY visitors DESC LIMIT 8`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT "device", COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND ${LOCAL}::date >= $1::date GROUP BY 1 ORDER BY visitors DESC`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT "country", COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND "country" IS NOT NULL AND ${LOCAL}::date >= $1::date
       GROUP BY 1 ORDER BY visitors DESC LIMIT 8`, start),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT "locale", COUNT(DISTINCT "visitorHash") AS visitors
       FROM "PageView" WHERE "isBot" = false AND "locale" IS NOT NULL AND ${LOCAL}::date >= $1::date
       GROUP BY 1 ORDER BY visitors DESC`, start),
  ]);

  const viewMap = new Map(byDayRows.map((r) => [r.d as string, r]));
  const signMap = new Map(signupsByDay.map((r) => [r.d as string, n(r.c)]));
  const byDay = dates.map((date) => ({
    date,
    views: n(viewMap.get(date)?.views),
    visitors: n(viewMap.get(date)?.visitors),
    signups: signMap.get(date) ?? 0,
  }));

  const views = n(totalsRows[0]?.views);
  const visitors = n(totalsRows[0]?.visitors);
  const signups = byDay.reduce((a, d) => a + d.signups, 0);
  const round1 = (x: number) => Math.round(x * 10) / 10;

  return {
    range: { from: from.toISOString(), to: now.toISOString(), days },
    totals: {
      views,
      visitors,
      viewsPerVisitor: visitors > 0 ? round1(views / visitors) : 0,
      signups,
      signupRate: visitors > 0 ? round1((signups / visitors) * 100) : 0,
    },
    previous: {
      views: n(prevRows[0]?.views),
      visitors: n(prevRows[0]?.visitors),
      signups: n(signupsPrevRows[0]?.c),
    },
    byDay,
    topPages: pages.map((r) => ({ path: r.path, views: n(r.views), visitors: n(r.visitors) })),
    referrers: refs.map((r) => ({ host: r.host, visitors: n(r.visitors) })),
    campaigns: camps.map((r) => ({ source: r.source, medium: r.medium ?? null, campaign: r.campaign ?? null, visitors: n(r.visitors) })),
    devices: devices.map((r) => ({ device: r.device, visitors: n(r.visitors) })),
    countries: countries.map((r) => ({ country: r.country, visitors: n(r.visitors) })),
    locales: locales.map((r) => ({ locale: r.locale, visitors: n(r.visitors) })),
  };
}
