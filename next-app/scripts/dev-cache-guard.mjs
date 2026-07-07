// Runs automatically before `next dev` (see package.json "predev"). `.next` is
// an NTFS junction to a local, non-OneDrive-synced folder (see
// project-docs/DECISIONS.md, "Turbopack dev cache moved off OneDrive"), which
// is the real fix for the recurring cache corruption. This script is just a
// belt-and-suspenders safety net: if the Turbopack dev cache was ever left in
// a corrupted state anyway (an unclean shutdown, an antivirus scan, a crash
// mid-write), it wipes just that subfolder so `next dev` rebuilds it fresh
// instead of failing with a sticky "corrupted database" / "Access is denied"
// error for the rest of the session.
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const turbopackCacheDir = join(process.cwd(), '.next', 'dev', 'cache', 'turbopack');

function looksCorrupted(dir) {
  // A healthy cache has real `.sst`/`.meta` data files alongside `CURRENT`.
  // A cache that failed its very first commit (the known Windows
  // FlushFileBuffers/OneDrive-lock failure mode) leaves only bookkeeping
  // files behind with no actual data — that shape is safe to treat as dead
  // and clear proactively rather than let Turbopack error on it.
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  if (entries.length === 0) return false;
  const hasData = entries.some((name) => name.endsWith('.sst') || name.endsWith('.meta'));
  const hasBookkeepingOnly = entries.every((name) => name === 'CURRENT' || name === 'LOCK' || name.startsWith('LOG'));
  return !hasData && hasBookkeepingOnly;
}

if (existsSync(turbopackCacheDir) && looksCorrupted(turbopackCacheDir)) {
  console.warn('[dev-cache-guard] Turbopack dev cache looks stale/incomplete — clearing it before starting.');
  rmSync(turbopackCacheDir, { recursive: true, force: true });
}
