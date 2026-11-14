// Topbar: mobile menu button, breadcrumb built from the route, and the theme toggle.
import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from './theme';

const SECTIONS: Record<string, string> = { guide: 'Guide', cases: 'Cases', lab: 'Test Lab', audit: 'Audit', rules: 'Rules', admin: 'Administration' };

interface Crumb {
  label: string;
  to?: string;
}

/** `from` is the list the user came from (set by CaseRow), used as the Cases crumb target when it is a Cases URL. */
function crumbsFor(pathname: string, from?: string): Crumb[] {
  const [section, id] = pathname.split('/').filter(Boolean);
  if (!section) return [{ label: 'Overview' }];
  const label = SECTIONS[section];
  if (!label) return [{ label: 'Not found' }];
  const back = from?.startsWith('/cases') ? from : `/${section}`;
  const crumbs: Crumb[] = [{ label, to: back }];
  if (id) crumbs.push({ label: `Case ${id}` });
  return crumbs;
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();
  const from = (location.state as { from?: string } | null)?.from;
  const crumbs = crumbsFor(location.pathname, from);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </Button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        {crumbs.map((crumb, i) => (
          <Fragment key={`${crumb.label}-${i}`}>
            {i > 0 && <span className="text-muted-foreground">/</span>}
            {crumb.to && i < crumbs.length - 1 ? (
              <Link to={crumb.to} className="text-muted-foreground hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium">{crumb.label}</span>
            )}
          </Fragment>
        ))}
      </nav>

      <div className="ml-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
      </div>
    </header>
  );
}
