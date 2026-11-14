// App shell: providers, the sidebar layout and the routes.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RoleGate } from './components/layout/RoleGate';
import { AdminPage } from './pages/AdminPage';
import { AuditPage } from './pages/AuditPage';
import { CasePage } from './pages/CasePage';
import { CasesPage } from './pages/CasesPage';
import { GuidePage } from './pages/GuidePage';
import { LabPage } from './pages/LabPage';
import { NotFound } from './pages/Placeholder';
import { OverviewPage } from './pages/OverviewPage';
import { RulesPage } from './pages/RulesPage';
import { SessionProvider } from './session';

export const makeQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000 } } });

export function App({ client = makeQueryClient() }: { client?: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<OverviewPage />} />
              <Route path="cases" element={<CasesPage />} />
              <Route path="cases/:id" element={<CasePage />} />
              <Route path="guide" element={<GuidePage />} />
              <Route path="lab" element={<RoleGate page="lab"><LabPage /></RoleGate>} />
              <Route path="audit" element={<RoleGate page="audit"><AuditPage /></RoleGate>} />
              <Route path="rules" element={<RulesPage />} />
              <Route path="admin" element={<RoleGate page="admin"><AdminPage /></RoleGate>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
