import { render, screen } from '@/test-utils';
import changelogEntries from '@/content/changelog.json';
import { CommercialChangelogPage } from './ChangelogPage';

describe('CommercialChangelogPage (JUM-718)', () => {
  it('renders bundled changelog entries without any GitHub API dependency', () => {
    expect.hasAssertions();
    expect(changelogEntries.length).toBeGreaterThan(0);
    render(<CommercialChangelogPage locale="en" page="1" />);
    const first = changelogEntries[0];
    expect(screen.getByText('Jumentix changelog')).toBeInTheDocument();
    expect(screen.getAllByText(first.message).length).toBeGreaterThan(0);
    expect(screen.getByText(first.sha.slice(0, 8))).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View change on GitHub' }).length).toBeGreaterThan(0);
  });

  it('clamps out-of-range pages to the last page', () => {
    expect.hasAssertions();
    const totalPages = Math.max(1, Math.ceil(changelogEntries.length / 200));
    render(<CommercialChangelogPage locale="en" page="999" />);
    expect(screen.getByText(`Page ${totalPages} of ${totalPages}`)).toBeInTheDocument();
  });

  it('localizes to PT-BR', () => {
    expect.hasAssertions();
    render(<CommercialChangelogPage locale="pt-BR" page="1" />);
    expect(screen.getByText('Changelog do Jumentix')).toBeInTheDocument();
    expect(screen.getByText('Histórico completo')).toBeInTheDocument();
  });
});
