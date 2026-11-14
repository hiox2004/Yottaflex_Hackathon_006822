// Root page: shows the app title and the backend health status from GET /api/health.
import { useEffect, useState } from 'react';
import { getHealth } from './api/client';

type BackendStatus = 'checking' | 'ok' | 'unavailable';

export function App() {
  const [backend, setBackend] = useState<BackendStatus>('checking');

  useEffect(() => {
    let active = true;
    getHealth()
      .then(() => {
        if (active) setBackend('ok');
      })
      .catch(() => {
        if (active) setBackend('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <h1>Academic Integrity Workflow</h1>
      <p>Backend: {backend === 'checking' ? 'checking...' : backend}</p>
    </main>
  );
}
