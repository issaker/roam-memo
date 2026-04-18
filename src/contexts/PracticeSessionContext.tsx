import * as React from 'react';
import { Settings } from '~/hooks/useSettings';
import { CompleteRecords, SchedulingAlgorithm, InteractionStyle } from '~/models/session';
import { Today, RenderMode } from '~/models/practice';
import { handlePracticeProps } from '~/app';
import { useSafeContext } from '~/hooks/useSafeContext';

export interface PracticeSessionContextValue {
  settings: Settings;
  practiceData: CompleteRecords;
  today: Today;
  selectedTag: string;
  tagsList: string[];
  isCramming: boolean;
  setIsCramming: (isCramming: boolean) => void;
  handlePracticeClick: (props: handlePracticeProps) => void;
  handleMemoTagChange: (tag: string) => void;
  fetchPracticeData: () => void;
  dataPageTitle: string;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  updateSetting: (key: keyof Settings, value: any) => void;
  dailyLimit: number;
  historyCleanupKeepCount: number;
  algorithm?: SchedulingAlgorithm;
  interaction?: InteractionStyle;
  onSelectAlgorithm?: (algorithm: SchedulingAlgorithm) => void;
  onSelectInteraction?: (interaction: InteractionStyle) => void;
}

export const PracticeSessionContext = React.createContext<PracticeSessionContextValue | undefined>(
  undefined
);

interface PracticeSessionProviderProps {
  settings: Settings;
  practiceData: CompleteRecords;
  today: Today;
  selectedTag: string;
  tagsList: string[];
  isCramming: boolean;
  setIsCramming: (isCramming: boolean) => void;
  handlePracticeClick: (props: handlePracticeProps) => void;
  handleMemoTagChange: (tag: string) => void;
  fetchPracticeData: () => void;
  dataPageTitle: string;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  updateSetting: (key: keyof Settings, value: any) => void;
  children: React.ReactNode;
}

export const PracticeSessionProvider = ({
  settings,
  practiceData,
  today,
  selectedTag,
  tagsList,
  isCramming,
  setIsCramming,
  handlePracticeClick,
  handleMemoTagChange,
  fetchPracticeData,
  dataPageTitle,
  setRenderMode,
  updateSetting,
  children,
}: PracticeSessionProviderProps) => {
  const value = React.useMemo<PracticeSessionContextValue>(
    () => ({
      settings,
      practiceData,
      today,
      selectedTag,
      tagsList,
      isCramming,
      setIsCramming,
      handlePracticeClick,
      handleMemoTagChange,
      fetchPracticeData,
      dataPageTitle,
      setRenderMode,
      updateSetting,
      dailyLimit: settings.dailyLimit,
      historyCleanupKeepCount: settings.historyCleanupKeepCount,
    }),
    [
      settings,
      practiceData,
      today,
      selectedTag,
      tagsList,
      isCramming,
      setIsCramming,
      handlePracticeClick,
      handleMemoTagChange,
      fetchPracticeData,
      dataPageTitle,
      setRenderMode,
      updateSetting,
    ]
  );

  return (
    <PracticeSessionContext.Provider value={value}>{children}</PracticeSessionContext.Provider>
  );
};

export const usePracticeSession = (): PracticeSessionContextValue => {
  return useSafeContext(PracticeSessionContext) as PracticeSessionContextValue;
};
