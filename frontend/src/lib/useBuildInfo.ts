import { useEffect, useState } from 'react';
import { apiFetch } from './api';

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
    apiFetch<VersionResponse>('/version')
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
