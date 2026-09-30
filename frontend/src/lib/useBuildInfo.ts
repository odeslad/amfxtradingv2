import { useEffect, useState } from 'react';
import { apiUrl } from './api';

export interface BuildInfo {
  frontend: number;
  backend: number | null;
  ea: number | null;
}

interface VersionResponse {
  backend: number;
  ea: number;
}

// Frontend number is baked in at build time; backend/EA come from GET /version.
export function useBuildInfo(): BuildInfo {
  const [remote, setRemote] = useState<VersionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/version'))
      .then(res => (res.ok ? (res.json() as Promise<VersionResponse>) : null))
      .then(data => { if (!cancelled && data) setRemote(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return {
    frontend: __BUILD_FRONTEND__,
    backend: remote?.backend ?? null,
    ea: remote?.ea ?? null,
  };
}
