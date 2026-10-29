import axios from 'axios';
import * as cheerio from 'cheerio';
import { WebsiteAuditData } from './types';

/**
 * Scrapes and cross-verifies business website for Local SEO signals & NAP consistency
 */
export async function scrapeWebsite(
  rawUrl: string,
  businessPhone?: string,
  city?: string
): Promise<WebsiteAuditData> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const result: WebsiteAuditData = {
    url,
    isHttps: url.startsWith('https://'),
    hasPhoneMatch: false,
    hasAddressMatch: false,
    hasLocalBusinessSchema: false,
  };

  const startTime = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      maxRedirects: 5,
    });

    result.loadTimeMs = Date.now() - startTime;
    result.statusCode = response.status;
    const finalUrl = response.request?.res?.responseUrl || url;
    result.isHttps = finalUrl.startsWith('https://');

    const html = response.data;
    const $ = cheerio.load(html);

    result.title = $('title').text().trim();
    result.metaDescription =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      '';

    const pageText = $('body').text().toLowerCase();

    // Check Phone match (normalizing numbers to digits only)
    if (businessPhone) {
      const cleanPhone = businessPhone.replace(/\D/g, '');
      const last7Digits = cleanPhone.slice(-7);
      if (last7Digits && pageText.replace(/\D/g, '').includes(last7Digits)) {
        result.hasPhoneMatch = true;
      }
    }

    // Check City/Address match
    if (city && city.trim().length > 2) {
      const cityLower = city.toLowerCase().trim();
      if (pageText.includes(cityLower)) {
        result.hasAddressMatch = true;
      }
    }

    // Check Schema.org JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          const typeStr = JSON.stringify(parsed).toLowerCase();
          if (
            typeStr.includes('localbusiness') ||
            typeStr.includes('organization') ||
            typeStr.includes('professionalService') ||
            typeStr.includes('store')
          ) {
            result.hasLocalBusinessSchema = true;
          }
        }
      } catch (e) {
        // ignore JSON parse error in script tags
      }
    });

    return result;
  } catch (error) {
    console.warn(`Website scrape failed for ${url}:`, error.message);
    result.loadTimeMs = Date.now() - startTime;
    result.isHttps = url.startsWith('https://');
    return result;
  }
}
