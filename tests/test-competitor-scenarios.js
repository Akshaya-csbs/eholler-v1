// ============================================================================
// COMPREHENSIVE 6-INDUSTRY SERVICE-BASED COMPETITOR ANALYSIS TEST SUITE
// ============================================================================
// Verifies fully dynamic, data-driven competitor identification across 6 distinct
// industries without any hardcoded company names, Place IDs, or industry blacklists.

const path = require('path');
const fs = require('fs');
const jiti = require('jiti')(path.join(__dirname, 'test.js'));

// Load environment variables from .env.local if present
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const {
  extractDeterministicProfile,
  isValidCommercialService,
  GENERIC_CATEGORY_STOPWORDS,
  FORBIDDEN_SERVICE_TERMS,
} = jiti('../src/lib/business-understanding');

const {
  checkServiceMatch,
  sortCompetitorsByRating,
  generatePlacesSearchQueries,
} = jiti('../src/lib/competitor-service');

console.log('='.repeat(80));
console.log('TEST SUITE: 6-INDUSTRY DYNAMIC COMPETITOR DISCOVERY & VERIFICATION');
console.log('='.repeat(80));

let passes = 0;
let fails = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passes++;
  } else {
    console.error(`  [FAIL] ${testName}: ${details}`);
    fails++;
  }
}

/**
 * Universal candidate evaluator simulating Rule 4 & 5 of competitor-service
 * without any hardcoded industry blacklists.
 */
function evaluateCandidate(targetProfile, candidate) {
  const candidateCorpus = [
    candidate.name,
    candidate.category || '',
    candidate.websiteTitle || '',
    candidate.websiteDescription || '',
    ...(candidate.services || []),
  ].filter(Boolean).join(' ');

  let bestPrimaryMatch = { matched: false, score: 0, service: targetProfile.mainService };
  for (const pService of targetProfile.primaryServices) {
    const match = checkServiceMatch(candidateCorpus, pService);
    if (match.matched && match.score > bestPrimaryMatch.score) {
      bestPrimaryMatch = { matched: true, score: match.score, service: pService };
    }
  }

  let bestSecondaryMatch = { matched: false, score: 0, service: '' };
  for (const sService of targetProfile.secondaryServices) {
    const match = checkServiceMatch(candidateCorpus, sService);
    if (match.matched && match.score > bestSecondaryMatch.score) {
      bestSecondaryMatch = { matched: true, score: match.score, service: sService };
    }
  }

  if (bestPrimaryMatch.matched && bestPrimaryMatch.score >= 60) {
    return {
      classification: 'direct',
      score: Math.min(100, Math.max(70, bestPrimaryMatch.score)),
      matchedService: bestPrimaryMatch.service,
    };
  }

  if (bestSecondaryMatch.matched && bestSecondaryMatch.score >= 45) {
    return {
      classification: 'related',
      score: Math.min(69, Math.max(45, bestSecondaryMatch.score)),
      matchedService: bestSecondaryMatch.service,
    };
  }

  return {
    classification: 'excluded',
    score: 0,
    matchedService: null,
  };
}

