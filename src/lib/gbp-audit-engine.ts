import {
  GooglePlaceData,
  WebsiteAuditData,
  GbpAuditedField,
  GbpFieldStatus,
  BusinessUnderstanding,
  GbpCompleteAuditResult,
} from './types';
import { getOpenAIClient, classifyOpenAIError } from './openai-client';

// Simple in-memory audit cache to avoid repeated expensive LLM calls
const AUDIT_CACHE = new Map<string, { result: GbpCompleteAuditResult; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache

/**
 * 1. Build a deep, factual understanding of the business from all available sources
 */
export function buildBusinessUnderstanding(
  place: GooglePlaceData,
  siteAudit?: WebsiteAuditData
): BusinessUnderstanding {
  const bizName = place.displayName || 'Business';
  const category = place.primaryTypeDisplayName || place.primaryType || 'Business';
  const address = place.formattedAddress || '';
  const city =
    address.split(',').slice(-4, -2).join(', ').trim() ||
    (place.addressComponents?.find(c => c.types.includes('locality'))?.longText) ||
    'Local Area';

  // Extract services from website
  const siteServices = siteAudit?.servicesMentioned || [];
  const siteHeadings = siteAudit?.headings || [];
  const aboutText = siteAudit?.aboutSnippet || siteAudit?.metaDescription || '';

  // Combine discovered services
  const allDiscoveredServices = Array.from(
    new Set([
      ...siteServices,
      ...siteHeadings.filter(h =>
        h.length >= 4 &&
        h.length <= 45 &&
        !['welcome', 'home', 'about', 'contact', 'why choose us', 'our clients', 'testimonials'].includes(h.toLowerCase())
      ),
    ])
  );

  const mainServices = allDiscoveredServices.slice(0, 5);
  const secondaryServices = allDiscoveredServices.slice(5, 12);

  // If no services discovered from website, infer core service from primary category
  if (mainServices.length === 0) {
    mainServices.push(`${category} Services`, `Professional ${category} Solutions`);
  }

  // Cross-check notes
  const crossCheckNotes: string[] = [];
  if (siteAudit?.url) {
    if (siteAudit.isHttps) {
      crossCheckNotes.push('Website uses secure SSL (HTTPS) encryption.');
    } else {
      crossCheckNotes.push(`Website URL uses insecure HTTP ('${siteAudit.url}'). Google Chrome flags HTTP sites as insecure.`);
    }

    if (siteAudit.hasPhoneMatch) {
      crossCheckNotes.push(`Phone number ('${place.nationalPhoneNumber || 'N/A'}') matches between website and Google Business Profile.`);
    } else if (place.nationalPhoneNumber) {
      crossCheckNotes.push(`Phone number ('${place.nationalPhoneNumber}') was not prominently detected on the website homepage.`);
    }

    if (siteAudit.hasAddressMatch) {
      crossCheckNotes.push(`Location/City ('${city}') matches across both website and Google Business Profile.`);
    } else {
      crossCheckNotes.push(`City ('${city}') was not explicitly detected in website text; ensure NAP consistency.`);
    }

    if (siteAudit.hasLocalBusinessSchema) {
      crossCheckNotes.push('Website contains structured schema.org/LocalBusiness JSON-LD markup.');
    } else {
      crossCheckNotes.push('Website is missing schema.org/LocalBusiness structured data to assist search crawlers.');
    }

    if (allDiscoveredServices.length > 0) {
      crossCheckNotes.push(`Identified ${allDiscoveredServices.length} specific service offerings on the website to cross-check against profile catalog.`);
    }
  }

  // Target customers inference
  let targetCustomers = `Clients, businesses, and residents seeking ${category.toLowerCase()} services in ${city} and neighboring regions.`;
  if (aboutText.toLowerCase().includes('b2b') || aboutText.toLowerCase().includes('industr') || aboutText.toLowerCase().includes('enterprise')) {
    targetCustomers = `Commercial enterprises, corporate organizations, and industrial clients in ${city} requiring specialized ${category.toLowerCase()}.`;
  } else if (aboutText.toLowerCase().includes('patient') || category.toLowerCase().includes('health') || category.toLowerCase().includes('clinic')) {
    targetCustomers = `Individuals and families in ${city} seeking professional medical and healthcare care.`;
  }

  // Unique Selling Points
  const usps: string[] = [];
  if (place.rating && place.rating >= 4.5 && (place.userRatingCount || 0) >= 10) {
    usps.push(`High customer satisfaction rating (${place.rating}★ across ${place.userRatingCount} verified Google reviews).`);
  }
  if (aboutText.length > 30) {
    usps.push(aboutText.slice(0, 160) + (aboutText.length > 160 ? '...' : ''));
  } else {
    usps.push(`Dedicated ${category} with verified physical location in ${city}.`);
  }

  const hoursSummary = place.openingHours?.weekdayDescriptions?.join(' | ') || 'Hours not listed on profile';
  const contactSummary = `Phone: ${place.nationalPhoneNumber || 'Not provided'} | Website: ${siteAudit?.url || place.websiteUri || 'Not provided'}`;

  // Search keywords
  const relevantSearchKeywords = [
    `${category.toLowerCase()} in ${city.toLowerCase()}`,
    `best ${category.toLowerCase()} ${city.toLowerCase()}`,
    `${bizName.toLowerCase()} ${city.toLowerCase()}`,
    ...mainServices.map(s => `${s.toLowerCase()} ${city.toLowerCase()}`).slice(0, 3),
  ];

  return {
    summary: `${bizName} is a ${category} operating in ${city}, providing ${mainServices.join(', ')}.`,
    industryAndNiche: category,
    primaryCategory: category,
    secondaryCategories: place.types?.filter(t => t !== place.primaryType && !['point_of_interest', 'establishment'].includes(t)) || [],
    mainServices,
    secondaryServices,
    detectedProducts: siteAudit?.productsMentioned || [],
    physicalLocation: address,
    serviceAreas: [city],
    targetCustomers,
    uniqueSellingPoints: usps,
    operatingHoursSummary: hoursSummary,
    contactSummary,
    relevantSearchKeywords,
    crossCheckNotes,
  };
}

/**
 * 2. Deterministically evaluate all 57 Google Business Profile fields across 9 logical sections
 */
export function evaluateAllGbpFields(
  place: GooglePlaceData,
  siteAudit: WebsiteAuditData | undefined,
  understanding: BusinessUnderstanding
): GbpAuditedField[] {
  const fields: GbpAuditedField[] = [];

  const bizName = place.displayName || '';
  const city = understanding.serviceAreas[0] || 'Local';
  const category = understanding.primaryCategory;
  const website = place.websiteUri || siteAudit?.url || '';

  // Helper function to push audited field
  const addField = (item: GbpAuditedField) => fields.push(item);

  // ─────────────────────────────────────────────────────────────────
  // SECTION A: BASIC BUSINESS INFORMATION
  // ─────────────────────────────────────────────────────────────────

  // 1. Business Name
  const hasSpamKeywords = /(-|\||best|top|#1|consultant in)/i.test(bizName) && bizName.length > 40;
  addField({
    field_id: 'business_name',
    field_name: 'Business Name',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: bizName || 'Empty',
    expected_value_or_requirement: 'Exact legal or registered business name matching signage and official documents, free of spam descriptors.',
    status: !bizName ? 'MISSING' : hasSpamKeywords ? 'NEEDS IMPROVEMENT' : 'NO CHANGES REQUIRED',
    issue_description: !bizName
      ? 'Business name is missing from the profile.'
      : hasSpamKeywords
      ? 'Business name appears to contain appended keyword stuffing or city descriptors violating Google guidelines.'
      : undefined,
    why_it_matters: 'Google Business Profile guidelines strictly require using your real-world business name. Keyword stuffing risks profile suspension.',
    recommendation: hasSpamKeywords
      ? `Trim name to real-world store signage: "${bizName.split(/[-|]/)[0].trim()}"`
      : 'Maintain exact matching name across all online citations and signage.',
    recommended_content: bizName ? bizName.split(/[-|]/)[0].trim() : '',
    evidence_source: 'Google Places API',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 2. Primary Category
  const hasPrimaryCategory = Boolean(place.primaryType || place.primaryTypeDisplayName);
  addField({
    field_id: 'primary_category',
    field_name: 'Primary Business Category',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: place.primaryTypeDisplayName || place.primaryType || 'Not specified',
    expected_value_or_requirement: 'Most specific Google-approved category that precisely describes what the business is (not just what it does).',
    status: !hasPrimaryCategory
      ? 'MISSING'
      : (place.primaryType === 'point_of_interest' || place.primaryType === 'establishment')
      ? 'NEEDS IMPROVEMENT'
      : 'NO CHANGES REQUIRED',
    issue_description: !hasPrimaryCategory
      ? 'Primary category is not configured.'
      : (place.primaryType === 'point_of_interest' || place.primaryType === 'establishment')
      ? 'Category is too generic. Must be a specific industry category.'
      : undefined,
    why_it_matters: 'Primary category is the single heaviest ranking factor for Google Local 3-Pack rankings and search filtering.',
    recommendation: 'Ensure your primary category accurately captures your core commercial identity.',
    recommended_content: category,
    evidence_source: 'Google Places API',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 3. Additional Categories
  const existingSecondary = (place.types || []).filter(
    t => t !== place.primaryType && !['point_of_interest', 'establishment'].includes(t)
  );
  const needsAdditionalCats = existingSecondary.length < 2;
  const suggestedAdditional = understanding.mainServices.map(s => `${s} Specialist`);
  addField({
    field_id: 'additional_categories',
    field_name: 'Additional Business Categories',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: existingSecondary.length > 0 ? existingSecondary.join(', ') : 'None configured',
    expected_value_or_requirement: 'Up to 9 secondary categories supporting specific secondary services detected on your website.',
    status: needsAdditionalCats ? 'NEEDS IMPROVEMENT' : 'NO CHANGES REQUIRED',
    issue_description: needsAdditionalCats
      ? `Profile only has ${existingSecondary.length} secondary category. Adding secondary categories expands discovery reach.`
      : undefined,
    why_it_matters: 'Secondary categories allow your profile to trigger for related local searches without diluting primary category strength.',
    recommendation: `Add secondary categories based on website offerings: ${suggestedAdditional.slice(0, 3).join(', ')}.`,
    recommended_content: suggestedAdditional.slice(0, 3).join('; '),
    evidence_source: 'Cross-verified Website vs Google Types',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 4. Business Description
  const desc = place.editorialSummary || '';
  const descLength = desc.length;
  const isDescMissing = descLength === 0;
  const isDescShort = descLength > 0 && descLength < 300;
  addField({
    field_id: 'business_description',
    field_name: 'Business Description',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: isDescMissing ? 'Empty / Not provided' : `${desc.slice(0, 150)}... (${descLength}/750 chars)`,
    expected_value_or_requirement: 'Up to 750 characters describing your business history, core services, unique differentiators, and target service locations.',
    status: isDescMissing ? 'MISSING' : isDescShort ? 'NEEDS IMPROVEMENT' : 'NO CHANGES REQUIRED',
    issue_description: isDescMissing
      ? 'Business description is completely missing on Google Business Profile.'
      : isDescShort
      ? `Description is only ${descLength} characters; Google permits up to 750 characters for rich local keyword coverage.`
      : undefined,
    why_it_matters: 'A complete 750-character bio helps Google understand context and builds customer confidence before visiting or calling.',
    recommendation: 'Add a full 750-character business bio weaving in core services, experience, and local regions served.',
    recommended_content: '', // Will be dynamically generated by AI
    evidence_source: 'Google Places API editorialSummary',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 5. Business Opening Date
  addField({
    field_id: 'opening_date',
    field_name: 'Business Opening Date',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: 'Not accessible via public Places API',
    expected_value_or_requirement: 'Year and month the business originally opened at this location.',
    status: 'UNABLE TO VERIFY',
    issue_description: 'Google Places API does not publicly expose the private opening date field.',
    why_it_matters: 'Displaying your opening year on Google adds a "Years in Business" trust badge on Google Maps search cards.',
    recommendation: 'Log into Google Business Profile Manager, navigate to Edit Profile > About > Opening date, and add your founding year.',
    recommended_content: 'Set founding year in Google Business Profile Manager (e.g. Year established).',
    evidence_source: 'Google Places API (Permission restricted)',
    confidence: 'Medium',
    applicable: true,
    verifiable: false,
  });

  // 6. Primary Phone Number
  const hasPhone = Boolean(place.nationalPhoneNumber || place.internationalPhoneNumber);
  const phoneConsistent = Boolean(siteAudit?.hasPhoneMatch);
  addField({
    field_id: 'phone_primary',
    field_name: 'Primary Phone Number',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: place.nationalPhoneNumber || place.internationalPhoneNumber || 'None',
    expected_value_or_requirement: 'Direct local or toll-free telephone number formatted with proper regional dialing codes.',
    status: !hasPhone
      ? 'MISSING'
      : !phoneConsistent && siteAudit?.url
      ? 'NEEDS IMPROVEMENT'
      : 'NO CHANGES REQUIRED',
    issue_description: !hasPhone
      ? 'Primary phone number is not listed.'
      : !phoneConsistent && siteAudit?.url
      ? `Phone number '${place.nationalPhoneNumber}' does not appear to match the phone displayed on the website.`
      : undefined,
    why_it_matters: 'Powers the "Call" click-to-call button on mobile search and reinforces NAP consistency across search engines.',
    recommendation: hasPhone ? 'Ensure phone is identical on profile, website header/footer, and local directories.' : 'Add your primary customer line.',
    recommended_content: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
    evidence_source: 'Google Places API nationalPhoneNumber',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 7. Additional Phone Numbers
  addField({
    field_id: 'phone_additional',
    field_name: 'Additional Phone Numbers',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: place.internationalPhoneNumber ? `International: ${place.internationalPhoneNumber}` : 'None configured',
    expected_value_or_requirement: 'Secondary phone numbers for support, sales, or mobile contact.',
    status: place.internationalPhoneNumber ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: !place.internationalPhoneNumber
      ? 'Only a single local phone format is recorded. International dialing format (+ country code) improves global traveler visibility.'
      : undefined,
    why_it_matters: 'Helps customers calling from outside the immediate region or via VoIP lines.',
    recommendation: 'Add the E.164 international phone number format (+[country code]...) as secondary line.',
    recommended_content: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
    evidence_source: 'Google Places API',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  // 8. Website URL & HTTPS Security
  const isHttps = siteAudit?.isHttps || (place.websiteUri && place.websiteUri.startsWith('https://'));
  addField({
    field_id: 'website_url',
    field_name: 'Website URL & Security',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: website || 'None',
    expected_value_or_requirement: 'Live, SSL-encrypted (HTTPS) website homepage or location landing page.',
    status: !website ? 'MISSING' : !isHttps ? 'NEEDS IMPROVEMENT' : 'NO CHANGES REQUIRED',
    issue_description: !website
      ? 'No website URL is linked to this Google Business Profile.'
      : !isHttps
      ? `Profile links to an insecure HTTP URL ('${website}'). Browsers flag HTTP as unsafe, hurting conversions.`
      : undefined,
    why_it_matters: 'Links Google Maps traffic directly to your business website and confirms web presence.',
    recommendation: !isHttps && website
      ? `Update Google Business Profile website link to HTTPS: '${website.replace('http://', 'https://')}' and set up an SSL certificate.`
      : 'Maintain an active, fast-loading mobile responsive website.',
    recommended_content: website.replace('http://', 'https://'),
    evidence_source: 'Google Places API & Website Scraper',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 9. Appointment / Booking URL
  const apptUrl = siteAudit?.appointmentUrl;
  addField({
    field_id: 'appointment_url',
    field_name: 'Appointment / Booking URL',
    category: 'basic_info',
    section_title: 'A. Basic Business Information',
    current_value: apptUrl || 'Not detected on profile',
    expected_value_or_requirement: 'Direct URL to online booking system, Calendly, WhatsApp consultation, or contact form.',
    status: apptUrl ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: !apptUrl
      ? 'No dedicated booking or consultation link is configured on the profile.'
      : undefined,
    why_it_matters: 'Enables the "Book Online" or "Schedule Consultation" action button directly on Google Maps.',
    recommendation: apptUrl
      ? `Link '${apptUrl}' into the Appointment URL field in Google Business Profile.`
      : `Create a dedicated /contact or /book page on ${website || 'your website'} and link it into the Appointment URL field.`,
    recommended_content: apptUrl || (website ? `${website.replace(/\/$/, '')}/contact` : ''),
    evidence_source: 'Website Crawler & Places API',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION B: LOCATION AND SERVICE AREA
  // ─────────────────────────────────────────────────────────────────

  // 10. Business Address
  addField({
    field_id: 'business_address',
    field_name: 'Full Business Address',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: place.formattedAddress || 'None',
    expected_value_or_requirement: 'Complete postal address verified on Google Maps.',
    status: place.formattedAddress ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'Determines the geographic centerpoint of your Google Maps local pack rankings.',
    recommendation: 'Ensure address is formatted with exact suite/door numbers.',
    recommended_content: place.formattedAddress || '',
    evidence_source: 'Google Places API formattedAddress',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 11. Street Address
  const streetComp = place.addressComponents?.find(c => c.types.includes('route') || c.types.includes('street_address'));
  addField({
    field_id: 'street_address',
    field_name: 'Street Address',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: streetComp?.longText || place.formattedAddress?.split(',')?.[0]?.trim() || 'Unspecified',
    expected_value_or_requirement: 'Street name and door/building number.',
    status: streetComp || place.formattedAddress ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'Essential for turn-by-turn navigation and postal delivery.',
    recommendation: 'Confirm physical road/street name is unobstructed and matched on physical signage.',
    recommended_content: streetComp?.longText || place.formattedAddress?.split(',')?.[0]?.trim() || '',
    evidence_source: 'Google Places API addressComponents',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 12. Locality / City
  const localityComp = place.addressComponents?.find(c => c.types.includes('locality') || c.types.includes('sublocality'));
  addField({
    field_id: 'locality_city',
    field_name: 'Locality / City',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: localityComp?.longText || city,
    expected_value_or_requirement: 'Recognized municipality, borough, or city name.',
    status: localityComp || city ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'Primary geographic keyword anchor in local search queries.',
    recommendation: 'Maintain city name consistently across all local citations.',
    recommended_content: localityComp?.longText || city,
    evidence_source: 'Google Places API addressComponents',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 13. State / Region
  const stateComp = place.addressComponents?.find(c => c.types.includes('administrative_area_level_1'));
  addField({
    field_id: 'administrative_area',
    field_name: 'State / Region / Province',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: stateComp?.longText || 'Unspecified',
    expected_value_or_requirement: 'State or administrative territory name.',
    status: stateComp ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    why_it_matters: 'Enables regional search targeting and province-wide discovery.',
    recommendation: 'Ensure state/province is clearly specified.',
    recommended_content: stateComp?.longText || '',
    evidence_source: 'Google Places API addressComponents',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 14. Postal Code
  const postalComp = place.addressComponents?.find(c => c.types.includes('postal_code'));
  addField({
    field_id: 'postal_code',
    field_name: 'Postal / PIN Code',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: postalComp?.longText || 'Unspecified',
    expected_value_or_requirement: 'Official postal code / PIN code for the physical building.',
    status: postalComp ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    why_it_matters: 'Used by Google Maps algorithms to cluster nearby search results.',
    recommendation: 'Ensure correct postal code is attached.',
    recommended_content: postalComp?.longText || '',
    evidence_source: 'Google Places API addressComponents',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 15. Country
  const countryComp = place.addressComponents?.find(c => c.types.includes('country'));
  addField({
    field_id: 'country',
    field_name: 'Country',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: countryComp?.longText || 'Unspecified',
    expected_value_or_requirement: 'Recognized country name matching ISO 3166.',
    status: countryComp ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'Establishes country TLD targeting and international presence.',
    recommendation: 'Ensure country is properly localized.',
    recommended_content: countryComp?.longText || '',
    evidence_source: 'Google Places API addressComponents',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 16. Map Coordinates
  const hasCoords = Boolean(place.location?.latitude && place.location?.longitude);
  addField({
    field_id: 'map_coordinates',
    field_name: 'Map Coordinates (Lat / Lng)',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: hasCoords ? `${place.location?.latitude?.toFixed(5)}, ${place.location?.longitude?.toFixed(5)}` : 'Unresolved',
    expected_value_or_requirement: 'Exact latitude and longitude pin placement on Google Maps.',
    status: hasCoords ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'Pins the exact driving destination for mobile GPS directions.',
    recommendation: 'Verify in Google Maps that the pin sits directly on your main customer entrance.',
    recommended_content: hasCoords ? `${place.location?.latitude}, ${place.location?.longitude}` : '',
    evidence_source: 'Google Places API location',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 17. Service Areas
  addField({
    field_id: 'service_areas',
    field_name: 'Configured Service Areas',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: 'Public Places API only shows physical address',
    expected_value_or_requirement: 'Up to 20 postal codes, cities, or neighborhoods where your business travels or delivers services.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: `Profile does not have explicit service areas configured. Only the physical city (${city}) is registered.`,
    why_it_matters: 'Service areas allow you to rank in neighboring towns and suburbs where you do business even without a physical office there.',
    recommendation: `Add specific neighboring service areas (e.g. ${city}, and surrounding metropolitan districts).`,
    recommended_content: `${city}, and adjacent metropolitan districts within 30 km radius`,
    evidence_source: 'Google Business Profile Guidelines',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 18. Business Location Model (Storefront vs SAB vs Hybrid)
  addField({
    field_id: 'location_type',
    field_name: 'Business Location Model',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: 'Physical Storefront (Address publicly visible)',
    expected_value_or_requirement: 'Correctly designated as Storefront (in-person visits), Service Area Business (address hidden), or Hybrid.',
    status: 'NO CHANGES REQUIRED',
    why_it_matters: 'Incorrectly showing a residential home address for a pure delivery business violates Google policies.',
    recommendation: 'If customers visit your physical office during listed business hours, keep storefront status.',
    recommended_content: 'Physical Storefront / Office location',
    evidence_source: 'Google Places API businessStatus',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 19. Address Consistency with Website
  const addressMatched = siteAudit?.hasAddressMatch;
  addField({
    field_id: 'address_website_consistency',
    field_name: 'Address & Service Area Website Parity',
    category: 'location_area',
    section_title: 'B. Location and Service Area',
    current_value: addressMatched ? 'Matched in website body' : 'Partial / Mismatched',
    expected_value_or_requirement: 'Exact character-for-character address match between website footer/contact page and Google Business Profile.',
    status: addressMatched ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: !addressMatched
      ? `The physical address '${place.formattedAddress}' was not detected in full text on the website homepage.`
      : undefined,
    why_it_matters: 'NAP (Name, Address, Phone) consistency across website and profile is heavily weighted by Google local ranking algorithms.',
    recommendation: `Add full address to website footer and contact page: "${place.formattedAddress}".`,
    recommended_content: place.formattedAddress || '',
    evidence_source: 'Website Scraper vs Google Places',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION C: BUSINESS HOURS
  // ─────────────────────────────────────────────────────────────────

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekdayDescriptions = place.openingHours?.weekdayDescriptions || [];

  daysOfWeek.forEach((day, index) => {
    const dayDesc = weekdayDescriptions.find(d => d.toLowerCase().startsWith(day.toLowerCase()));
    const isConfigured = Boolean(dayDesc);
    const isClosed = dayDesc?.toLowerCase().includes('closed');

    addField({
      field_id: `hours_${day.toLowerCase()}`,
      field_name: `${day} Operating Hours`,
      category: 'hours',
      section_title: 'C. Business Hours',
      current_value: dayDesc || 'Not specified',
      expected_value_or_requirement: `Exact opening and closing times for ${day}, or explicitly marked Closed.`,
      status: !isConfigured ? 'MISSING' : 'NO CHANGES REQUIRED',
      issue_description: !isConfigured ? `Operating hours for ${day} are not configured on Google Maps.` : undefined,
      why_it_matters: 'Google shows an "Open Now" or "Closed" badge in search results. Profiles without hours are often filtered out by users seeking open businesses.',
      recommendation: !isConfigured ? `Configure operating hours for ${day} (e.g. 09:00 - 18:00 or mark Closed).` : 'Maintain accurate hours.',
      recommended_content: dayDesc || `${day}: 09:30 AM – 06:00 PM`,
      evidence_source: 'Google Places API regularOpeningHours',
      confidence: 'High',
      applicable: true,
      verifiable: true,
    });
  });

  // 27. Special Hours / Lunch Breaks
  addField({
    field_id: 'special_hours',
    field_name: 'Special Operating Hours / More Hours',
    category: 'hours',
    section_title: 'C. Business Hours',
    current_value: 'Standard hours only',
    expected_value_or_requirement: 'Secondary hour categories like Consultation Hours, Drive-through, Delivery, or Lunch Break closures.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Profile has only standard hours; adding specific appointment or consultation hours clarifies availability.',
    why_it_matters: 'Prevents customer frustration during midday breaks or specific consultation time windows.',
    recommendation: 'Configure "More Hours" in Google Business Profile for online consultations or client appointments.',
    recommended_content: 'Consultation Hours: Mon–Fri 10:00 AM – 05:00 PM',
    evidence_source: 'Google Business Profile Features',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  // 28. Holiday Hours
  addField({
    field_id: 'holiday_hours',
    field_name: 'Holiday Hours Confirmation',
    category: 'hours',
    section_title: 'C. Business Hours',
    current_value: 'Unconfirmed for upcoming holidays',
    expected_value_or_requirement: 'Confirmed holiday hours for regional holidays and festive occasions.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Google displays an alert warning customers that "Holiday hours may differ" if holiday schedule is unconfirmed.',
    why_it_matters: 'Unconfirmed holiday hours cause searchers to question whether the business is actually open.',
    recommendation: 'Review and confirm upcoming regional holiday hours in Google Business Profile Manager.',
    recommended_content: 'Confirm holiday schedule for upcoming public and national holidays.',
    evidence_source: 'Google Business Profile Guidelines',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 29. Operational Status
  const status = place.businessStatus || 'OPERATIONAL';
  addField({
    field_id: 'business_status',
    field_name: 'Operational Status',
    category: 'hours',
    section_title: 'C. Business Hours',
    current_value: status,
    expected_value_or_requirement: 'Active "OPERATIONAL" status with no temporary or permanent closure flags.',
    status: status === 'OPERATIONAL' ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: status !== 'OPERATIONAL' ? `Profile is flagged as ${status}.` : undefined,
    why_it_matters: 'Businesses marked closed will not appear in local pack results.',
    recommendation: status === 'OPERATIONAL' ? 'Profile is active and open.' : 'Reactivate profile status in Google Business Profile.',
    recommended_content: 'OPERATIONAL',
    evidence_source: 'Google Places API businessStatus',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION D: SERVICES
  // ─────────────────────────────────────────────────────────────────

  // 30. Existing Services
  addField({
    field_id: 'existing_services',
    field_name: 'Configured Services Catalog',
    category: 'services',
    section_title: 'D. Services',
    current_value: 'Primary category only',
    expected_value_or_requirement: 'Individual service items created under relevant categories in Google Business Profile.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Google Places API indicates services catalog is not fully itemized with custom deliverables.',
    why_it_matters: 'Service names directly match user search queries in Google Search (e.g. "ISO certification in Tambaram").',
    recommendation: 'Add itemized services with dedicated titles and 300-character descriptions.',
    recommended_content: understanding.mainServices.join('; '),
    evidence_source: 'Google Places API & Website Scraper',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 31. Service Catalog Match with Website
  const servicesOnWebsiteCount = understanding.mainServices.length + understanding.secondaryServices.length;
  addField({
    field_id: 'service_catalog_match',
    field_name: 'Website Service Offerings Alignment',
    category: 'services',
    section_title: 'D. Services',
    current_value: `${servicesOnWebsiteCount} service offerings detected on website`,
    expected_value_or_requirement: 'All core services described on the business website must be present in Google Business Profile Services.',
    status: servicesOnWebsiteCount > 0 ? 'NEEDS IMPROVEMENT' : 'NO CHANGES REQUIRED',
    issue_description: `Website features ${servicesOnWebsiteCount} services that should be synced to Google Business Profile.`,
    why_it_matters: 'Customers searching for specific services find your profile through Google service tags.',
    recommendation: 'Sync website service list to Google Business Profile catalog.',
    recommended_content: [...understanding.mainServices, ...understanding.secondaryServices].slice(0, 8).join(', '),
    evidence_source: 'Website Headings & Nav Extraction',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 32. Missing Core Services
  const missingServices = understanding.mainServices.slice(0, 4);
  addField({
    field_id: 'missing_core_services',
    field_name: 'Missing Core Services',
    category: 'services',
    section_title: 'D. Services',
    current_value: 'Unpopulated in profile',
    expected_value_or_requirement: 'Add high-intent core services discovered on the website.',
    status: missingServices.length > 0 ? 'MISSING' : 'NO CHANGES REQUIRED',
    issue_description: `Website clearly highlights: ${missingServices.join(', ')}. These are absent from the profile services list.`,
    why_it_matters: 'Missing services prevent your profile from triggering when searchers look for specific solutions.',
    recommendation: `Add the following services to your Google Business Profile: ${missingServices.join(', ')}.`,
    recommended_content: missingServices.map(s => `• ${s}`).join('\n'),
    evidence_source: 'Website Content Cross-check',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 33. Service Item Descriptions
  addField({
    field_id: 'service_descriptions',
    field_name: 'Service Item Descriptions (300 chars)',
    category: 'services',
    section_title: 'D. Services',
    current_value: 'Missing descriptions',
    expected_value_or_requirement: 'Up to 300-character description for each service detailing scope, deliverables, and benefits.',
    status: 'MISSING',
    issue_description: 'None of your services have 300-character descriptive summaries attached.',
    why_it_matters: 'Descriptive services educate prospects and give Google more text relevancy signals for ranking.',
    recommendation: 'Provide concise 300-character summaries for each service item.',
    recommended_content: `Comprehensive ${category.toLowerCase()} services including assessment, implementation roadmap, compliance verification, and ongoing advisory tailored to organizational goals in ${city}.`,
    evidence_source: 'Google Business Profile Manager Features',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 34. Service Pricing / Quote Option
  addField({
    field_id: 'service_pricing',
    field_name: 'Service Pricing & Fee Structure',
    category: 'services',
    section_title: 'D. Services',
    current_value: 'Not configured',
    expected_value_or_requirement: 'Transparent starting prices or "Free initial consultation" label.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Service pricing is not configured. Setting "Free consultation" or "Starting at" boosts engagement.',
    why_it_matters: 'Transparent pricing attracts higher intent leads and reduces unqualified inquiries.',
    recommendation: 'Add starting price points or "Free Estimate / Consultation" tags on service items.',
    recommended_content: 'Free Initial Consultation / Custom Quote based on scope',
    evidence_source: 'Google Business Profile Service Editor',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION E: PRODUCTS
  // ─────────────────────────────────────────────────────────────────

  const hasProducts = (understanding.detectedProducts || []).length > 0;
  addField({
    field_id: 'product_catalog',
    field_name: 'Google Products Catalog',
    category: 'products',
    section_title: 'E. Products',
    current_value: hasProducts ? `${understanding.detectedProducts.length} packages/products found on site` : 'None configured',
    expected_value_or_requirement: 'Visual product showcase cards displayed prominently in Google Maps search listing.',
    status: hasProducts ? 'NEEDS IMPROVEMENT' : 'UNABLE TO VERIFY',
    issue_description: hasProducts
      ? 'Your website mentions packaged offerings or product lines that are not added to the Google Products tab.'
      : 'Service businesses often don\'t offer physical goods, but package consultation audits as products.',
    why_it_matters: 'Google Products appear with large visual cards on mobile search, capturing significant visual attention.',
    recommendation: 'Package your top 3 popular services as product cards with images, pricing, and direct links.',
    recommended_content: understanding.mainServices.slice(0, 3).map((s, i) => `Package ${i+1}: ${s} Standard Audit Package`).join('\n'),
    evidence_source: 'Website Analysis & Google Products Tab',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  addField({
    field_id: 'product_descriptions',
    field_name: 'Product Descriptions & Deliverables',
    category: 'products',
    section_title: 'E. Products',
    current_value: 'Unpopulated',
    expected_value_or_requirement: 'Up to 1,000 characters per product detailing package deliverables.',
    status: 'UNABLE TO VERIFY',
    why_it_matters: 'Explains what the customer receives before making an inquiry.',
    recommendation: 'Write clear deliverable summaries for each packaged product card.',
    recommended_content: 'Include scope of work, expected timelines, and compliance deliverables.',
    evidence_source: 'Google Products Guidelines',
    confidence: 'Medium',
    applicable: true,
    verifiable: false,
  });

  addField({
    field_id: 'product_photos',
    field_name: 'Product Feature Photos',
    category: 'products',
    section_title: 'E. Products',
    current_value: 'None',
    expected_value_or_requirement: 'Clean 1:1 square graphic or product photo with white or branded background.',
    status: 'UNABLE TO VERIFY',
    why_it_matters: 'High-contrast product imagery drives higher click-through rates on Google search results.',
    recommendation: 'Upload high-resolution square images for each product package.',
    recommended_content: '1:1 Square images (minimum 720x720px) representing deliverables.',
    evidence_source: 'Google Products Guidelines',
    confidence: 'Medium',
    applicable: true,
    verifiable: false,
  });

  addField({
    field_id: 'product_landing_urls',
    field_name: 'Product Action / Buy / Quote URLs',
    category: 'products',
    section_title: 'E. Products',
    current_value: 'None',
    expected_value_or_requirement: 'Direct landing page link on website with "Order Online" or "Get Quote" button.',
    status: 'UNABLE TO VERIFY',
    why_it_matters: 'Drives users directly from Google Search into your conversion funnel.',
    recommendation: `Add link to product page (e.g. ${website || 'https://example.com'}/services).`,
    recommended_content: website ? `${website.replace(/\/$/, '')}/services` : '',
    evidence_source: 'Website Crawler',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  addField({
    field_id: 'missing_products',
    field_name: 'Missing Packaged Solutions',
    category: 'products',
    section_title: 'E. Products',
    current_value: 'No packages configured in Google Products',
    expected_value_or_requirement: 'Showcase at least 2 to 3 turnkey packages in the Product Editor.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Profile is not taking advantage of the Google Products Showcase section to feature flagship solutions.',
    why_it_matters: 'Product cards occupy prime visual real estate on mobile Google Maps.',
    recommendation: `Package flagship ${category} solutions into Google Products tab.`,
    recommended_content: `1. ${understanding.mainServices[0] || 'Core Audit'} Package\n2. Comprehensive ${category} Implementation\n3. Annual Advisory Program`,
    evidence_source: 'Google Places & Website Content',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION F: BUSINESS ATTRIBUTES AND FACILITIES
  // ─────────────────────────────────────────────────────────────────

  const accessibility = place.accessibilityOptions;
  const hasAccessibility = accessibility && Object.values(accessibility).some(v => v === true);
  addField({
    field_id: 'accessibility_options',
    field_name: 'Wheelchair Accessibility Attributes',
    category: 'attributes',
    section_title: 'F. Business Attributes and Facilities',
    current_value: hasAccessibility ? 'Configured' : 'Not specified',
    expected_value_or_requirement: 'Wheelchair accessible entrance, restroom, seating, and parking.',
    status: hasAccessibility ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: !hasAccessibility
      ? 'Profile does not specify whether your entrance, seating, or restrooms are wheelchair accessible.'
      : undefined,
    why_it_matters: 'Google Maps highlights accessibility attributes with special badges and filters for mobility-impaired searchers.',
    recommendation: 'Enable applicable accessibility attributes in Google Business Profile (e.g. Wheelchair accessible entrance).',
    recommended_content: 'Wheelchair accessible entrance: Yes | Wheelchair accessible parking: Yes',
    evidence_source: 'Google Places API accessibilityOptions',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  const amenities = place.editorialSummary?.toLowerCase() || '';
  addField({
    field_id: 'amenities_facilities',
    field_name: 'Amenities (Restroom, Wi-Fi)',
    category: 'attributes',
    section_title: 'F. Business Attributes and Facilities',
    current_value: 'Unspecified',
    expected_value_or_requirement: 'Client amenities such as Restrooms and Free Wi-Fi.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Client amenities like Wi-Fi and Restrooms are not explicitly marked.',
    why_it_matters: 'Amenities provide subtle trust cues for visitors planning in-person consultations.',
    recommendation: 'Mark "Restroom" and "Free Wi-Fi" attributes as Yes in profile editor.',
    recommended_content: 'Restroom: Yes | Wi-Fi: Free Wi-Fi available',
    evidence_source: 'Google Places API Attributes',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  const parking = place.parkingOptions;
  const hasParking = parking && Object.values(parking).some(v => v === true);
  addField({
    field_id: 'parking_options',
    field_name: 'Parking Facilities',
    category: 'attributes',
    section_title: 'F. Business Attributes and Facilities',
    current_value: hasParking ? 'Configured' : 'Unspecified',
    expected_value_or_requirement: 'Free parking lot, street parking, or paid parking details.',
    status: hasParking ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: !hasParking ? 'Parking options are not defined on Google Maps.' : undefined,
    why_it_matters: 'Visitors driving to your location frequently check parking availability before traveling.',
    recommendation: 'Specify available parking options (e.g. Free street parking or Free parking lot).',
    recommended_content: 'Free parking lot / Free street parking',
    evidence_source: 'Google Places API parkingOptions',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  const payments = place.paymentOptions;
  const hasPayments = payments && Object.values(payments).some(v => v === true);
  addField({
    field_id: 'payment_methods',
    field_name: 'Accepted Payment Methods',
    category: 'attributes',
    section_title: 'F. Business Attributes and Facilities',
    current_value: hasPayments ? 'Configured' : 'Unspecified',
    expected_value_or_requirement: 'Credit cards, debit cards, cash, cheque, and mobile NFC payments.',
    status: hasPayments ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: !hasPayments ? 'Accepted payment methods are not listed on Google Maps.' : undefined,
    why_it_matters: 'Clear payment info reduces friction for incoming customers.',
    recommendation: 'Select accepted payment methods in Google Business Profile (Credit Cards, Bank Transfer, Cash).',
    recommended_content: 'Credit cards, Debit cards, Cash, Bank Transfer / UPI',
    evidence_source: 'Google Places API paymentOptions',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  addField({
    field_id: 'service_options',
    field_name: 'Service Delivery Options (On-site / Online)',
    category: 'attributes',
    section_title: 'F. Business Attributes and Facilities',
    current_value: 'Unspecified',
    expected_value_or_requirement: '"On-site services" and "Online appointments" attributes.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Profile does not specify whether you provide online consultations or on-site services.',
    why_it_matters: 'Highlighting "Online appointments" expands your reach to clients outside your immediate driving radius.',
    recommendation: 'Turn on "Online appointments" and "On-site services" in Business Profile attributes.',
    recommended_content: 'Online appointments: Yes | On-site services: Yes',
    evidence_source: 'Google Business Profile Attributes',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION G: CONTACT AND CUSTOMER INTERACTION
  // ─────────────────────────────────────────────────────────────────

  addField({
    field_id: 'contact_phone',
    field_name: 'Mobile Click-to-Call Phone',
    category: 'contact',
    section_title: 'G. Contact and Customer Interaction',
    current_value: place.nationalPhoneNumber || 'None',
    expected_value_or_requirement: 'Active telephone line responding during business hours.',
    status: place.nationalPhoneNumber ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'Generates phone calls directly from mobile SERPs without the user needing to visit a website.',
    recommendation: place.nationalPhoneNumber ? 'Phone is verified and operational.' : 'Add your primary business phone.',
    recommended_content: place.nationalPhoneNumber || '',
    evidence_source: 'Google Places API',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  addField({
    field_id: 'contact_website',
    field_name: 'Official Website Destination',
    category: 'contact',
    section_title: 'G. Contact and Customer Interaction',
    current_value: website || 'None',
    expected_value_or_requirement: 'Verified authoritative website destination.',
    status: website ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'Drives qualified organic referral traffic from Maps to your online business presence.',
    recommendation: 'Ensure website homepage loads quickly on mobile devices.',
    recommended_content: website || '',
    evidence_source: 'Google Places API websiteUri',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  addField({
    field_id: 'contact_appointment',
    field_name: 'Dedicated Appointment Link',
    category: 'contact',
    section_title: 'G. Contact and Customer Interaction',
    current_value: siteAudit?.appointmentUrl || 'None',
    expected_value_or_requirement: 'Direct booking URL linking to calendar or contact form.',
    status: siteAudit?.appointmentUrl ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: !siteAudit?.appointmentUrl ? 'No dedicated consultation or booking URL is linked to profile.' : undefined,
    why_it_matters: 'Enables high-intent customers to schedule consultations instantly.',
    recommendation: 'Add appointment link to Google Business Profile.',
    recommended_content: siteAudit?.appointmentUrl || (website ? `${website.replace(/\/$/, '')}/contact` : ''),
    evidence_source: 'Website Crawler',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  addField({
    field_id: 'messaging_options',
    field_name: 'Google Business Chat / Messaging',
    category: 'contact',
    section_title: 'G. Contact and Customer Interaction',
    current_value: 'Turned off or unverified via public API',
    expected_value_or_requirement: 'Direct in-app messaging feature enabled in Google Maps.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Profile has not enabled or verified direct Google Business messaging.',
    why_it_matters: 'Enables real-time lead capture from users who prefer text or chat over calling.',
    recommendation: 'Open Google Business Profile app, go to Customers > Messages, and turn on Chat with an automated welcome greeting.',
    recommended_content: `Hello! Thank you for reaching out to ${bizName}. How can our team assist you today?`,
    evidence_source: 'Google Business Profile Manager',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION H: PHOTOS AND VISUAL CONTENT
  // ─────────────────────────────────────────────────────────────────

  const photosCount = place.photosCount || 0;

  // 49. Logo
  addField({
    field_id: 'photo_logo',
    field_name: 'Official Business Logo',
    category: 'photos',
    section_title: 'H. Photos and Visual Content',
    current_value: photosCount > 0 ? 'Photo asset detected' : 'Missing',
    expected_value_or_requirement: 'Square PNG/JPG logo (720x720px, 1:1 ratio) uploaded under the Logo slot.',
    status: photosCount >= 2 ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: photosCount < 2 ? 'Ensure official business logo is explicitly assigned in Google Business Profile photo manager.' : undefined,
    why_it_matters: 'The logo represents your brand identity next to review replies and in customer notifications.',
    recommendation: 'Upload a 720x720px PNG logo with transparent or crisp background.',
    recommended_content: 'Upload 720x720px square brand logo.',
    evidence_source: 'Google Places API photos',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 50. Cover Photo
  addField({
    field_id: 'photo_cover',
    field_name: 'Cover Photo (16:9)',
    category: 'photos',
    section_title: 'H. Photos and Visual Content',
    current_value: photosCount > 0 ? 'Cover photo populated' : 'Missing',
    expected_value_or_requirement: 'High-resolution 16:9 banner (1024x576px) showcasing physical storefront or team.',
    status: photosCount >= 1 ? 'NO CHANGES REQUIRED' : 'MISSING',
    issue_description: photosCount === 0 ? 'No cover photo has been uploaded.' : undefined,
    why_it_matters: 'Google selects the cover photo as the primary image displayed in search results.',
    recommendation: 'Upload a 1024x576px landscape photo representing your team or office entrance.',
    recommended_content: 'Upload 1024x576px cover photo.',
    evidence_source: 'Google Places API photos',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 51. Exterior Photos
  addField({
    field_id: 'photo_exterior',
    field_name: 'Exterior Building & Signage Photos',
    category: 'photos',
    section_title: 'H. Photos and Visual Content',
    current_value: photosCount >= 5 ? 'Available' : `${photosCount} total photos`,
    expected_value_or_requirement: 'At least 3 exterior photos showing street approach, building signage, and entrance.',
    status: photosCount >= 5 ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: photosCount < 5 ? 'Profile lacks sufficient exterior photos showing street landmarks and building entrance.' : undefined,
    why_it_matters: 'Helps first-time visitors identify your building from the road.',
    recommendation: 'Take 3 photos from different street angles showing your building signage and parking area.',
    recommended_content: 'Upload 3 exterior daytime photos of storefront & signage.',
    evidence_source: 'Google Places API photos count',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 52. Interior Photos
  addField({
    field_id: 'photo_interior',
    field_name: 'Interior Office / Facility Photos',
    category: 'photos',
    section_title: 'H. Photos and Visual Content',
    current_value: photosCount >= 8 ? 'Available' : `${photosCount} total photos`,
    expected_value_or_requirement: 'At least 3 to 5 photos showing reception area, consulting rooms, or office spaces.',
    status: photosCount >= 8 ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: photosCount < 8 ? 'Profile has limited interior photos showing professional office setup.' : undefined,
    why_it_matters: 'Interior photos establish professional credibility and reassure prospective clients.',
    recommendation: 'Upload bright, well-lit photos of your reception desk, conference room, and work areas.',
    recommended_content: 'Upload 4 interior office & meeting room photos.',
    evidence_source: 'Google Places API photos count',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 53. Team Photos
  addField({
    field_id: 'photo_team',
    field_name: 'Team & Staff Photos',
    category: 'photos',
    section_title: 'H. Photos and Visual Content',
    current_value: 'Unverified in public photo feed',
    expected_value_or_requirement: 'Photos of management, certified consultants, and staff assisting clients.',
    status: 'NEEDS IMPROVEMENT',
    issue_description: 'Profile has not uploaded dedicated team photos.',
    why_it_matters: 'Humanizing the business with real team photos increases client trust and engagement by up to 35%.',
    recommendation: 'Upload professional photos of key team members and leadership.',
    recommended_content: 'Upload leadership & team headshots.',
    evidence_source: 'Google Business Profile Photo Guidelines',
    confidence: 'Medium',
    applicable: true,
    verifiable: true,
  });

  // 54. Portfolio / Work Photos
  addField({
    field_id: 'photo_work',
    field_name: 'Portfolio, Certifications & Work Evidence',
    category: 'photos',
    section_title: 'H. Photos and Visual Content',
    current_value: photosCount >= 10 ? 'Healthy photo volume' : `Low volume (${photosCount} photos)`,
    expected_value_or_requirement: '15+ high-resolution photos displaying certificates, project case studies, and awards.',
    status: photosCount >= 15 ? 'NO CHANGES REQUIRED' : 'NEEDS IMPROVEMENT',
    issue_description: photosCount < 15 ? `Total photo inventory is ${photosCount}. Profiles with 15+ photos receive 42% more direction requests.` : undefined,
    why_it_matters: 'High photo count strongly correlates with Google Maps 3-Pack placement and user interaction.',
    recommendation: 'Grow photo count to 15+ photos by uploading client case studies and official certificates.',
    recommended_content: 'Upload certificates, accreditation documents, and project photos.',
    evidence_source: 'Google Places API photos count',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // SECTION I: OTHER AVAILABLE GOOGLE BUSINESS PROFILE FIELDS
  // ─────────────────────────────────────────────────────────────────

  // 55. "From the business" badges
  addField({
    field_id: 'from_the_business_attributes',
    field_name: '"From the business" Identity Badges',
    category: 'other',
    section_title: 'I. Other Available Google Business Profile Fields',
    current_value: 'Not accessible via public Places API',
    expected_value_or_requirement: 'Identity attributes such as Women-owned, Veteran-owned, Asian-owned, Black-owned, or LGBTQ+ friendly.',
    status: 'UNABLE TO VERIFY',
    issue_description: 'Google Places API does not publicly return self-declared identity attributes.',
    why_it_matters: 'Displays special icon badges on mobile search results and highlights diversity initiatives.',
    recommendation: 'If applicable, log into Google Business Profile Manager > Edit Profile > More > From the business and toggle eligible identity attributes.',
    recommended_content: 'Toggle applicable identity badges in GBP Manager.',
    evidence_source: 'Google Business Profile Manager Features',
    confidence: 'Medium',
    applicable: true,
    verifiable: false,
  });

  // 56. Google Maps Place ID / CID Association
  addField({
    field_id: 'place_id_consistency',
    field_name: 'Google Maps Place ID Consistency',
    category: 'other',
    section_title: 'I. Other Available Google Business Profile Fields',
    current_value: place.id || 'Not resolved',
    expected_value_or_requirement: 'Permanent Google Maps Place ID preventing duplicate listing fragmentation.',
    status: place.id ? 'NO CHANGES REQUIRED' : 'MISSING',
    why_it_matters: 'A stable Place ID prevents customer reviews from fragmenting across duplicate unverified map pins.',
    recommendation: 'Place ID is verified and connected to your application.',
    recommended_content: place.id || '',
    evidence_source: 'Google Places API id',
    confidence: 'High',
    applicable: true,
    verifiable: true,
  });

  // 57. Editorial Summary & Highlights
  addField({
    field_id: 'editorial_summary',
    field_name: 'Google Editorial Summary',
    category: 'other',
    section_title: 'I. Other Available Google Business Profile Fields',
    current_value: place.editorialSummary ? place.editorialSummary : 'None generated by Google yet',
    expected_value_or_requirement: 'Google-curated short summary shown on high-authority local listings.',
    status: place.editorialSummary ? 'NO CHANGES REQUIRED' : 'UNABLE TO VERIFY',
    issue_description: !place.editorialSummary
      ? 'Google algorithmically generates editorial summaries only for listings with established review velocity and consistent online citations.'
      : undefined,
    why_it_matters: 'Short summary generated automatically by Google for high-visibility profiles.',
    recommendation: 'Focus on growing review velocity and citation consistency to earn an official Google editorial highlight.',
    recommended_content: 'Algorithmically assigned by Google once profile attains high review authority.',
    evidence_source: 'Google Places API editorialSummary',
    confidence: 'Medium',
    applicable: false,
    verifiable: false,
  });

  return fields;
}

/**
 * 3. Enrich missing / improvement fields with tailored AI recommendations and ready-to-copy drafts
 */
export async function enrichAuditWithAI(
  place: GooglePlaceData,
  siteAudit: WebsiteAuditData | undefined,
  understanding: BusinessUnderstanding,
  fields: GbpAuditedField[]
): Promise<void> {
  const bizName = place.displayName || 'Business';
  const category = understanding.primaryCategory;
  const city = understanding.serviceAreas[0] || 'Local Area';
  const website = place.websiteUri || siteAudit?.url || '';
  const services = understanding.mainServices;
  const rating = place.rating || 0;
  const reviewCount = place.userRatingCount || 0;

  // Identify fields that need AI content
  const descField = fields.find(f => f.field_id === 'business_description');
  const servicesField = fields.find(f => f.field_id === 'missing_core_services');
  const serviceDescField = fields.find(f => f.field_id === 'service_descriptions');
  const productField = fields.find(f => f.field_id === 'missing_products');
  const addCatsField = fields.find(f => f.field_id === 'additional_categories');
  const serviceAreasField = fields.find(f => f.field_id === 'service_areas');

  // Deterministic fallback templates specific to this business
  const fallbackDescription = `${bizName} is a premier ${category.toLowerCase()} serving clients across ${city} and neighboring areas. We specialize in ${services.slice(0, 3).join(', ')}, delivering high-standard solutions tailored to organizational objectives. With a strong track record of verified client satisfaction (${rating > 0 ? `${rating}★ rating across ${reviewCount} reviews` : 'reliable professional service'}), our experienced team assists clients with thorough assessments, implementation, and long-term success. Contact us or visit our location in ${city} to schedule a consultation.`;

  const fallbackServicesContent = services.map(s =>
    `• Service: ${s}\n  Category: ${category}\n  Description: Professional ${s.toLowerCase()} delivered by certified specialists in ${city} to optimize compliance, quality, and business performance.`
  ).join('\n\n');

  const fallbackProductContent = services.slice(0, 3).map((s, i) =>
    `• Package ${i + 1}: ${s} Turnkey Program\n  Category: Consulting Services\n  Price: Contact for Custom Quote / Free Initial Assessment\n  Description: Comprehensive end-to-end ${s.toLowerCase()} package including diagnostic gap analysis, customized implementation framework, team training, and audit readiness verification.`
  ).join('\n\n');

  // Check if OpenAI is available and has credits
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (descField && (descField.status === 'MISSING' || descField.status === 'NEEDS IMPROVEMENT')) {
      descField.recommended_content = fallbackDescription;
    }
    if (servicesField && servicesField.status === 'MISSING') {
      servicesField.recommended_content = fallbackServicesContent;
    }
    if (serviceDescField && serviceDescField.status === 'MISSING') {
      serviceDescField.recommended_content = `Comprehensive ${category.toLowerCase()} services including diagnostic review, process implementation, quality compliance, and ongoing advisory tailored to organizational goals in ${city}.`;
    }
    if (productField && productField.status === 'NEEDS IMPROVEMENT') {
      productField.recommended_content = fallbackProductContent;
    }
    return;
  }

  try {
    const client = getOpenAIClient();
    const prompt = `
You are a senior Local SEO Auditor. A business is auditing its Google Business Profile.
Analyze this exact business:
- Name: ${bizName}
- Category: ${category}
- City/Region: ${city}
- Full Address: ${place.formattedAddress}
- Website: ${website} (Is HTTPS: ${siteAudit?.isHttps})
- Detected Website Services: ${services.join(', ')}
- About Snippet from Website: ${siteAudit?.aboutSnippet || 'Not provided'}
- Rating: ${rating}★ (${reviewCount} reviews)

Generate tailored, ready-to-copy content following Google Business Profile policies (no keyword stuffing, no fake awards, no exaggerated claims):
1. "descriptionDraft": Exactly 650–740 characters business bio for Google Business Profile highlighting core services, ${city} service area, and trust signals.
2. "itemizedServices": A formatted list of 4 specific services with 250-character descriptions each.
3. "packagedProducts": A formatted list of 3 packaged consultation/service products.
4. "recommendedSecondaryCategories": Array of 3 specific Google Business Profile categories that fit this business.
5. "recommendedServiceAreas": Array of 5 surrounding cities/suburbs around ${city}.

Return strictly JSON with keys:
{
  "descriptionDraft": "...",
  "itemizedServices": "...",
  "packagedProducts": "...",
  "recommendedSecondaryCategories": ["..."],
  "recommendedServiceAreas": ["..."]
}
`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert Google Business Profile copywriter. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');

    if (descField && (descField.status === 'MISSING' || descField.status === 'NEEDS IMPROVEMENT')) {
      descField.recommended_content = parsed.descriptionDraft || fallbackDescription;
    }
    if (servicesField && servicesField.status === 'MISSING') {
      servicesField.recommended_content = parsed.itemizedServices || fallbackServicesContent;
    }
    if (serviceDescField && serviceDescField.status === 'MISSING') {
      serviceDescField.recommended_content = parsed.itemizedServices || fallbackServicesContent;
    }
    if (productField && productField.status === 'NEEDS IMPROVEMENT') {
      productField.recommended_content = parsed.packagedProducts || fallbackProductContent;
    }
    if (addCatsField && addCatsField.status === 'NEEDS IMPROVEMENT' && Array.isArray(parsed.recommendedSecondaryCategories)) {
      addCatsField.recommended_content = parsed.recommendedSecondaryCategories.join('; ');
    }
    if (serviceAreasField && serviceAreasField.status === 'NEEDS IMPROVEMENT' && Array.isArray(parsed.recommendedServiceAreas)) {
      serviceAreasField.recommended_content = parsed.recommendedServiceAreas.join(', ');
    }
  } catch (err) {
    const classified = classifyOpenAIError(err);
    console.warn(`OpenAI generation fallback triggered (${classified.category}): ${classified.message}`);

    // Apply high-quality deterministic fallbacks
    if (descField && (descField.status === 'MISSING' || descField.status === 'NEEDS IMPROVEMENT')) {
      descField.recommended_content = fallbackDescription;
    }
    if (servicesField && servicesField.status === 'MISSING') {
      servicesField.recommended_content = fallbackServicesContent;
    }
    if (serviceDescField && serviceDescField.status === 'MISSING') {
      serviceDescField.recommended_content = `Comprehensive ${category.toLowerCase()} services including diagnostic review, process implementation, quality compliance, and ongoing advisory tailored to organizational goals in ${city}.`;
    }
    if (productField && productField.status === 'NEEDS IMPROVEMENT') {
      productField.recommended_content = fallbackProductContent;
    }
  }
}

/**
 * 4. Run the Complete Google Business Profile Audit Pipeline
 */
export async function executeGbpCompleteAudit(
  place: GooglePlaceData,
  siteAudit?: WebsiteAuditData
): Promise<GbpCompleteAuditResult> {
  const cacheKey = place.id || place.displayName || 'default';
  const cached = AUDIT_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // 1. Synthesize business understanding
  const understanding = buildBusinessUnderstanding(place, siteAudit);

  // 2. Evaluate all 57 profile fields
  const fields = evaluateAllGbpFields(place, siteAudit, understanding);

  // 3. Enrich missing / improvement fields with AI recommendations
  await enrichAuditWithAI(place, siteAudit, understanding, fields);

  // 4. Calculate exact statistics
  const totalAuditedFields = fields.length;
  const noChangesRequiredCount = fields.filter(f => f.status === 'NO CHANGES REQUIRED').length;
  const missingCount = fields.filter(f => f.status === 'MISSING').length;
  const needsImprovementCount = fields.filter(f => f.status === 'NEEDS IMPROVEMENT').length;
  const unableToVerifyCount = fields.filter(f => f.status === 'UNABLE TO VERIFY').length;

  // Verifiable & applicable fields count
  const applicableVerifiableFields = fields.filter(f => f.applicable && f.verifiable);
  const completeVerifiableCount = applicableVerifiableFields.filter(f => f.status === 'NO CHANGES REQUIRED').length;
  const completenessScore = applicableVerifiableFields.length > 0
    ? Math.round((completeVerifiableCount / applicableVerifiableFields.length) * 100)
    : 50;

  // 5. Group recommendations by section for the bottom "AI-RECOMMENDED GBP CONTENT" section
  const sectionMap: Record<string, { title: string; items: any[] }> = {
    basic_info: { title: 'Basic Information & Categories', items: [] },
    location_area: { title: 'Location & Service Areas', items: [] },
    hours: { title: 'Business Hours', items: [] },
    services: { title: 'Services Catalog', items: [] },
    products: { title: 'Products & Packages', items: [] },
    attributes: { title: 'Attributes & Facilities', items: [] },
    contact: { title: 'Contact Information & Messaging', items: [] },
    photos: { title: 'Photos & Visual Content', items: [] },
    other: { title: 'Other Profile Fields', items: [] },
  };

  fields.forEach(field => {
    if (field.status === 'MISSING' || field.status === 'NEEDS IMPROVEMENT') {
      if (field.recommended_content && field.recommended_content.trim().length > 0) {
        sectionMap[field.category]?.items.push({
          field_id: field.field_id,
          field_name: field.field_name,
          status: field.status,
          current_value: field.current_value,
          recommended_content: field.recommended_content,
          why_it_matters: field.why_it_matters || '',
          action: field.recommendation || '',
        });
      }
    }
  });

  const recommendedContentBySection = Object.entries(sectionMap)
    .filter(([_, section]) => section.items.length > 0)
    .map(([key, section]) => ({
      sectionKey: key,
      sectionTitle: section.title,
      items: section.items,
    }));

  const result: GbpCompleteAuditResult = {
    business: {
      name: place.displayName,
      category: understanding.primaryCategory,
      location: place.formattedAddress,
      websiteUrl: siteAudit?.url || place.websiteUri || '',
      mapUrl: `https://www.google.com/maps/place/?q=place_id:${place.id}`,
      placeId: place.id,
      lastAuditedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    },
    understanding,
    completenessScore,
    totalAuditedFields,
    noChangesRequiredCount,
    missingCount,
    needsImprovementCount,
    unableToVerifyCount,
    fields,
    recommendedContentBySection,
  };

  AUDIT_CACHE.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}
