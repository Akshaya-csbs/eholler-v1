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

    // 1. Headings extraction
    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 3 && text.length <= 120 && !headings.includes(text)) {
        headings.push(text);
      }
    });
    result.headings = headings.slice(0, 15);

    // 2. Substantial Paragraphs & About Snippet
    const paragraphs: string[] = [];
    $('p, article, section').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 40 && text.length <= 400 && !paragraphs.includes(text)) {
        paragraphs.push(text);
      }
    });
    result.paragraphs = paragraphs.slice(0, 8);
    result.aboutSnippet = paragraphs.find(p =>
      p.toLowerCase().includes('about') ||
      p.toLowerCase().includes('specializ') ||
      p.toLowerCase().includes('consult') ||
      p.toLowerCase().includes('service') ||
      p.toLowerCase().includes('lead')
    ) || paragraphs[0] || '';

    // 3. Detect Services Mentioned
    const servicesFound: string[] = [];
    $('nav a, header a, footer a, li, .service, .services, #services').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (
        text.length >= 4 &&
        text.length <= 50 &&
        !['home', 'about', 'contact', 'privacy', 'terms', 'blog', 'login', 'signup'].includes(text.toLowerCase()) &&
        !servicesFound.includes(text)
      ) {
        // Look for service-like patterns
        if (
          text.toLowerCase().includes('consult') ||
          text.toLowerCase().includes('certif') ||
          text.toLowerCase().includes('iso') ||
          text.toLowerCase().includes('management') ||
          text.toLowerCase().includes('audit') ||
          text.toLowerCase().includes('training') ||
          text.toLowerCase().includes('service') ||
          text.toLowerCase().includes('repair') ||
          text.toLowerCase().includes('dental') ||
          text.toLowerCase().includes('treatment') ||
          text.toLowerCase().includes('care')
        ) {
          servicesFound.push(text);
        }
      }
    });
    result.servicesMentioned = Array.from<string>(new Set([...servicesFound, ...headings.filter(h => h.length < 40)])).slice(0, 12);

    // 4. Booking / Appointment URLs
    let foundAppointmentUrl: string | undefined = undefined;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim() || '';
      const text = $(el).text().toLowerCase();
      if (
        href.includes('calendly.com') ||
        href.includes('booking') ||
        href.includes('appointment') ||
        href.includes('wa.me') ||
        href.includes('api.whatsapp.com') ||
        text.includes('book appointment') ||
        text.includes('schedule consultation') ||
        text.includes('book online') ||
        text.includes('request quote')
      ) {
        if (!foundAppointmentUrl) {
          if (href.startsWith('http://') || href.startsWith('https://')) {
            foundAppointmentUrl = href;
          } else if (href.startsWith('/')) {
            foundAppointmentUrl = `${url.replace(/\/$/, '')}${href}`;
          }
        }
      }
    });
    result.appointmentUrl = foundAppointmentUrl;

    // 5. Contact Emails
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      result.contactEmails = Array.from<string>(new Set(emailMatches.filter((e: string) => !e.endsWith('.png') && !e.endsWith('.jpg')))).slice(0, 3);
    }

    // 6. Check Phone match (normalizing numbers to digits only)
    if (businessPhone) {
      const cleanPhone = businessPhone.replace(/\D/g, '');
      const last7Digits = cleanPhone.slice(-7);
      if (last7Digits && pageText.replace(/\D/g, '').includes(last7Digits)) {
        result.hasPhoneMatch = true;
      }
    }

    // 7. Check City/Address match
    if (city && city.trim().length > 2) {
      const cityLower = city.toLowerCase().trim();
      if (pageText.includes(cityLower)) {
        result.hasAddressMatch = true;
      }
    }

    // 8. Check Schema.org JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          const typeStr = JSON.stringify(parsed).toLowerCase();
          if (
            typeStr.includes('localbusiness') ||
            typeStr.includes('organization') ||
            typeStr.includes('professionalservice') ||
            typeStr.includes('store') ||
            typeStr.includes('medicalbusiness')
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
