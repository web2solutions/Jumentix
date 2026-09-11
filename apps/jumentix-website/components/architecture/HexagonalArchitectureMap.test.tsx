import { render, screen, userEvent } from '@/test-utils';
import { HexagonalArchitectureMap } from './HexagonalArchitectureMap';

describe('HexagonalArchitectureMap', () => {
  it('renders the interactive hexagonal map with GUI on the inbound side (EN)', async () => {
    expect.hasAssertions();
    render(<HexagonalArchitectureMap locale="en" />);

    expect(screen.getByTestId('hexagonal-architecture-map')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Backend-template hexagonal map',
    );
    expect(screen.getByText(/Web and desktop GUIs sit on the inbound/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Inbound adapters' }));
    expect(screen.getByText('interface/GUI/web/')).toBeInTheDocument();
    expect(screen.getByText('interface/GUI/desktop/')).toBeInTheDocument();
    expect(screen.getByText(/Web GUI \(SPA\/PWA\/React\/Vue\) — slot ready/i)).toBeInTheDocument();
  });

  it('renders Portuguese copy and domain selection', async () => {
    expect.hasAssertions();
    render(<HexagonalArchitectureMap locale="pt-BR" />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Mapa hexagonal do backend-template',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Domínio' }));
    expect(screen.getByText('modules/Users/domain/')).toBeInTheDocument();
  });
});