async function runAllTests() {
  // =========================================================================
  // INDUSTRY 1: CLEANING BUSINESS
  // =========================================================================
  console.log('\n--- INDUSTRY 1: CLEANING BUSINESS (Residential & Commercial) ---');
  {
    const targetPlace = {
      id: 'place_cleaning_001',
      displayName: 'Sparkle Pro Commercial Cleaning',
      primaryType: 'cleaning_service',
      primaryTypeDisplayName: 'Commercial Cleaning Service',
      formattedAddress: '45 George St, Sydney NSW 2000, Australia',
      rating: 4.8,
      userRatingCount: 88,
    };

    const targetWebsite = {
      url: 'https://sparkleproclean.com.au',
      title: 'Sparkle Pro Cleaning | Commercial & Office Cleaning Sydney',
      metaDescription: 'Sydney leading commercial cleaning, office cleaning, janitorial services, and carpet cleaning.',
      headings: ['Office Cleaning Solutions', 'Janitorial Services', 'Commercial Carpet Cleaning', 'Deep Disinfection Services'],
      servicesMentioned: [
        'Commercial Cleaning',
        'Office Cleaning',
        'Janitorial Services',
        'Commercial Carpet Cleaning',
        'Deep Disinfection Services',
      ],
      isHttps: true,
      statusCode: 200,
    };

    const profile = extractDeterministicProfile(targetPlace, targetWebsite, 'Sydney');

    assert(
      profile.actualBusinessType.toLowerCase().includes('cleaning'),
      'Industry 1.1: Correctly derives cleaning business type from evidence',
      profile.actualBusinessType
    );

    assert(
      profile.primaryServices.some((s) => s.toLowerCase().includes('office cleaning')),
      'Industry 1.2: Extracts Office Cleaning as a primary commercial service'
    );

    const queries = generatePlacesSearchQueries(profile, 'Sydney');
    assert(
      queries.some((q) => q.toLowerCase().includes('cleaning in sydney')),
      'Industry 1.3: Generates targeted cleaning queries for Sydney'
    );

    // Candidates evaluation:
    // A: Direct cleaning competitor
    const directCandidate = {
      name: 'CleanCorp Janitorial & Commercial Cleaning',
      category: 'Cleaning Service',
      websiteTitle: 'CleanCorp - Expert Office Cleaning & Janitorial Services Sydney',
      services: ['Commercial Cleaning', 'Office Cleaning', 'Janitorial Services'],
    };
    const evalDirect = evaluateCandidate(profile, directCandidate);
    assert(
      evalDirect.classification === 'direct' && evalDirect.score >= 70,
      'Industry 1.4: Cleaning company qualifies as DIRECT competitor for cleaning target'
    );

    // B: Related cleaning competitor (carpet & floor care)
    const relatedCandidate = {
      name: 'Sydney Commercial Carpet Care',
      category: 'Carpet Cleaning Service',
      websiteTitle: 'Specialist Commercial Carpet Cleaning Services',
      services: ['Commercial Carpet Cleaning', 'Steam Cleaning'],
    };
    const evalRelated = evaluateCandidate(profile, relatedCandidate);
    assert(
      evalRelated.classification === 'related' || evalRelated.classification === 'direct',
      'Industry 1.5: Carpet cleaning specialist qualifies as related/direct competitor'
    );

    // C: Irrelevant IT candidate must be EXCLUDED dynamically
    const itCandidate = {
      name: 'CloudScale Enterprise Software',
      category: 'Software Company',
      websiteTitle: 'CloudScale - Enterprise Cloud Migration & Custom Software',
      services: ['Cloud Migration', 'Enterprise Software', 'DevOps Consulting'],
    };
    const evalIT = evaluateCandidate(profile, itCandidate);
    assert(
      evalIT.classification === 'excluded' && evalIT.score === 0,
      'Industry 1.6: IT candidate dynamically EXCLUDED for cleaning target (0% service overlap)'
    );

    // D: Irrelevant Healthcare candidate must be EXCLUDED dynamically
    const healthCandidate = {
      name: 'Sydney Dental Wellness Care',
      category: 'Dental Clinic',
      websiteTitle: 'Family & Cosmetic Dentistry',
      services: ['Teeth Whitening', 'Dental Implants', 'Orthodontics'],
    };
    const evalHealth = evaluateCandidate(profile, healthCandidate);
    assert(
      evalHealth.classification === 'excluded' && evalHealth.score === 0,
      'Industry 1.7: Healthcare candidate dynamically EXCLUDED for cleaning target'
    );
  }

  // =========================================================================
  // INDUSTRY 2: HEALTHCARE / CLINICAL PRACTICE
  // =========================================================================
  console.log('\n--- INDUSTRY 2: HEALTHCARE / CLINICAL PRACTICE (Cardiology Center) ---');
  {
    const targetPlace = {
      id: 'place_health_002',
      displayName: 'Apex Cardiology & Heart Clinic',
      primaryType: 'medical_clinic',
      primaryTypeDisplayName: 'Cardiology Clinic',
      formattedAddress: '200 Michigan Ave, Chicago, IL 60601, USA',
      rating: 4.9,
      userRatingCount: 142,
    };

    const targetWebsite = {
      url: 'https://apexcardiologychi.com',
      title: 'Apex Cardiology Clinic | Expert Heart Care & Diagnostic Cardiology Chicago',
      metaDescription: 'Leading Chicago cardiologists providing cardiology consultations, echocardiograms, and cardiac testing.',
      headings: ['Cardiology Consultations', 'Diagnostic Echocardiograms', 'Heart Rhythm Monitoring', 'Preventive Cardiology'],
      servicesMentioned: [
        'Cardiology Consultations',
        'Diagnostic Echocardiograms',
        'Heart Rhythm Monitoring',
        'Preventive Cardiology',
      ],
      isHttps: true,
      statusCode: 200,
    };

    const profile = extractDeterministicProfile(targetPlace, targetWebsite, 'Chicago');

    assert(
      profile.actualBusinessType.toLowerCase().includes('cardiology'),
      'Industry 2.1: Identifies Cardiology Clinic as actual business type',
      profile.actualBusinessType
    );

    const queries = generatePlacesSearchQueries(profile, 'Chicago');
    assert(
      queries.some((q) => q.toLowerCase().includes('cardiology')),
      'Industry 2.2: Generates cardiology queries dynamically for Chicago'
    );

    // Candidates:
    // A: Direct cardiology clinic competitor
    const directCandidate = {
      name: 'Chicago Heart & Vascular Specialists',
      category: 'Cardiology Clinic',
      websiteTitle: 'Comprehensive Cardiology Consultations & Heart Care Chicago',
      services: ['Cardiology Consultations', 'Cardiac Stress Tests', 'Diagnostic Echocardiograms'],
    };
    const evalDirect = evaluateCandidate(profile, directCandidate);
    assert(
      evalDirect.classification === 'direct' && evalDirect.score >= 70,
      'Industry 2.3: Heart & Vascular specialist qualifies as DIRECT competitor for cardiology target'
    );

    // B: Irrelevant Cleaning candidate must be EXCLUDED dynamically
    const cleaningCandidate = {
      name: 'Windy City Commercial Cleaning',
      category: 'Cleaning Service',
      services: ['Office Cleaning', 'Commercial Cleaning', 'Janitorial Services'],
    };
    const evalCleaning = evaluateCandidate(profile, cleaningCandidate);
    assert(
      evalCleaning.classification === 'excluded' && evalCleaning.score === 0,
      'Industry 2.4: Cleaning company dynamically EXCLUDED for cardiology target (0% service overlap)'
    );

    // C: Irrelevant Financial candidate must be EXCLUDED dynamically
    const financeCandidate = {
      name: 'Chicago Capital Wealth Advisors',
      category: 'Financial Planner',
      services: ['Wealth Management', 'Retirement Planning', 'Tax Strategy'],
    };
    const evalFinance = evaluateCandidate(profile, financeCandidate);
    assert(
      evalFinance.classification === 'excluded' && evalFinance.score === 0,
      'Industry 2.5: Financial firm dynamically EXCLUDED for cardiology target'
    );
  }

  // =========================================================================
  // INDUSTRY 3: FINANCIAL SERVICES FIRM
  // =========================================================================
  console.log('\n--- INDUSTRY 3: FINANCIAL SERVICES (Wealth Management & Tax Advisory) ---');
  {
    const targetPlace = {
      id: 'place_finance_003',
      displayName: 'Summit Wealth Management & Tax Advisory',
      primaryType: 'financial_planner',
      primaryTypeDisplayName: 'Financial Planner',
      formattedAddress: '500 5th Ave, New York, NY 10110, USA',
      rating: 4.9,
      userRatingCount: 65,
    };

    const targetWebsite = {
      url: 'https://summitwealthadvisors.com',
      title: 'Summit Wealth Management | Private Wealth Management & Tax Advisory NYC',
      metaDescription: 'Comprehensive wealth management, retirement planning, portfolio management, and corporate tax advisory.',
      headings: ['Private Wealth Management', 'Portfolio Management Solutions', 'Retirement Planning Strategies', 'Tax Advisory'],
      servicesMentioned: [
        'Private Wealth Management',
        'Portfolio Management',
        'Retirement Planning',
        'Tax Advisory Services',
      ],
      isHttps: true,
      statusCode: 200,
    };

    const profile = extractDeterministicProfile(targetPlace, targetWebsite, 'New York');

    assert(
      profile.primaryServices.some((s) => s.toLowerCase().includes('wealth management')),
      'Industry 3.1: Identifies Wealth Management as primary service'
    );

    // Candidates:
    // A: Direct financial wealth competitor
    const directCandidate = {
      name: 'Beacon Wealth Partners',
      category: 'Financial Consultant',
      websiteTitle: 'Boutique Private Wealth Management & Portfolio Management New York',
      services: ['Private Wealth Management', 'Portfolio Management', 'Investment Consulting'],
    };
    const evalDirect = evaluateCandidate(profile, directCandidate);
    assert(
      evalDirect.classification === 'direct' && evalDirect.score >= 70,
      'Industry 3.2: Wealth advisory firm qualifies as DIRECT competitor for wealth management target'
    );

    // B: Related competitor (Tax specialist)
    const relatedCandidate = {
      name: 'Madison Avenue Tax Advisory',
      category: 'Tax Consultant',
      websiteTitle: 'Corporate & High-Net-Worth Tax Advisory Services NYC',
      services: ['Tax Advisory Services', 'Estate Planning', 'CPA Accounting'],
    };
    const evalRelated = evaluateCandidate(profile, relatedCandidate);
    assert(
      evalRelated.classification === 'related' || evalRelated.classification === 'direct',
      'Industry 3.3: Tax advisory specialist qualifies as RELATED/DIRECT competitor'
    );

    // C: Irrelevant Restaurant candidate must be EXCLUDED dynamically
    const restaurantCandidate = {
      name: 'Manhattan Pasta & Grill',
      category: 'Italian Restaurant',
      services: ['Italian Dining', 'Handmade Pasta', 'Wood Fired Pizza'],
    };
    const evalRestaurant = evaluateCandidate(profile, restaurantCandidate);
    assert(
      evalRestaurant.classification === 'excluded' && evalRestaurant.score === 0,
      'Industry 3.4: Restaurant candidate dynamically EXCLUDED for wealth management target'
    );
  }

  // =========================================================================
  // INDUSTRY 4: RESTAURANT / HOSPITALITY
  // =========================================================================
  console.log('\n--- INDUSTRY 4: RESTAURANT / HOSPITALITY (Italian Dining & Wine Bar) ---');
  {
    const targetPlace = {
      id: 'place_restaurant_004',
      displayName: 'Trattoria Bella Pasta & Wine Bar',
      primaryType: 'italian_restaurant',
      primaryTypeDisplayName: 'Italian Restaurant',
      formattedAddress: '120 Hanover St, Boston, MA 02108, USA',
      rating: 4.7,
      userRatingCount: 380,
    };

    const targetWebsite = {
      url: 'https://trattoriabellaboston.com',
      title: 'Trattoria Bella | Authentic Handmade Pasta & Italian Dining Boston',
      metaDescription: 'Traditional handmade pasta, authentic wood-fired pizza, and artisan Italian wine dining in North End Boston.',
      headings: ['Artisan Handmade Pasta', 'Wood-Fired Pizza Specialita', 'Fine Italian Wine List', 'Private Dining Events'],
      servicesMentioned: [
        'Artisan Handmade Pasta',
        'Wood-Fired Pizza',
        'Italian Dining',
        'Private Dining Events',
      ],
      isHttps: true,
      statusCode: 200,
    };

    const profile = extractDeterministicProfile(targetPlace, targetWebsite, 'Boston');

    assert(
      profile.actualBusinessType.toLowerCase().includes('italian restaurant'),
      'Industry 4.1: Derives Italian Restaurant as business type'
    );

    // Candidates:
    // A: Direct restaurant competitor
    const directCandidate = {
      name: 'Osteria del Sole North End',
      category: 'Italian Restaurant',
      websiteTitle: 'Osteria del Sole - Fresh Handmade Pasta & Italian Dining Boston',
      services: ['Artisan Handmade Pasta', 'Italian Dining', 'Wood-Fired Pizza'],
    };
    const evalDirect = evaluateCandidate(profile, directCandidate);
    assert(
      evalDirect.classification === 'direct' && evalDirect.score >= 70,
      'Industry 4.2: Italian restaurant qualifies as DIRECT competitor for restaurant target'
    );

    // B: Irrelevant IT candidate must be EXCLUDED dynamically
    const itCandidate = {
      name: 'Boston Cloud Systems',
      category: 'Software Company',
      services: ['Cloud Infrastructure', 'Kubernetes Architecture', 'DevOps Solutions'],
    };
    const evalIT = evaluateCandidate(profile, itCandidate);
    assert(
      evalIT.classification === 'excluded' && evalIT.score === 0,
      'Industry 4.3: IT candidate dynamically EXCLUDED for restaurant target (0% service overlap)'
    );

    // C: Irrelevant Cleaning candidate must be EXCLUDED dynamically
    const cleaningCandidate = {
      name: 'Boston Commercial Cleaners',
      category: 'Cleaning Service',
      services: ['Commercial Cleaning', 'Office Cleaning', 'Janitorial Services'],
    };
    const evalCleaning = evaluateCandidate(profile, cleaningCandidate);
    assert(
      evalCleaning.classification === 'excluded' && evalCleaning.score === 0,
      'Industry 4.4: Cleaning company dynamically EXCLUDED for restaurant target'
    );
  }

  // =========================================================================
  // INDUSTRY 5: SOFTWARE / IT WITH GENERIC MAPS CATEGORY ("CORPORATE OFFICE")
  // =========================================================================
  console.log('\n--- INDUSTRY 5: SOFTWARE / IT WITH GENERIC MAPS CATEGORY ("Corporate Office") ---');
  {
    // Real test fixture: Hexaware Technologies
    const hexPlace = {
      id: 'place_hex_005',
      displayName: 'Hexaware Technologies',
      primaryType: 'corporate_office',
      primaryTypeDisplayName: 'Corporate Office',
      formattedAddress: 'Hexaware Campus, SIPCOT IT Park, Siruseri, Chennai, Tamil Nadu 603103, India',
      rating: 3.6,
      userRatingCount: 339,
    };

    const hexWebsite = {
      url: 'https://hexaware.com/',
      title: 'Hexaware: IT Services for AI & Digital Transformation',
      metaDescription: 'Hexaware IT Services deliver AI-led modernization across apps, data, cloud, and operations.',
      headings: ['Zero Friction. Infinite Momentum.', 'Digital & Software', 'Data & Analytics', 'Cloud Solutions'],
      servicesMentioned: [
        'Digital & Software Services',
        'Data & Analytics',
        'Digital IT Operations',
        'Cloud Solutions',
        'Enterprise Platforms Services',
        'Artificial Intelligence',
      ],
      isHttps: true,
      statusCode: 200,
    };

    const profile = extractDeterministicProfile(hexPlace, hexWebsite, 'Chennai');

    // 1. Google Maps container "Corporate Office" must NOT become the commercial service
    assert(
      profile.mapsCategory === 'Corporate Office',
      'Industry 5.1: Captures Google Maps listing category as "Corporate Office"'
    );

    assert(
      profile.conflictNotes && profile.conflictNotes.length > 0,
      'Industry 5.2: Detects generic Maps category and notes conflict with verified services'
    );

    assert(
      !profile.primaryServices.includes('Corporate Office') && !profile.primaryServices.includes('Services'),
      'Industry 5.3: Container terms "Corporate Office" and "Services" strictly excluded from primary services'
    );

    assert(
      profile.primaryServices.some((s) => s.toLowerCase().includes('digital') || s.toLowerCase().includes('cloud')),
      'Industry 5.4: Discovers actual IT services (Digital/Cloud) from website evidence'
    );

    const queries = generatePlacesSearchQueries(profile, 'Chennai');
    assert(
      !queries.some((q) => q.toLowerCase() === 'corporate office in chennai' || q.toLowerCase() === 'services in chennai'),
      'Industry 5.5: NEVER queries generic "Corporate Office in Chennai" or "Services in Chennai"'
    );

    // 2. Verified IT competitor candidate
    const itCandidate = {
      name: 'Dextra Technologies',
      category: 'Software Company',
      websiteTitle: 'Dextra Technologies - Enterprise Digital & Software Services Chennai',
      services: ['Digital & Software Services', 'Cloud Solutions', 'Enterprise Software'],
    };
    const evalIT = evaluateCandidate(profile, itCandidate);
    assert(
      evalIT.classification === 'direct' && evalIT.score >= 70,
      'Industry 5.6: IT firm qualifies as DIRECT competitor for IT target'
    );

    // 3. Candidates from the critical bug report: MUST BE DYNAMICALLY EXCLUDED WITHOUT ANY BLACKLIST!
    // A: Deep Cleaning Services
    const cleaningCandidate = {
      name: 'Deep Cleaning Services - Professional Home Cleaning Chennai',
      category: 'Cleaning Service',
      services: ['Deep Cleaning', 'Home Cleaning', 'Floor Scrubbing', 'Sanitization'],
    };
    const evalCleaning = evaluateCandidate(profile, cleaningCandidate);
    assert(
      evalCleaning.classification === 'excluded' && evalCleaning.score === 0,
      'Industry 5.7: Deep Cleaning Services dynamically EXCLUDED (0% service overlap, no blacklist!)'
    );

    // B: Universal Employment Services / Patient Care
    const patientCareCandidate = {
      name: 'Universal employment services | Patient Care service in Chennai',
      category: 'Employment Agency',
      services: ['Patient Care', 'Home Nursing', 'Domestic Staffing'],
    };
    const evalPatientCare = evaluateCandidate(profile, patientCareCandidate);
    assert(
      evalPatientCare.classification === 'excluded' && evalPatientCare.score === 0,
      'Industry 5.8: Patient Care / Staffing dynamically EXCLUDED (0% service overlap)'
    );

    // C: Shriram Capital Private Ltd
    const shriramCandidate = {
      name: 'Shriram Capital Private Ltd Corporate Office',
      category: 'Financial Institution',
      services: ['Commercial Loans', 'Asset Management', 'Financial Leasing'],
    };
    const evalShriram = evaluateCandidate(profile, shriramCandidate);
    assert(
      evalShriram.classification === 'excluded' && evalShriram.score === 0,
      'Industry 5.9: Shriram Capital dynamically EXCLUDED (0% service overlap)'
    );
  }

  // =========================================================================
  // INDUSTRY 6: PROFESSIONAL CONSULTING FIRM (ISO & Quality Management)
  // =========================================================================
  console.log('\n--- INDUSTRY 6: PROFESSIONAL CONSULTING (ISO & Quality Management) ---');
  {
    const targetPlace = {
      id: 'place_iso_006',
      displayName: 'Pentagon Quality Management Consultants',
      primaryType: 'business_management_consultant',
      primaryTypeDisplayName: 'Business Management Consultant',
      formattedAddress: 'Tower B, Tech Park, Bengaluru, Karnataka 560103, India',
      rating: 4.8,
      userRatingCount: 34,
    };

    const targetWebsite = {
      url: 'https://pentagonquality.com',
      title: 'Pentagon Quality Consultants | ISO 9001, 14001, 27001 Certification & Auditing',
      metaDescription: 'Leading ISO certification consultants in Bangalore providing ISO 9001 quality management and ISO 27001 ISMS.',
      headings: ['ISO 9001 Quality Management Systems', 'ISO 27001 Information Security Consulting', 'Internal Quality Auditing'],
      servicesMentioned: [
        'ISO 9001 Quality Management',
        'ISO 27001 Information Security',
        'Internal Quality Auditing',
        'ISO 14001 Environmental Consulting',
      ],
      isHttps: true,
      statusCode: 200,
    };

    const profile = extractDeterministicProfile(targetPlace, targetWebsite, 'Bengaluru');

    assert(
      profile.primaryServices.some((s) => s.toLowerCase().includes('iso 9001')),
      'Industry 6.1: Derives ISO 9001 Quality Management as primary commercial service'
    );

    // Candidates:
    // A: Direct ISO certification competitor
    const directCandidate = {
      name: 'TUV Rheinland Quality Management Consultants',
      category: 'Consultant',
      websiteTitle: 'TUV Rheinland - ISO 9001 Quality Management Certification & Audits',
      services: ['ISO 9001 Quality Management', 'Quality Auditing', 'ISO 14001 Certification'],
    };
    const evalDirect = evaluateCandidate(profile, directCandidate);
    assert(
      evalDirect.classification === 'direct' && evalDirect.score >= 70,
      'Industry 6.2: ISO auditing firm qualifies as DIRECT competitor for ISO consultant target'
    );

    // B: Related Information Security Consultant
    const relatedCandidate = {
      name: 'CyberSec ISO 27001 Advisory',
      category: 'Security Consultant',
      websiteTitle: 'ISO 27001 Information Security Implementation & SOC2 Compliance',
      services: ['ISO 27001 Information Security', 'SOC2 Compliance Auditing'],
    };
    const evalRelated = evaluateCandidate(profile, relatedCandidate);
    assert(
      evalRelated.classification === 'related' || evalRelated.classification === 'direct',
      'Industry 6.3: Information security firm qualifies as RELATED/DIRECT competitor'
    );

    // C: Irrelevant Restaurant candidate must be EXCLUDED dynamically
    const restaurantCandidate = {
      name: 'Bistro Gourmet Dining',
      category: 'Restaurant',
      services: ['Fine Dining', 'French Bistro Dishes', 'Catering'],
    };
    const evalRestaurant = evaluateCandidate(profile, restaurantCandidate);
    assert(
      evalRestaurant.classification === 'excluded' && evalRestaurant.score === 0,
      'Industry 6.4: Restaurant candidate dynamically EXCLUDED for ISO consultant target'
    );

    // D: Irrelevant Cleaning candidate must be EXCLUDED dynamically
    const cleaningCandidate = {
      name: 'Janitorial Express Bengaluru',
      category: 'Cleaning Service',
      services: ['Deep Cleaning', 'Janitorial Services', 'Floor Scrubbing'],
    };
    const evalCleaning = evaluateCandidate(profile, cleaningCandidate);
    assert(
      evalCleaning.classification === 'excluded' && evalCleaning.score === 0,
      'Industry 6.5: Cleaning company dynamically EXCLUDED for ISO consultant target'
    );
  }

  // =========================================================================
  // UNIVERSAL REQUIREMENT: RATING-BASED SORTING (Rule 6)
  // =========================================================================
  console.log('\n--- UNIVERSAL REQUIREMENT: RATING-BASED RANKING (Rule 6) ---');
  {
    const candidates = [
      { id: '1', name: 'Unrated Business', rating: undefined, reviews: 0, relevanceScore: 90 },
      { id: '2', name: 'Mid Rating High Reviews', rating: 4.5, reviews: 120, relevanceScore: 80 },
      { id: '3', name: 'High Rating Low Reviews', rating: 4.9, reviews: 15, relevanceScore: 85 },
      { id: '4', name: 'High Rating High Reviews', rating: 4.9, reviews: 88, relevanceScore: 82 },
      { id: '5', name: 'Zero Rating Business', rating: 0, reviews: 0, relevanceScore: 75 },
      { id: '6', name: 'Mid Rating Low Reviews', rating: 4.5, reviews: 20, relevanceScore: 95 },
    ];

    const sorted = sortCompetitorsByRating(candidates);

    assert(
      sorted[0].rating === 4.9 && sorted[1].rating === 4.9,
      'Rating Sort 1: Highest rated competitors (4.9) come first'
    );

    assert(
      sorted[0].id === '4' && sorted[1].id === '3',
      'Rating Sort 2: Review count breaks tie (88 reviews before 15 reviews at rating 4.9)'
    );

    assert(
      sorted[2].id === '2' && sorted[3].id === '6',
      'Rating Sort 3: 4.5 rating sorted by reviews (120 reviews before 20 reviews)'
    );

    assert(
      (sorted[4].rating === undefined || sorted[4].rating === 0) &&
        (sorted[5].rating === undefined || sorted[5].rating === 0),
      'Rating Sort 4: Unrated or zero-rated businesses placed at the end'
    );
  }

  // =========================================================================
  // UNIVERSAL REQUIREMENT: FAIL SAFELY (Rule 7)
  // =========================================================================
  console.log('\n--- UNIVERSAL REQUIREMENT: SAFE FAILURE ON UNVERIFIABLE PROFILE ---');
  {
    const failedCrawlData = {
      url: 'https://failedsite12345.com',
      statusCode: 0, // Crawl failed completely
    };

    const failedProfile = extractDeterministicProfile(
      {
        id: 'place_unreachable_001',
        displayName: 'Unreachable Listing',
        primaryType: 'corporate_office',
        formattedAddress: 'Unknown Address',
      },
      failedCrawlData,
      'Unknown City'
    );

    assert(
      failedProfile.isServiceProfileValidated === false,
      'Safe Failure 1: Service profile validation fails safely when website crawl is unreachable'
    );

    assert(
      failedProfile.validationFailureReason && failedProfile.validationFailureReason.length > 0,
      'Safe Failure 2: Provides honest failure reason without inventing fake services',
      failedProfile.validationFailureReason
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log(`TEST RUN COMPLETE: ${passes} passed, ${fails} failed.`);
  console.log('='.repeat(80));

  if (fails > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
