/**
 * Extração de texto de várias fontes para a base de conhecimento.
 *
 * Fontes suportadas:
 *  - Ficheiros: pdf, docx, csv, txt/markdown
 *  - YouTube: transcrição automática
 *  - Website: HTML → texto (com proteção anti-SSRF)
 *
 * Segurança:
 *  - URLs (website/youtube) são validadas contra SSRF: apenas http(s),
 *    e o host não pode resolver para IPs privados/loopback/link-local.
 *  - Tamanho de resposta limitado para evitar exaustão de memória.
 */

import { createRequire } from 'module';
import { promises as dns } from 'dns';
import net from 'net';
import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { YoutubeTranscript } from 'youtube-transcript';

// pdf-parse é CommonJS e executa um auto-teste quando importado como entry
// point em ESM. Carregar o módulo interno via createRequire evita isso.
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  data: Buffer,
) => Promise<{ text: string }>;

const MAX_REMOTE_BYTES = 5 * 1024 * 1024; // 5 MB para páginas web
const FETCH_TIMEOUT_MS = 15000;

export type DocumentType = 'pdf' | 'docx' | 'csv' | 'text' | 'youtube' | 'website';

// ── Proteção anti-SSRF ──────────────────────────────────────────────────────

/** Verifica se um IP pertence a um intervalo privado/reservado. */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true; // loopback
    if (p[0] === 169 && p[1] === 254) return true; // link-local
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 0) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower === '::') return true;
    // IPv4 mapeado em IPv6
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // formato desconhecido → bloquear por precaução
}

/**
 * Valida uma URL pública e segura. Lança erro se for inválida ou apontar
 * para a rede interna (defesa contra SSRF).
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Apenas URLs http/https são permitidas');
  }

  const host = url.hostname;

  // Se o host já é um IP, valida diretamente
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Acesso a endereços internos bloqueado');
    return url;
  }

  // Bloqueia hostnames locais óbvios
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Acesso a endereços internos bloqueado');
  }

  // Resolve o host e valida todos os IPs retornados
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Não foi possível resolver o host');
  }
  if (addresses.length === 0) throw new Error('Host sem endereços');
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error('Acesso a endereços internos bloqueado');
    }
  }

  return url;
}

// ── Extração de ficheiros ───────────────────────────────────────────────────

/** Extrai texto de um PDF. */
export async function extractPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text ?? '';
}

/** Extrai texto de um DOCX. */
export async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
}

/**
 * Converte CSV em texto legível (uma linha por registo, colunas separadas).
 * Parser simples e seguro que lida com aspas e vírgulas dentro de campos.
 */
export function extractCsv(content: string): string {
  const rows = parseCsv(content);
  if (rows.length === 0) return '';
  const header = rows[0];
  const body = rows.slice(1);

  // Se há cabeçalho e linhas, formata como "coluna: valor"
  if (header.length > 1 && body.length > 0) {
    return body
      .map((row) =>
        row
          .map((cell, i) => `${header[i] ?? `col${i + 1}`}: ${cell}`.trim())
          .join(' | '),
      )
      .join('\n');
  }
  // Caso contrário, junta as células
  return rows.map((r) => r.join(' | ')).join('\n');
}

/** Parser CSV minimalista compatível com RFC 4180 (aspas duplas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ── Extração de fontes remotas ──────────────────────────────────────────────

/** Extrai o ID de um vídeo do YouTube a partir de várias formas de URL. */
export function parseYoutubeId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] ?? null;
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Obtém a transcrição de um vídeo do YouTube. */
export async function extractYoutube(rawUrl: string): Promise<string> {
  const videoId = parseYoutubeId(rawUrl);
  if (!videoId) throw new Error('URL do YouTube inválida');

  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  const text = segments.map((s) => s.text).join(' ');
  if (!text.trim()) throw new Error('Vídeo sem transcrição disponível');
  return text;
}

/** Obtém e extrai o texto de uma página web (com proteção anti-SSRF). */
export async function extractWebsite(rawUrl: string): Promise<string> {
  const url = await assertPublicUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'AgentfyBot/1.0 (+knowledge-ingestion)' },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Falha ao obter a página (${res.status})`);

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error('A URL não aponta para uma página HTML/texto');
  }

  const lengthHeader = res.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > MAX_REMOTE_BYTES) {
    throw new Error('Página demasiado grande');
  }

  const html = (await res.text()).slice(0, MAX_REMOTE_BYTES);

  const $ = cheerio.load(html);
  $('script, style, noscript, svg, nav, footer, header, iframe').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Não foi possível extrair texto da página');
  return text;
}
