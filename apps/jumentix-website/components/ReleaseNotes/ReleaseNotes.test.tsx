import { render, screen } from '@/test-utils';
import { useReleaseNotes } from './use-release-notes';
import { ReleaseNotes } from './ReleaseNotes';

jest.mock('./use-release-notes', () => ({
  useReleaseNotes: jest.fn()
}));

// nextra is an ESM-only docs dependency that jsdom cannot resolve; the
// releases timeline body rendering is irrelevant to these state tests.
jest.mock('nextra/mdx-remote', () => ({ MDXRemote: () => null }), { virtual: true });
jest.mock('../../mdx-components', () => ({ useMDXComponents: () => ({}) }));

const mockedUseReleaseNotes = useReleaseNotes as jest.Mock;

describe('ReleaseNotes (JUM-719)', () => {
  afterEach(() => {
    mockedUseReleaseNotes.mockReset();
  });

  it('shows the loading skeleton while fetching', () => {
    expect.hasAssertions();
    mockedUseReleaseNotes.mockReturnValue({ data: [], error: null, isLoading: true });
    render(<ReleaseNotes />);
    expect(screen.getByText('Loading releases...')).toBeInTheDocument();
  });

  it('shows a real empty state when there are no tagged releases', () => {
    expect.hasAssertions();
    mockedUseReleaseNotes.mockReturnValue({ data: [], error: null, isLoading: false });
    render(<ReleaseNotes />);
    expect(screen.queryByText('Loading releases...')).not.toBeInTheDocument();
    expect(screen.getByText(/No tagged releases yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the changelog' })).toHaveAttribute('href', '/changelog');
  });

  it('shows the error alert when loading fails', () => {
    expect.hasAssertions();
    mockedUseReleaseNotes.mockReturnValue({ data: [], error: new Error('boom'), isLoading: false });
    render(<ReleaseNotes />);
    expect(screen.getByText('Failed to load releases')).toBeInTheDocument();
  });
});
