import { execSync } from 'child_process';
import path from 'path';

// Both `src/` (tsx in dev) and `dist/` (production) sit two levels below the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Commits on the current branch that touch `dir`: increases only when that layer changes.
function gitCommitCount(dir: string): number {
  try {
    const out = execSync(`git rev-list --count HEAD -- ${dir}`, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] });
    return Number(out.toString().trim()) || 0;
  } catch {
    console.warn(`[VERSION] git commit count for ${dir} unavailable, using 0`);
    return 0;
  }
}

export const version = {
  backend: gitCommitCount('backend'),
  ea: gitCommitCount('ea'),
};
