// App shell: providers, header and the four routes.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { Placeholder } from './pages/Placeholder';
import { QueuePage } from './pages/QueuePage';
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
              <Route path="/cases/:id" element={<Placeholder title="Case" />} />
              <Route path="/rules" element={<Placeholder title="Rules" />} />
              <Route path="/audit" element={<Placeholder title="Audit" />} />
              <Route path="*" element={<Placeholder title="Page not found" />} />
            </Routes>
          </main>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
