import React from 'react';
void React;
import { render } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import {
  SkeletonShimmer,
  SkeletonBox,
  SkeletonCircle,
  SkeletonText,
  FadeInContent,
  SkeletonGroupFeed,
  SkeletonGroupDetail,
  SkeletonChat,
  SkeletonTask,
  SkeletonPoll,
  SkeletonEvent,
  SkeletonFile,
  SkeletonOuting,
  SkeletonActivity,
} from '../../src/components/skeleton';

describe('Skeleton & Shimmer Components', () => {
  it('renders primitive skeleton components with testIDs', () => {
    const { getByTestId } = render(
      <>
        <SkeletonShimmer testID="test-shimmer" />
        <SkeletonBox width={100} height={20} testID="test-box" />
        <SkeletonCircle size={40} testID="test-circle" />
        <SkeletonText lines={3} testID="test-text" />
      </>,
    );

    expect(getByTestId('test-shimmer')).toBeTruthy();
    expect(getByTestId('test-box')).toBeTruthy();
    expect(getByTestId('test-circle')).toBeTruthy();
    expect(getByTestId('test-text')).toBeTruthy();
  });

  it('renders FadeInContent wrapper correctly with children', () => {
    const { getByTestId, getByText } = render(
      <FadeInContent testID="fade-in-wrapper">
        <RNText>Fade in payload</RNText>
      </FadeInContent>,
    );

    expect(getByTestId('fade-in-wrapper')).toBeTruthy();
    expect(getByText('Fade in payload')).toBeTruthy();
  });

  it('renders SkeletonGroupFeed placeholder correctly', () => {
    const { getByTestId } = render(<SkeletonGroupFeed />);
    expect(getByTestId('skeleton-group-feed')).toBeTruthy();
  });

  it('renders SkeletonGroupDetail with hero and section placeholders', () => {
    const { getByTestId } = render(<SkeletonGroupDetail />);
    expect(getByTestId('skeleton-group-detail')).toBeTruthy();
  });

  it('renders SkeletonChat with message bubbles and input placeholder', () => {
    const { getByTestId } = render(<SkeletonChat />);
    expect(getByTestId('skeleton-chat')).toBeTruthy();
  });

  it('renders SkeletonTask with task board placeholder', () => {
    const { getByTestId } = render(<SkeletonTask />);
    expect(getByTestId('skeleton-task')).toBeTruthy();
  });

  it('renders SkeletonPoll with consensus poll placeholder', () => {
    const { getByTestId } = render(<SkeletonPoll />);
    expect(getByTestId('skeleton-poll')).toBeTruthy();
  });

  it('renders SkeletonEvent with itinerary cards placeholder', () => {
    const { getByTestId } = render(<SkeletonEvent />);
    expect(getByTestId('skeleton-event')).toBeTruthy();
  });

  it('renders SkeletonFile with vault grid placeholder', () => {
    const { getByTestId } = render(<SkeletonFile />);
    expect(getByTestId('skeleton-file')).toBeTruthy();
  });

  it('renders SkeletonOuting with map hero and participant avatars placeholder', () => {
    const { getByTestId } = render(<SkeletonOuting />);
    expect(getByTestId('skeleton-outing')).toBeTruthy();
  });

  it('renders SkeletonActivity with notification rows placeholder', () => {
    const { getByTestId, getAllByTestId } = render(<SkeletonActivity count={4} />);
    expect(getByTestId('skeleton-activity')).toBeTruthy();
    expect(getAllByTestId('skeleton-activity-item').length).toBe(4);
  });
});
