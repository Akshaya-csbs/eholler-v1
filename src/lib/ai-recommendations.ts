import axios from 'axios';
import { GooglePlaceData, WebsiteAuditData, CompetitorItem } from './types';

export async function generateAiRecommendations(
  place: GooglePlaceData,
  siteAudit?: WebsiteAuditData,
  competitors: CompetitorItem[] = []
): Promise<{ recommendations: string[]; descriptionDraft: string }> {
  const apiKey = process.env.OPENAI_API_KEY;

  const bizName = place.displayName || 'Business';
  const category = place.primaryType || 'Consultant';
  const city = place.formattedAddress?.split(',')?.slice(-4, -2)?.join(', ') || 'Local Region';
  const website = place.websiteUri || siteAudit?.url || '';
  const reviewCount = place.userRatingCount || 0;
  const rating = place.rating || 0;

  // Fallback defaults that accurately reflect the screenshot logic
  const defaultRecommendations = [
    `Launch an automated review collection campaign targeting existing and past clients to aggressively grow review volume from ${reviewCount} toward at least 150+ high-quality Google reviews.`,
    website.startsWith('http://') || !siteAudit?.isHttps
      ? `Upgrade the website security by installing an SSL certificate and redirecting all traffic from HTTP to secure HTTPS ('${website.replace('http://', 'https://')}').`
      : `Implement LocalBusiness JSON-LD Schema markup on ${website} to reinforce Name, Address, and Phone (NAP) parity for Google search crawlers.`,
    `Post weekly updates on the Google Business Profile featuring case studies, ${category} tips, and recent client outcomes to boost local engagement metrics.`,
    `Optimize Google Business Profile secondary categories and expand service catalog with specific service deliverables.`,
  ];

  const defaultDescription = `${bizName} is a premier ${category} dedicated to serving clients across ${city} and neighboring areas. We offer high-quality ${category} services, customer-first support, and dependable results (${rating}★ rating from ${reviewCount} client reviews). Our team is committed to excellence, transparent communication, and tailored solutions. Contact us today or visit our location in ${city} for inquiries or to schedule an appointment.`;

  if (!apiKey) {
    return {
      recommendations: defaultRecommendations,
      descriptionDraft: defaultDescription,
    };
  }

  // If OPENAI_API_KEY is present, call OpenAI API for live dynamic synthesis
  try {
    const prompt = `
You are an expert Local SEO Specialist. Analyze this business and generate:
1. 3 to 4 actionable, high-impact Local SEO recommendations (matching the style of the Local SEO Agent).
2. A compelling, professional 750-character Google Business Profile description optimized with local keywords.

Business Details:
- Name: ${bizName}
- Category: ${category}
- Address: ${place.formattedAddress}
- Website: ${website} (Is HTTPS: ${siteAudit?.isHttps})
- Review Count: ${reviewCount} (Rating: ${rating})
- Missing Fields: Description is empty, photos count: ${place.photosCount}
- Top Competitors: ${competitors.map(c => `${c.name} (${c.reviews} reviews, ${c.rating}★)`).join('; ')}

Return strictly JSON with keys:
{
  "recommendations": ["rec1", "rec2", "rec3"],
  "descriptionDraft": "750 char description"
}
`;

    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a Local SEO analysis engine returning structured JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 10000,
      }
    );

    const parsed = JSON.parse(res.data.choices[0]?.message?.content || '{}');
    return {
      recommendations: parsed.recommendations || defaultRecommendations,
      descriptionDraft: parsed.descriptionDraft || defaultDescription,
    };
  } catch (err) {
    console.warn('OpenAI API call failed or timed out, using intelligent fallback:', err.message);
    return {
      recommendations: defaultRecommendations,
      descriptionDraft: defaultDescription,
    };
  }
}
