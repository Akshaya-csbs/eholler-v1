import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Eholler Local SEO | AI Agent Dashboard',
  description: 'AI-Powered Local SEO Audit, Google Business Profile & Google Search Console Analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased min-h-screen bg-[#F8FAFC] text-slate-800">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
