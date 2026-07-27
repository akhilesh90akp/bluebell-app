/**
 * Layout - Application shell with navigation
 *
 * Provides the main layout structure including a desktop sidebar,
 * mobile bottom navigation bar, and a floating action button (FAB).
 * All page content is rendered via React Router's Outlet.
 */
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FilePlus, FileText, CheckCircle2, Settings, Plus, BarChart3 } from 'lucide-react';

/** Navigation items displayed in the desktop sidebar */
const sidebarNav = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/new', icon: FilePlus, label: 'New Event' },
  { to: '/drafts', icon: FileText, label: 'Drafts' },
  { to: '/confirmed', icon: CheckCircle2, label: 'Confirmed' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

/** Condensed navigation items for the mobile bottom bar */
const mobileNav = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/drafts', icon: FileText, label: 'Drafts' },
  { to: '/confirmed', icon: CheckCircle2, label: 'Confirmed' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

/** Main layout wrapper with sidebar, content area, and mobile nav */
export default function Layout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-bb-bg overflow-x-hidden">
      {/* === SIDEBAR (Desktop only: 1024px+) === */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[240px] bg-bb-sidebar border-r border-bb-sidebar-border z-50">
        {/* Logo - Golden Bluebell PNG */}
        <div className="p-3 border-b border-bb-sidebar-border">
          <img
            src="/logo-gold.png"
            alt="Bluebell Event Planners LLP"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebarNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-bb-sidebar-active text-white'
                  : 'text-bb-sidebar-muted hover:text-white hover:bg-bb-sidebar-active'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Version footer */}
        <div className="px-4 py-3 border-t border-bb-sidebar-border">
          <p className="text-[10px] text-bb-sidebar-muted text-center">Bluebell Event Planners v1.0</p>
        </div>
      </aside>

      {/* === MAIN CONTENT === */}
      <main className="lg:ml-[240px] min-h-[100dvh] pb-20 lg:pb-6">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 w-full">
          <Outlet />
        </div>
      </main>

      {/* === MOBILE BOTTOM NAV (below 1024px) === */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-bb-sidebar/95 backdrop-blur-md border-t border-bb-sidebar-border z-50">
        <div className="relative flex items-center justify-around h-full max-w-md mx-auto px-4">
          {/* Left 2 nav items */}
          {mobileNav.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-xl transition-colors
                ${isActive ? 'text-bb-accent' : 'text-bb-sidebar-muted'}`
              }
            >
              <item.icon size={20} />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          ))}

          {/* Center FAB button - navigates to new event creation */}
          <button
            onClick={() => navigate('/new')}
            className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full bg-bb-accent hover:bg-bb-accent-hover shadow-lg shadow-bb-accent/40 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
          >
            <Plus size={26} className="text-white" strokeWidth={2.5} />
          </button>

          {/* Right 2 nav items */}
          {mobileNav.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-xl transition-colors
                ${isActive ? 'text-bb-accent' : 'text-bb-sidebar-muted'}`
              }
            >
              <item.icon size={20} />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
