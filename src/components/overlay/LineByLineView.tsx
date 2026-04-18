import * as React from 'react';
import styled from '@emotion/styled';
import CardBlock from '~/components/overlay/CardBlock';
import { colors } from '~/theme';
import useBlockInfo from '~/hooks/useBlockInfo';

interface LineByLineViewProps {
  currentCardRefUid: string;
  childUidsList: string[];
  lineByLineRevealedCount: number;
  lineByLineCurrentChildIndex: number;
  lineByLineProgress: Record<string, any>;
  setHasCloze: (hasCloze: boolean) => void;
  showBreadcrumbs: boolean;
}

const LineByLineView = ({
  currentCardRefUid,
  childUidsList,
  lineByLineRevealedCount,
  lineByLineCurrentChildIndex,
  lineByLineProgress,
  setHasCloze,
  showBreadcrumbs,
}: LineByLineViewProps) => {
  const { blockInfo } = useBlockInfo({ refUid: currentCardRefUid });

  return (
    <>
      <CardBlock
        refUid={currentCardRefUid}
        showAnswers={true}
        setHasCloze={setHasCloze}
        breadcrumbs={blockInfo.breadcrumbs}
        showBreadcrumbs={showBreadcrumbs}
        onRenderComplete={() => {}}
        hideChildren={true}
      />
      <LineByLineSeparator>
        Line {lineByLineCurrentChildIndex + 1} / {childUidsList.length}
      </LineByLineSeparator>
      {childUidsList.slice(0, lineByLineRevealedCount).map((uid, index) => {
        const isCurrentLine = index === lineByLineCurrentChildIndex;
        const childProgress = lineByLineProgress[uid];
        const isMastered =
          childProgress && new Date(childProgress.nextDueDate) > new Date();
        return (
          <LineByLineItem key={uid} $isCurrent={isCurrentLine} $isMastered={isMastered}>
            <CardBlock
              refUid={uid}
              showAnswers={true}
              setHasCloze={setHasCloze}
              breadcrumbs={[]}
              showBreadcrumbs={false}
              onRenderComplete={() => {}}
            />
          </LineByLineItem>
        );
      })}
    </>
  );
};

const LineByLineSeparator = styled.div`
  font-size: 11px;
  opacity: 0.5;
  text-align: center;
  padding: 4px 0;
  border-top: 1px dashed ${colors.borderSubtle};
  margin-top: 8px;
`;

const LineByLineItem = styled.div<{ $isCurrent: boolean; $isMastered: boolean }>`
  border-left: 3px solid
    ${(props) =>
      props.$isCurrent
        ? colors.lineByLineCurrentBorder
        : props.$isMastered
        ? colors.lineByLineMasteredBorder
        : colors.borderSubtle};
  padding-left: 8px;
  margin-left: 4px;
  margin-top: 4px;
  opacity: ${(props) => (props.$isMastered && !props.$isCurrent ? 0.6 : 1)};
`;

export default LineByLineView;
