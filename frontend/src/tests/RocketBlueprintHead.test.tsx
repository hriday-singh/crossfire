import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RocketBlueprintHead } from '../components/features/RocketBlueprintHead';

describe('RocketBlueprintHead Component', () => {
  it('renders correctly in active/testing state', () => {
    const { container } = render(<RocketBlueprintHead isFinished={false} isTesting={true} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTitle(/Active Pipeline Progress/i)).toBeInTheDocument();
  });

  it('renders correctly in finished state', () => {
    const { container } = render(<RocketBlueprintHead isFinished={true} isTesting={false} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTitle(/Mission Complete/i)).toBeInTheDocument();
  });
});
