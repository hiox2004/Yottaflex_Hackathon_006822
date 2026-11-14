// Page frame: sidebar, topbar and the routed page (wrapped in an error boundary).
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '../Toast';
import { ErrorBoundary } from './ErrorBoundary';
import { PlatformStrip } from './PlatformStrip';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}
      {/* Only this column scrolls; the strip and Topbar stick to its top. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Strip and topbar stick together at the top of the column. */}
        <div className="sticky top-0 z-20">
          <PlatformStrip />
          <Topbar onMenu={() => setNavOpen(true)} />
        </div>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          {/* Keyed by path so a crashed page is replaced when the user navigates away. */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
