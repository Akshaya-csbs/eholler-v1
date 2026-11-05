import axios from 'axios';
import * as cheerio from 'cheerio';
import { WebsiteAuditData } from './types';

/**
 * Normalizes a URL to ensure proper protocol and format
 */
function normalizeUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Checks if robots.txt restricts crawling
 */
async function checkRobotsTxt(origin: string): Promise<string | undefined> {
  try {
    const robotsRes = await axios.get(`${origin}/robots.txt`, {
      timeout: 3000,
      validateStatus: (s) => s === 200,
    });
    const text = typeof robotsRes.data === 'string' ? robotsRes.data : '';
    if (text.includes('Disallow: /')) {
      return 'robots.txt present; restricts root path or user-agents.';
    }
    return 'robots.txt present and accessible.';
  } catch {
    return undefined; // Not present or unreachable
  }
}

/**
 * Crawls and cross-verifies business website for Local SEO signals, NAP parity,
 * Schema.org markup, headings, meta tags, and internal key pages.
 */
export async function scrapeWebsite(
  rawUrl: string,
  businessPhone?: string,
  city?: string,
  businessName?: string
): Promise<WebsiteAuditData> {
  const url = normalizeUrl(rawUrl);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = new URL('https://example.com');
  }

  const origin = parsedUrl.origin;

  const result: WebsiteAuditData = {
    url,
    isHttps: url.startsWith('https://'),
    hasPhoneMatch: false,
    hasAddressMatch: false,
    hasLocalBusinessSchema: false,
    subpagesCrawled: [],
    schemasFound: [],
    h1Headings: [],
    h2Headings: [],
    headings: [],
    paragraphs: [],
    servicesMentioned: [],
    images: { total: 0, withAlt: 0, missingAlt: 0, sampleAltTexts: [] },
  };

  const startTime = Date.now();

  try {
    // 1. Check robots.txt (non-blocking)
    const robotsPromise = checkRobotsTxt(origin);

    // 2. Fetch Homepage
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

    // Title & Meta Description
    result.title = $('title').text().trim();
    result.metaDescription =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      '';

    // Canonical URL
    result.canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim() || undefined;

    // Robots Directives
    const robotsMeta =
      $('meta[name="robots"]').attr('content')?.trim() ||
      $('meta[name="googlebot"]').attr('content')?.trim() ||
      undefined;

    const robotsTxtStatus = await robotsPromise;
    result.robotsDirectives = [robotsMeta ? `Meta: ${robotsMeta}` : null, robotsTxtStatus]
      .filter(Boolean)
      .join(' | ') || undefined;

    // H1 and H2 Headings
    const h1s: string[] = [];
    $('h1').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 2 && !h1s.includes(text)) h1s.push(text);
    });
    result.h1Headings = h1s.slice(0, 5);

    const h2s: string[] = [];
    $('h2').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 2 && !h2s.includes(text)) h2s.push(text);
    });
    result.h2Headings = h2s.slice(0, 10);
    result.headings = [...h1s, ...h2s].slice(0, 15);

    // Body text for matching
    const pageText = $('body').text().toLowerCase();

    // Substantial Paragraphs & About Snippet
    const paragraphs: string[] = [];
    $('p, article, section').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 35 && text.length <= 400 && !paragraphs.includes(text)) {
        paragraphs.push(text);
      }
    });
    result.paragraphs = paragraphs.slice(0, 8);
    result.aboutSnippet =
      paragraphs.find(
        (p) =>
          p.toLowerCase().includes('about') ||
          p.toLowerCase().includes('specializ') ||
          p.toLowerCase().includes('consult') ||
          p.toLowerCase().includes('service') ||
          p.toLowerCase().includes('provider')
      ) ||
      paragraphs[0] ||
      '';

    // Image & Alt Text Inspection
    let totalImages = 0;
    let withAlt = 0;
    let missingAlt = 0;
    const sampleAlts: string[] = [];

    $('img').each((_, el) => {
      totalImages++;
      const alt = $(el).attr('alt');
      if (alt !== undefined && alt.trim().length > 0) {
        withAlt++;
        if (sampleAlts.length < 5) sampleAlts.push(alt.trim());
      } else {
        missingAlt++;
      }
    });

    result.images = {
      total: totalImages,
      withAlt,
      missingAlt,
      sampleAltTexts: sampleAlts,
    };

    // Universal Services & Offerings Detection
    const genericNavTerms = new Set([
      'home', 'about', 'about us', 'contact', 'contact us', 'privacy', 'privacy policy',
      'terms', 'terms of service', 'blog', 'news', 'login', 'sign in', 'signup',
      'cart', 'checkout', 'faq', 'faqs', 'help', 'support', 'disclaimer', 'sitemap',
      'read more', 'learn more', 'click here', 'view more', 'view all', 'get in touch',
      'careers', 'portfolio', 'case studies', 'testimonials', 'reviews', 'pricing',
      'menu', 'search', 'portal', 'account', 'register',
      // Explicitly reject generic category words that are NOT specific services
      'services', 'our services', 'all services', 'what we do', 'offerings', 'our offerings',
      'solutions', 'our solutions', 'all solutions', 'products', 'all products', 'our products',
      'practice', 'practices', 'overview', 'capabilities', 'explore', 'industries', 'sectors',
      'company', 'corporate', 'corporate office', 'office', 'headquarters', 'business',
      'business services', 'commercial services', 'professional services', 'establishment',
      'point of interest', 'featured case studies', 'case study', 'resources', 'insights',
      'whitepapers', 'downloads', 'legal', 'security', 'compliance', 'investors', 'investor relations',
      'press', 'media', 'newsroom', 'leadership', 'team', 'management'
    ]);

    const servicesFound: string[] = [];

    // 1. Service links in Navigation, Menus & Headers
    $('nav a, header a, .menu a, .nav a, [role="navigation"] a').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const href = $(el).attr('href')?.toLowerCase() || '';
      const textLower = text.toLowerCase();

      if (
        text.length >= 4 &&
        text.length <= 50 &&
        !genericNavTerms.has(textLower) &&
        textLower !== 'services' &&
        textLower !== 'solutions' &&
        textLower !== 'products'
      ) {
        const isServiceRelated =
          href.includes('service') ||
          href.includes('solution') ||
          href.includes('product') ||
          href.includes('offering') ||
          href.includes('what-we-do') ||
          href.includes('practice') ||
          href.includes('specialt') ||
          $(el).parents('.sub-menu, .dropdown, [class*="service"], [class*="solution"]').length > 0;

        if (isServiceRelated && !servicesFound.some((s) => s.toLowerCase() === textLower)) {
          servicesFound.push(text);
        }
      }
    });

    // 2. Service lists & cards
    $(
      '.service, .services, #services, .solutions, #solutions, .service-card, .service-item, .offering, [class*="service-title"], [class*="service-item"]'
    ).each((_, el) => {
      const title = $(el).find('h2, h3, h4, strong, a').first().text().replace(/\s+/g, ' ').trim();
      const text = title || $(el).text().replace(/\s+/g, ' ').trim();
      const textLower = text.toLowerCase();

      if (
        text.length >= 4 &&
        text.length <= 45 &&
        !genericNavTerms.has(textLower) &&
        textLower !== 'services' &&
        textLower !== 'solutions' &&
        textLower !== 'products' &&
        !servicesFound.some((s) => s.toLowerCase() === textLower)
      ) {
        servicesFound.push(text);
      }
    });

    // 3. Relevant Section Headings
    h2s.forEach((h) => {
      const hLower = h.toLowerCase();
      if (
        h.length >= 4 &&
        h.length <= 40 &&
        !genericNavTerms.has(hLower) &&
        hLower !== 'services' &&
        hLower !== 'solutions' &&
        hLower !== 'products' &&
        !servicesFound.some((s) => s.toLowerCase() === hLower)
      ) {
        servicesFound.push(h);
      }
    });

    result.servicesMentioned = servicesFound.slice(0, 15);

    // Booking / Appointment URLs
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
            foundAppointmentUrl = `${origin}${href}`;
          }
        }
      }
    });
    result.appointmentUrl = foundAppointmentUrl;

    // Contact Emails
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      result.contactEmails = Array.from<string>(
        new Set(
          emailMatches.filter(
            (e: string) => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp')
          )
        )
      ).slice(0, 3);
    }

    // Phone match
    if (businessPhone) {
      const cleanPhone = businessPhone.replace(/\D/g, '');
      const last7Digits = cleanPhone.slice(-7);
      if (last7Digits && pageText.replace(/\D/g, '').includes(last7Digits)) {
        result.hasPhoneMatch = true;
      }
    }

    // City / Address match
    if (city && city.trim().length > 2) {
      const cityLower = city.toLowerCase().trim();
      if (pageText.includes(cityLower)) {
        result.hasAddressMatch = true;
      }
    }

    // Business Name match
    let nameMatched = false;
    if (businessName && businessName.trim().length > 2) {
      const cleanName = businessName.toLowerCase().trim();
      if (pageText.includes(cleanName) || (result.title && result.title.toLowerCase().includes(cleanName))) {
        nameMatched = true;
      }
    }

    // Schema.org Structured Data
    const schemasFound: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          const typeStr = JSON.stringify(parsed).toLowerCase();

          if (parsed['@type']) {
            const types = Array.isArray(parsed['@type']) ? parsed['@type'] : [parsed['@type']];
            types.forEach((t: string) => {
              if (t && !schemasFound.includes(t)) schemasFound.push(t);
            });
          }

          if (
            typeStr.includes('localbusiness') ||
            typeStr.includes('organization') ||
            typeStr.includes('professionalservice') ||
            typeStr.includes('store') ||
            typeStr.includes('medicalbusiness') ||
            typeStr.includes('dentist') ||
            typeStr.includes('restaurant')
          ) {
            result.hasLocalBusinessSchema = true;
          }
        }
      } catch {
        // Ignore JSON parse errors in script tags
      }
    });
    result.schemasFound = schemasFound;

    // Discover internal links (same origin only)
    const internalLinks: { url: string; type: 'contact' | 'about' | 'services' | 'location' | 'other' }[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
        return;
      }

      try {
        const resolved = new URL(href, origin);
        if (resolved.origin === origin && resolved.pathname !== '/' && resolved.pathname !== parsedUrl.pathname) {
          const pathLower = resolved.pathname.toLowerCase();
          const textLower = $(el).text().toLowerCase();
          let type: 'contact' | 'about' | 'services' | 'location' | 'other' = 'other';

          if (pathLower.includes('service') || pathLower.includes('solution') || pathLower.includes('offering') || pathLower.includes('what-we-do') || textLower.includes('services')) {
            type = 'services';
          } else if (pathLower.includes('about') || pathLower.includes('who-we-are') || pathLower.includes('company') || textLower.includes('about us')) {
            type = 'about';
          } else if (pathLower.includes('location') || pathLower.includes('area') || textLower.includes('locations')) {
            type = 'location';
          } else if (pathLower.includes('contact') || textLower.includes('contact')) {
            type = 'contact';
          }

          if (type !== 'other' && !internalLinks.some((l) => l.url === resolved.href)) {
            internalLinks.push({ url: resolved.href, type });
          }
        }
      } catch {
        // ignore invalid link
      }
    });

    result.internalLinksCount = internalLinks.length;

    // Prioritize crawling order: 1. Services subpage, 2. About subpage, 3. Contact/Location
    const prioritizedSubpages = [
      ...internalLinks.filter((l) => l.type === 'services'),
      ...internalLinks.filter((l) => l.type === 'about'),
      ...internalLinks.filter((l) => l.type === 'contact' || l.type === 'location'),
    ];

    const keySubpagesToCrawl = prioritizedSubpages.slice(0, 3);
    for (const sub of keySubpagesToCrawl) {
      try {
        const subRes = await axios.get(sub.url, {
          timeout: 4500,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          maxRedirects: 3,
        });

        const sub$ = cheerio.load(subRes.data);
        const subTitle = sub$('title').text().trim() || undefined;
        const subText = sub$('body').text().toLowerCase();

        // If this is a Services subpage, extract its rich service titles
        if (sub.type === 'services') {
          sub$('h1, h2, h3, .service-title, [class*="service"]').each((_, el) => {
            const heading = sub$(el).text().replace(/\s+/g, ' ').trim();
            if (
              heading.length >= 4 &&
              heading.length <= 50 &&
              !genericNavTerms.has(heading.toLowerCase()) &&
              !result.servicesMentioned?.some((s) => s.toLowerCase() === heading.toLowerCase())
            ) {
              result.servicesMentioned?.push(heading);
            }
          });
        }

        // If this is an About page, extract rich company mission snippet
        if (sub.type === 'about') {
          const aboutParas: string[] = [];
          sub$('p, article, section').each((_, el) => {
            const p = sub$(el).text().replace(/\s+/g, ' ').trim();
            if (p.length >= 40 && p.length <= 400 && !aboutParas.includes(p)) {
              aboutParas.push(p);
            }
          });
          if (aboutParas.length > 0 && (!result.aboutSnippet || result.aboutSnippet.length < 80)) {
            result.aboutSnippet = aboutParas.slice(0, 2).join(' ');
          }
        }

        // Check if phone or address matches on Contact page if not found on homepage
        if (!result.hasPhoneMatch && businessPhone) {
          const cleanPhone = businessPhone.replace(/\D/g, '');
          const last7Digits = cleanPhone.slice(-7);
          if (last7Digits && subText.replace(/\D/g, '').includes(last7Digits)) {
            result.hasPhoneMatch = true;
          }
        }

        if (!result.hasAddressMatch && city && city.trim().length > 2) {
          if (subText.includes(city.toLowerCase().trim())) {
            result.hasAddressMatch = true;
          }
        }

        result.subpagesCrawled?.push({
          url: sub.url,
          title: subTitle,
          type: sub.type,
          statusCode: subRes.status,
        });
      } catch {
        result.subpagesCrawled?.push({
          url: sub.url,
          type: sub.type,
          statusCode: 0,
        });
      }
    }

    // Deduplicate and cap extracted services
    if (result.servicesMentioned && result.servicesMentioned.length > 0) {
      result.servicesMentioned = Array.from(new Set(result.servicesMentioned)).slice(0, 15);
    }

    result.napConsistency = {
      nameFound: nameMatched,
      phoneFound: result.hasPhoneMatch,
      addressFound: result.hasAddressMatch,
      detectedPhone: businessPhone && result.hasPhoneMatch ? businessPhone : undefined,
      detectedAddress: city && result.hasAddressMatch ? city : undefined,
    };

    return result;
  } catch (error: any) {
    console.warn(`Website crawl failed or restricted for ${url}:`, error.message);
    result.loadTimeMs = Date.now() - startTime;
    result.isHttps = url.startsWith('https://');
    return result;
  }
}

