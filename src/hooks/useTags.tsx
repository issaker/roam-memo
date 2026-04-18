/**
 * useTags Hook
 *
 * Parses comma-separated tag list into individual deck names.
 * Supports quoted tags containing commas (e.g., "french exam, fun facts").
 * First tag is auto-selected as the default deck.
 */
import * as React from 'react';
import { DAILYNOTE_DECK_KEY } from '~/constants';

const splitStringByCommas = (str: string) => {
  const result: string[] = [];
  let current = '';
  let isInsideQuote = false;

  for (let i = 0; i < str.length; i++) {
    const currentChar = str[i];
    if (currentChar === '"') {
      isInsideQuote = !isInsideQuote;
    } else if (currentChar === ',' && !isInsideQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += currentChar;
    }
  }

  result.push(current.trim());
  return result;
};

const useTags = ({ tagsListString, dailynoteEnabled }: { tagsListString: string; dailynoteEnabled: boolean }) => {
  const buildTagsList = React.useCallback((str: string, enabled: boolean) => {
    const parsed = splitStringByCommas(str);
    if (enabled) {
      return [...parsed, DAILYNOTE_DECK_KEY];
    }
    return parsed;
  }, []);

  const [tagsList, setTagsList] = React.useState<string[]>(buildTagsList(tagsListString, dailynoteEnabled));
  const [selectedTag, setSelectedTag] = React.useState<string>(tagsList[0]);

  React.useEffect(() => {
    const newList = buildTagsList(tagsListString, dailynoteEnabled);
    setTagsList(newList);
    if (!newList.includes(selectedTag)) {
      setSelectedTag(newList[0]);
    }
  }, [tagsListString, dailynoteEnabled, buildTagsList]);

  return {
    selectedTag,
    setSelectedTag,
    tagsList,
  };
};

export default useTags;
