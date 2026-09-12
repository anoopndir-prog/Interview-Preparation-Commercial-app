import cron from 'node-cron';

import { researchNews, type NewsItem } from './ai.js';
import { config } from './config.js';
import { all, one, run } from './db.js';
import { dayKey } from './streak.js';

const REFRESH_HOUR = 6;

/**
 * The edition is the date of the most recent 6:00 AM in the news timezone, so
 * between midnight and 6 AM readers still see yesterday's edition.
 */
export function currentEdition(at = new Date()): string {
  return dayKey(config.newsTimezone, new Date(at.getTime() - REFRESH_HOUR * 3600 * 1000));
}

const inFlight = new Map<string, Promise<NewsItem[]>>();

export async function getNews(domain: string): Promise<{ edition: string; items: NewsItem[]; generatedAt: string | null }> {
  const edition = currentEdition();
  const cached = one<{ items_json: string; generated_at: string }>(
    'SELECT items_json, generated_at FROM news WHERE domain = ? AND edition = ?',
    domain,
    edition,
  );
  if (cached) return { edition, items: JSON.parse(cached.items_json), generatedAt: cached.generated_at };

  // Lazily generate if the 6 AM job hasn't covered this domain yet (e.g. a new user's domain).
  const key = `${domain}|${edition}`;
  let job = inFlight.get(key);
  if (!job) {
    job = generateEdition(domain, edition).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  const items = await job;
  return { edition, items, generatedAt: new Date().toISOString() };
}

async function generateEdition(domain: string, edition: string): Promise<NewsItem[]> {
  const items = await researchNews(domain, edition);
  if (items.length) {
    run(
      `INSERT INTO news (domain, edition, items_json) VALUES (?, ?, ?)
       ON CONFLICT (domain, edition) DO UPDATE SET items_json = excluded.items_json, generated_at = datetime('now')`,
      domain,
      edition,
      JSON.stringify(items),
    );
  }
  return items;
}

/** Every day at 6:00 AM, pre-build today's edition for every domain users follow. */
export function scheduleDailyNews() {
  cron.schedule(
    `0 ${REFRESH_HOUR} * * *`,
    async () => {
      const edition = currentEdition();
      const domains = all<{ domain: string }>('SELECT DISTINCT domain FROM preps').map((r) => r.domain);
      console.log(`[news] building ${edition} edition for ${domains.length} domain(s)`);
      for (const domain of domains) {
        try {
          await generateEdition(domain, edition);
        } catch (err) {
          console.error(`[news] failed for "${domain}":`, err);
        }
      }
    },
    { timezone: config.newsTimezone, name: 'daily-news', noOverlap: true },
  );
}
