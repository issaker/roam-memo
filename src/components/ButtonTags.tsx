import styled from '@emotion/styled';

const ButtonTags = styled.span<{ kind?: 'light' }>`
  position: relative;
  display: inline-block;
  text-transform: uppercase;
  font-size: 9px;
  padding: 1px 2px;
  border-radius: 2px;
  top: -0.5px;
  color: currentColor;
  opacity: 0.6;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: currentColor;
    opacity: ${({ kind }) => (kind === 'light' ? 0.2 : 0.15)};
    border-radius: 2px;
    z-index: -1;
  }
`;

export default ButtonTags;
