import type { Metadata } from 'next';
import { ReleaseNotes } from '@/components/ReleaseNotes/ReleaseNotes';

/**
 * JUM-640 — the released versions of Jumentix.
 *
 * This used to be `content/release-notes.mdx`, which answered 404: the docs
 * resolver rewrites every single-segment path into `content/jumentix/`, and
 * that whole subtree is regenerated from `config/content-sources.json` on every
 * build (`scripts/sync-markdown-content.mjs` removes the output directory
 * first). A hand-written page cannot live in either place, so the component
 * gets an app route instead — beside `/changelog`, which shows commits while
 * this shows releases.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Release Notes',
  description: 'Released versions of Jumentix, read from the GitHub releases of the repository.',
};

export default function ReleaseNotesPage() {
  return <ReleaseNotes />;
}
