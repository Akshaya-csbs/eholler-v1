# eholler - Local SEO AI Agent SaaS (Blazly)

A Next.js & TypeScript Local SEO AI Agent platform designed to audit, monitor, and optimize Google Business Profiles and local search performance.

## Features

- **Google Business Profile Audit**: Paste any Google Maps URL, short link (`maps.app.goo.gl`), or Place ID to resolve live profile data via **Google Places API (New)**.
- **Website Crawler & NAP Parity Verification**: Crawls the business website, checks HTTP vs. HTTPS (SSL security), verifies Name, Address, and Phone (NAP) consistency, and inspects `LocalBusiness` Schema JSON-LD.
- **Dynamic SEO Scores**: Real-time Authority Score, Maps Rank, GBP Health (0-100), Optimization Progress, and Citation consistency.
- **Competitor Discovery**: Discovers local competitors in the same category and city, comparing review counts and star ratings.
- **AI Recommendations & Profile Bio Generation**: Generates actionable SEO priorities and an optimized 750-character Google Business Profile description.
- **Audit Breakdown Diagnostic**: Detailed modal displaying Missing Fields, Inconsistencies, and a step-by-step Action Checklist.
- **Google Search Console Integration Interface**: OAuth 2.0 connection workflow for streaming organic traffic, clicks, impressions, and ranking keywords.

## Tech Stack

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **APIs**:
  - Google Places API (New)
  - Google Search Console API (OAuth 2.0 ready)
  - OpenAI API (`gpt-4o-mini` / structured output) with dynamic rule-based fallback
- **Data Scraping & Analysis**: Cheerio + Axios

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Akshaya-csbs/eholler-v1.git
cd eholler-v1
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your credentials:
```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
OPENAI_API_KEY=your_openai_api_key_here # Optional
```

### 4. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
