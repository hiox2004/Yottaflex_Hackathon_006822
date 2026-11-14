// App shell: providers, header and the four routes.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { AuditPage } from './pages/AuditPage';
import { Placeholder } from './pages/Placeholder';
import { CasePage } from './pages/CasePage';
import { QueuePage } from './pages/QueuePage';
import { RulesPage } from './pages/RulesPage';
import { SessionProvider } from './session';

export const makeQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000 } } });

export function App({ client = makeQueryClient() }: { client?: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <BrowserRouter>
          <Header />
          <main className="page">
            <Routes>
              <Route path="/" element={<QueuePage />} />
              <Route path="/cases/:id" element={<CasePage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="*" element={<Placeholder title="Page not found" />} />
            </Routes>
          </main>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
