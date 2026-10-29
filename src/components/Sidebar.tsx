import React from 'react';
import {
  LayoutDashboard,
  FileCheck2,
  TrendingUp,
  Users2,
  ListTree,
  MessageSquare,
  Sparkles,
  BarChart3,
  CreditCard,
  Settings,
  User,
  LogOut,
  Lock,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuditModal: () => void;
  onOpenGscModal: () => void;
  gscConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuditModal,
  onOpenGscModal,
  gscConnected = false,
}) => {
  const mainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, locked: false },
    { id: 'profile-opt', label: 'Profile Optimization', icon: FileCheck2, locked: false },
    { id: 'rank-tracker', label: 'Rank Tracker', icon: TrendingUp, locked: true },
    { id: 'competitor-analysis', label: 'Competitor Analysis', icon: Users2, locked: false },
    { id: 'directory-listings', label: 'Directory listings', icon: ListTree, locked: true },
    { id: 'review-mgmt', label: 'Review Management', icon: MessageSquare, locked: true },
    { id: 'enhance-images', label: 'Enhance Images', icon: Sparkles, locked: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, locked: true },
    { id: 'pricing', label: 'Pricing', icon: CreditCard, locked: false },
  ];

  return (
    <aside className="w-64 bg-[#121A21] text-gray-300 flex flex-col justify-between shrink-0 min-h-screen border-r border-[#1E2B37]">
      <div>
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-[#1E2B37]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="font-bold text-white tracking-wide text-lg leading-none">Blazly</div>
            <div className="text-[10px] tracking-widest uppercase text-orange-400 font-semibold mt-1">Local SEO</div>
          </div>
        </div>

        {/* Main Menu */}
        <nav className="p-4 space-y-1.5">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.locked) setActiveTab(item.id);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#C84A22] text-white shadow-md shadow-orange-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A2632]'
                } ${item.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.locked && <Lock className="w-3.5 h-3.5 text-gray-500" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Nav */}
      <div className="p-4 border-t border-[#1E2B37] space-y-1">
        <button
          onClick={onOpenAuditModal}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/40 mb-2 transition"
        >
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>+ Analyze New Business</span>
        </button>

        <button
          onClick={onOpenGscModal}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-950/40 text-blue-400 border border-blue-800/40 hover:bg-blue-900/40 mb-3 transition"
        >
          <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{gscConnected ? 'Search Console Connected' : 'Connect Google Search Console'}</span>
        </button>

        <button className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#1A2632] transition">
          <Settings className="w-4 h-4" />
          <span>Business Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#1A2632] transition">
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-[#1A2632] transition">
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};
