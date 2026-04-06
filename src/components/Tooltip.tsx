import { Tooltip as BluePrintTooltip } from '@blueprintjs/core';
import styled from '@emotion/styled';
interface Props {
  className?: string;
  wrapperClassName?: string;
  children: JSX.Element;
  content: string | JSX.Element;
  placement: string;
}

const Wrapper = ({ className, wrapperClassName, ...restProps }: Props) => {
  // Detect if device is mobile/touch-enabled
  const isTouchDevice = typeof window !== 'undefined' && 
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  // On touch devices, don't render tooltip to prevent flickering
  if (isTouchDevice) {
    return <>{restProps.children}</>;
  }
  
  return (
    // @ts-ignore
    <BluePrintTooltip className={wrapperClassName} popoverClassName={className} {...restProps} />
  );
};

const Tooltip = styled(Wrapper)`
  &.bp3-tooltip .bp3-popover-content {
    font-size: 12px;
    padding: 2px 5px;
  }
`;

export default Tooltip;
