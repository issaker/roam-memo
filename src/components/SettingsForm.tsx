import * as React from 'react';
import { colors } from '~/theme';

export interface SettingsFormSettings {
  tagsListString: string;
  dataPageTitle: string;
  dailyLimit: number;
  forgotReinsertOffset: number;
  readReinsertOffset: number;
  showModeBorders: boolean;
  rtlEnabled: boolean;
  shuffleCards: boolean;
}

interface SettingsFormProps {
  settings: SettingsFormSettings;
  updateSetting: (key: string, value: any) => void;
  dataPageTitle: string;
}

const SettingsForm = ({ settings, updateSetting, dataPageTitle }: SettingsFormProps) => {
  const [formSettings, setFormSettings] = React.useState({
    tagsListString: settings.tagsListString,
    dataPageTitle: settings.dataPageTitle,
    dailyLimit: settings.dailyLimit,
    forgotReinsertOffset: settings.forgotReinsertOffset,
    readReinsertOffset: settings.readReinsertOffset,
    showModeBorders: settings.showModeBorders,
    rtlEnabled: settings.rtlEnabled,
    shuffleCards: settings.shuffleCards,
  });

  React.useEffect(() => {
    setFormSettings({
      tagsListString: settings.tagsListString,
      dataPageTitle: settings.dataPageTitle,
      dailyLimit: settings.dailyLimit,
      forgotReinsertOffset: settings.forgotReinsertOffset,
      readReinsertOffset: settings.readReinsertOffset,
      showModeBorders: settings.showModeBorders,
      rtlEnabled: settings.rtlEnabled,
      shuffleCards: settings.shuffleCards,
    });
  }, [
    settings.tagsListString,
    settings.dataPageTitle,
    settings.dailyLimit,
    settings.forgotReinsertOffset,
    settings.readReinsertOffset,
    settings.showModeBorders,
    settings.rtlEnabled,
    settings.shuffleCards,
  ]);

  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <h5 style={{ margin: '0 0 10px 0' }}>Tag Pages (Decks)</h5>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
          Separate multiple decks with commas. Example: &quot;memo, sr, 🐘, french exam&quot;
        </p>
        <input
          type="text"
          className="bp3-input"
          value={formSettings.tagsListString}
          onChange={(e) => {
            const value = e.target.value;
            setFormSettings((prev) => ({ ...prev, tagsListString: value }));
            updateSetting('tagsListString', value);
          }}
          placeholder="memo"
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h5 style={{ margin: '0 0 10px 0' }}>Data Page Title</h5>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
          Name of page where we&apos;ll store all your data
        </p>
        <input
          type="text"
          className="bp3-input"
          value={formSettings.dataPageTitle}
          onChange={(e) => {
            const value = e.target.value;
            setFormSettings((prev) => ({ ...prev, dataPageTitle: value }));
            updateSetting('dataPageTitle', value);
          }}
          placeholder="roam/memo"
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h5 style={{ margin: '0 0 10px 0' }}>Daily Review Limit</h5>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
          Number of cards to review each day. 0 means no limit.
        </p>
        <input
          type="number"
          className="bp3-input"
          value={formSettings.dailyLimit}
          onChange={(e) => {
            const value = Number(e.target.value);
            setFormSettings((prev) => ({ ...prev, dailyLimit: value }));
            updateSetting('dailyLimit', value);
          }}
          placeholder="0"
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h5 style={{ margin: '0 0 10px 0' }}>
          Reinsert &quot;Forgot&quot; Cards After N Cards
        </h5>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
          When you mark a card as &quot;Forgot&quot;, it will be reinserted into the current
          review session N cards later. Set to 0 to disable.
        </p>
        <input
          type="number"
          className="bp3-input"
          value={formSettings.forgotReinsertOffset}
          onChange={(e) => {
            const value = Number(e.target.value);
            setFormSettings((prev) => ({ ...prev, forgotReinsertOffset: value }));
            updateSetting('forgotReinsertOffset', value);
          }}
          placeholder="3"
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h5 style={{ margin: '0 0 10px 0' }}>
          Reinsert &quot;Incremental Read&quot; Cards After N Cards
        </h5>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
          When you click &quot;Next&quot; on an Incremental Read card, it will be reinserted
          into the current review session N cards later. Set to 0 to disable.
        </p>
        <input
          type="number"
          className="bp3-input"
          value={formSettings.readReinsertOffset}
          onChange={(e) => {
            const value = Number(e.target.value);
            setFormSettings((prev) => ({ ...prev, readReinsertOffset: value }));
            updateSetting('readReinsertOffset', value);
          }}
          placeholder="3"
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            className="bp3-checkbox"
            checked={formSettings.showModeBorders}
            onChange={(e) => {
              const value = e.target.checked;
              setFormSettings((prev) => ({ ...prev, showModeBorders: value }));
              updateSetting('showModeBorders', value);
            }}
            style={{ marginRight: '8px' }}
          />
          <span>Show Review Mode Borders</span>
        </label>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
          Show the green/orange dialog border that marks the current card&apos;s review mode.
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            className="bp3-checkbox"
            checked={formSettings.rtlEnabled}
            onChange={(e) => {
              const value = e.target.checked;
              setFormSettings((prev) => ({ ...prev, rtlEnabled: value }));
              updateSetting('rtlEnabled', value);
            }}
            style={{ marginRight: '8px' }}
          />
          <span>Right-to-Left (RTL) Enabled</span>
        </label>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
          Enable RTL for languages like Arabic, Hebrew, etc.
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            className="bp3-checkbox"
            checked={formSettings.shuffleCards}
            onChange={(e) => {
              const value = e.target.checked;
              setFormSettings((prev) => ({ ...prev, shuffleCards: value }));
              updateSetting('shuffleCards', value);
            }}
            style={{ marginRight: '8px' }}
          />
          <span>Shuffle Cards</span>
        </label>
        <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
          OFF: Due cards sorted by urgency (most overdue → hardest → least mature). New cards in
          reverse creation order. ON: All cards randomly shuffled.
        </p>
      </div>
    </>
  );
};

export default SettingsForm;
