import { render, fireEvent } from '@testing-library/react-native';
import { tokens } from '../../src/design';
import { Text, Button, EmptyState, ErrorState } from '../../src/components';

describe('Design Tokens Foundation', () => {
  it('defines valid 4pt/8pt spacing rhythm', () => {
    expect(tokens.spacing.xs).toBe(4);
    expect(tokens.spacing.sm).toBe(8);
    expect(tokens.spacing.md).toBe(16);
    expect(tokens.spacing.lg).toBe(24);
  });

  it('defines standard border radii', () => {
    expect(tokens.radius.sm).toBe(8);
    expect(tokens.radius.md).toBe(12);
    expect(tokens.radius.lg).toBe(16);
    expect(tokens.radius.xl).toBe(24);
  });

  it('defines primary and secondary color palettes', () => {
    expect(tokens.colors.primary.default).toBeDefined();
    expect(tokens.colors.secondary.default).toBeDefined();
    expect(tokens.colors.background).toBeDefined();
  });
});

describe('Foundation Components', () => {
  it('renders Text component with expected children', () => {
    const { getByText } = render(<Text variant="title1">Neram Platform</Text>);
    expect(getByText('Neram Platform')).toBeTruthy();
  });

  it('renders Button component and triggers onPress', () => {
    const handlePress = jest.fn();
    const { getByText } = render(
      <Button title="Test Action" onPress={handlePress} />
    );

    const button = getByText('Test Action');
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('renders EmptyState component with action callback', () => {
    const handleAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="Empty Title"
        description="Empty Description"
        actionLabel="Perform Action"
        onAction={handleAction}
      />
    );

    expect(getByText('Empty Title')).toBeTruthy();
    expect(getByText('Empty Description')).toBeTruthy();
    const actionBtn = getByText('Perform Action');
    fireEvent.press(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders ErrorState component with retry action', () => {
    const handleRetry = jest.fn();
    const { getByText } = render(
      <ErrorState
        title="Error Encountered"
        message="Failure reason"
        retryLabel="Retry Now"
        onRetry={handleRetry}
      />
    );

    expect(getByText('Error Encountered')).toBeTruthy();
    expect(getByText('Failure reason')).toBeTruthy();
    const retryBtn = getByText('Retry Now');
    fireEvent.press(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
