import React from 'react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { errorApiRef } from '@backstage/core-plugin-api';
import { Matcher, render, screen } from '@testing-library/react';
import { TerraformLatestRun } from './TerraformLatestRun';
import { useRuns } from '../../hooks';
import { Run } from '../../hooks/types';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockEntity } from '../../mocks/entity';
import { TERRAFORM_WORKSPACE_ANNOTATION } from '../../annotations';

jest.mock('../../hooks/useRuns');

const mockErrorApi = {
  post: jest.fn(),
  error$: jest.fn(),
};
const apis = [[errorApiRef, mockErrorApi] as const] as const;

const testDataUndefinedName = {
  id: '123',
  message: 'this is a text message',
  status: 'done',
  createdAt: '2023-05-24T10:23:40.172Z',
  confirmedBy: undefined,
  plan: {
    logs: 'some text',
  },
};


const testDataValid = {
  id: "testId",
  message: "testMessage",
  status: "testStatus",
  createdAt: new Date().toISOString(),
  confirmedBy: {
    name: "testUser",
  }
};

describe('TerraformLatestRun', () => {
  const refetchMock = jest.fn(() => { });
  const workspaceName = mockEntity.metadata.annotations[TERRAFORM_WORKSPACE_ANNOTATION];
  const runDescription: RegExp = /This contains some useful information/i
  const buildTitleRegEx = (runStatusContext: string) => new RegExp(`${runStatusContext} for ${workspaceName}`);


  afterEach(() => {
    (useRuns as jest.Mock).mockRestore();
    refetchMock.mockReset();
  });


  it('renders the card when isLoading', async () => {
    buildUseRunMock({ isLoading: true });
    render(
      <EntityProvider entity={mockEntity}>
        <TerraformLatestRun />
      </EntityProvider>
    );

    const title = await screen.findByText(/Getting data for workspace/i);
    const userLabel = screen.queryByText(/User/i);

    expect(title).toBeInTheDocument();
    expect(userLabel).toBeNull();
  });


  it('renders the card when data is empty', async () => {
    buildUseRunMock({});
    render(
      <EntityProvider entity={mockEntity}>
        <TerraformLatestRun />
      </EntityProvider>
    );

    const title = await screen.findByText(buildTitleRegEx('No runs'));
    const userLabel = screen.queryByText(/User/i);

    expect(title).toBeInTheDocument();
    expect(userLabel).toBeNull();
  });


  it('renders the card when empty name is passed', async () => {
    buildUseRunMock({ runs: [testDataUndefinedName] })
    render(
      <EntityProvider entity={mockEntity}>
        <TerraformLatestRun />
      </EntityProvider>
    );

    const title = await screen.findByText(buildTitleRegEx('Latest run'));
    const userLabel = await screen.findByText(/User/i);
    const userName = await screen.findByText(/Unknown/i);

    expect(title).toBeInTheDocument();
    expect(userLabel).toBeInTheDocument();
    expect(userName).toBeInTheDocument();
  });

  it('renders empty data message', async () => {
    buildUseRunMock({});
    render(
      <EntityProvider entity={mockEntity}>
        <TerraformLatestRun />
      </EntityProvider>
    );

    await expectation(buildTitleRegEx('No runs'));

    expectNotFound([runDescription, 'Refresh']);
  });


  it('renders normally with correct data', async () => {
    buildUseRunMock({ runs: [testDataValid] });

    render(
      <EntityProvider entity={mockEntity}>
        <TerraformLatestRun />
      </EntityProvider>
    );

    await expectation(runDescription);
  })



  it('calls refetch when refresh is clicked', async () => {
    buildUseRunMock({ runs: [testDataValid], refetch: refetchMock });
    render(
      <EntityProvider entity={mockEntity}>
        <TerraformLatestRun />
      </EntityProvider>
    );

    const refresh = await screen.findByLabelText('Refresh');
    refresh.click();
    refresh.click();

    expect(refetchMock).toHaveBeenCalledTimes(2);
  });


  it('renders error panel on error fetching', async () => {
    buildUseRunMock({
      runs: undefined,
      isLoading: false,
      error: new Error('Some fake error.'),
      refetch: refetchMock,
    });

    await renderInTestApp(
      <TestApiProvider apis={apis}>
        <EntityProvider entity={mockEntity}>
          <TerraformLatestRun />
        </EntityProvider>
      </TestApiProvider>,
    );

    const error = await screen.findByText('Error: Some fake error.');

    expect(error).toBeInTheDocument();
  });


  it('renders MissingAnnotationEmptyState when annotation is not present', async () => {
    // If the following is refactored, ensure it is cloning mockEntity, and not merely referencing it!
    const missingAnnotation = JSON.parse(JSON.stringify(mockEntity));
    missingAnnotation.metadata.annotations = {};

    render(
      <EntityProvider entity={missingAnnotation}>
        <TerraformLatestRun />
      </EntityProvider>,
    );

    const missingAnnotationText = await screen.findByText('Missing Annotation');

    expect(missingAnnotationText).toBeInTheDocument();
  });


  function buildUseRunMock({ runs, error, isLoading, refetch }:
    {
      runs?: Run[],
      error?: Error,
      isLoading?: boolean
      refetch?: Promise<Run[]> | jest.Mock<void, [], any>
    }
  ): jest.ProvidesHookCallback {
    return (useRuns as jest.Mock).mockReturnValue({
      data: runs,
      isLoading,
      error,
      refetch,
    });
  }


  async function expectation(matcher: Matcher) {
    const htmlElement = await screen.findByText(matcher);
    expect(htmlElement).toBeInTheDocument();
  }


  function expectNotFound(notFoundExpectations: Matcher[]) {

    notFoundExpectations
      .map(m => screen.queryByText(m))
      .map((e: HTMLElement | null) => expect(e).toBeNull());
  }


});