/**
 * Lightweight website scraper for verifying discovered competitor websites.
 * Extracts title, meta description, H1/H2 headings, and services to establish
 * whether the competitor actually offers the same or similar services.
 */
export async function scrapeCandidateSummary(rawUrl: string): Promise<{
  title?: string;
  metaDescription?: string;
  headings: string[];
  services: string[];
  isReachable: boolean;
  evidenceUrl: string;
}> {
  const url = normalizeUrl(rawUrl);
  const genericTerms = new Set([
    'home', 'about', 'about us', 'contact', 'contact us', 'privacy', 'terms',
    'blog', 'news', 'login', 'careers', 'services', 'our services', 'all services',
    'solutions', 'our solutions', 'products', 'overview', 'company', 'corporate',
    'corporate office', 'business', 'business services', 'read more', 'learn more',
    'get in touch', 'faq', 'portfolio', 'testimonials', 'menu', 'search'
  ]);

  try {
    const res = await axios.get(url, {
      timeout: 4000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      maxRedirects: 2,
    });

    const $ = cheerio.load(res.data);
    const title = $('title').text().replace(/\s+/g, ' ').trim();
    const metaDescription =
      $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim() || '';

    const headings: string[] = [];
    $('h1, h2').each((_, el) => {
      const h = $(el).text().replace(/\s+/g, ' ').trim();
      const hLower = h.toLowerCase();
      if (
        h.length >= 4 &&
        h.length <= 60 &&
        !genericTerms.has(hLower) &&
        !headings.includes(h)
      ) {
        headings.push(h);
      }
    });

    const services: string[] = [];
    $('nav a, header a, .service, .services, #services, h2, h3').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const textLower = text.toLowerCase();
      if (
        text.length >= 4 &&
        text.length <= 45 &&
        !genericTerms.has(textLower) &&
        textLower !== 'services' &&
        textLower !== 'solutions' &&
        !services.includes(text)
      ) {
        services.push(text);
      }
    });

    return {
      title: title || undefined,
      metaDescription: metaDescription || undefined,
      headings: headings.slice(0, 8),
      services: services.slice(0, 10),
      isReachable: true,
      evidenceUrl: url,
    };
  } catch {
    return {
      headings: [],
      services: [],
      isReachable: false,
      evidenceUrl: url,
    };
  }
}
