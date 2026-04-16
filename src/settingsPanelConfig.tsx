import * as asyncUtils from '~/utils/async';
import RoamSrImportPanel from '~/components/RoamSrImportPanel';
import MigrateLegacyDataPanel from '~/components/MigrateLegacyDataPanel';
import { defaultSettings } from './hooks/useSettings';

const settingsPanelConfig = ({ settings, setSettings }) => {
  const syncFn = async ({ key, value }: { key: string; value: any }) => {
    window.roamMemo.extensionAPI.settings.set(key, value);
    setSettings((currentSettings) => {
      return { ...currentSettings, [key]: value };
    });
  };

  const processChange = asyncUtils.debounce((e) => syncFn(e));

  return {
    tabTitle: 'Memo',
    settings: [
      {
        id: 'tagsListString',
        name: 'Tag Pages (aka Decks)',
        description:
          'Separate multiple decks with commas. Example: "memo, sr, 🐘, french exam, fun facts"',
        action: {
          type: 'input',
          placeholder: defaultSettings.tagsListString,
          onChange: (e) => {
            const tagsListString = e.target.value.trim();
            processChange({ key: 'tagsListString', value: tagsListString });
          },
        },
      },
      {
        id: 'migrate-roam-sr-data',
        name: 'Migrate Roam/Sr Data',
        description: 'A tool to import your Roam/Sr data into Memo.',
        action: {
          type: 'reactComponent',
          component: () => <RoamSrImportPanel dataPageTitle={settings.dataPageTitle} />,
        },
      },
      {
        id: 'migrate-legacy-data',
        name: 'Data Migration',
        description:
          'Migrate card data to the current architecture: rename cardType→reviewMode in meta, add missing reviewMode to meta, and remove redundant reviewMode from session records. Safe to run multiple times.',
        action: {
          type: 'reactComponent',
          component: () => <MigrateLegacyDataPanel dataPageTitle={settings.dataPageTitle} />,
        },
      },
      {
        id: 'dataPageTitle',
        name: 'Data Page Title',
        description: "Name of page where we'll store all your data",
        action: {
          type: 'input',
          placeholder: defaultSettings.dataPageTitle,
          onChange: (e) => {
            const value = e.target.value.trim();
            processChange({ key: 'dataPageTitle', value });
          },
        },
      },
      {
        id: 'dailyLimit',
        name: 'Daily Review Limit',
        description: 'Number of cards to review each day. 0 means no limit.',
        action: {
          type: 'input',
          placeholder: defaultSettings.dailyLimit,
          onChange: (e) => {
            const value = e.target.value.trim();
            const isNumber = !isNaN(Number(value));

            processChange({ key: 'dailyLimit', value: isNumber ? Number(value) : 0 });
          },
        },
      },
      {
        id: 'forgotReinsertOffset',
        name: 'Reinsert "Forgot" Cards After N Cards',
        description:
          'When you mark a card as "Forgot", it will be reinserted into the current review session N cards later. Set to 0 to disable reinsertion (the card will only appear in your next session based on scheduling).',
        action: {
          type: 'input',
          placeholder: defaultSettings.forgotReinsertOffset,
          onChange: (e) => {
            const value = e.target.value.trim();
            const isNumber = !isNaN(Number(value));
            processChange({ key: 'forgotReinsertOffset', value: isNumber ? Number(value) : 3 });
          },
        },
      },
      {
        id: 'readReinsertOffset',
        name: 'Reinsert "Incremental Read" Cards After N Cards',
        description:
          'When you click "Next" on an Incremental Read card, it will be reinserted into the current review session N cards later. Set to 0 to disable reinsertion.',
        action: {
          type: 'input',
          placeholder: defaultSettings.readReinsertOffset,
          onChange: (e) => {
            const value = e.target.value.trim();
            const isNumber = !isNaN(Number(value));
            processChange({ key: 'readReinsertOffset', value: isNumber ? Number(value) : 3 });
          },
        },
      },
      {
        id: 'showBreadcrumbs',
        name: 'Show Breadcrumbs',
        description:
          'Show breadcrumb navigation above each card during review. You can also toggle this with the B key during review.',
        action: {
          type: 'switch',
          onChange: (e) => {
            processChange({ key: 'showBreadcrumbs', value: e.target.checked });
          },
        },
      },
      {
        id: 'showModeBorders',
        name: 'Show Review Mode Borders',
        description:
          'Show the green/orange dialog border that indicates whether the current card is in Spaced Interval or Fixed Interval mode.',
        action: {
          type: 'switch',
          onChange: (e) => {
            processChange({ key: 'showModeBorders', value: e.target.checked });
          },
        },
      },
      {
        id: 'rtlEnabled',
        name: 'Right-to-Left (RTL) Enabled',
        description: 'Enable RTL for languages like Arabic, Hebrew, etc.',
        action: {
          type: 'switch',
          onChange: (e) => {
            processChange({ key: 'rtlEnabled', value: e.target.checked });
          },
        },
      },
      {
        id: 'shuffleCards',
        name: 'Shuffle Cards',
        description:
          'OFF: Due cards sorted by urgency (most overdue → hardest → least mature). New cards in reverse creation order. ON: All cards randomly shuffled.',
        action: {
          type: 'switch',
          onChange: (e) => {
            processChange({ key: 'shuffleCards', value: e.target.checked });
          },
        },
      },
    ],
  };
};

export default settingsPanelConfig;
