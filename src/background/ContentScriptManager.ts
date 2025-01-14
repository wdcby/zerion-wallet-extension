import browser from 'webextension-polyfill';
import { createNanoEvents } from 'nanoevents';
import { produce } from 'immer';
import { isTruthy } from 'is-truthy-ts';
import type { GlobalPreferences } from './Wallet/GlobalPreferences';

function difference<T>(a: T[], b: T[]) {
  const set = new Set(b);
  return a.filter((value) => !set.has(value));
}

function setActiveIcon() {
  if (process.env.NODE_ENV === 'development') {
    browser.action.setIcon({
      path: new URL(
        `../images/logo-icon-dev-128.png`,
        import.meta.url
      ).toString(),
    });
  } else {
    browser.action.setIcon({
      path: {
        16: new URL(`../images/logo-icon-16.png`, import.meta.url).toString(),
        32: new URL(`../images/logo-icon-32.png`, import.meta.url).toString(),
        48: new URL(`../images/logo-icon-48.png`, import.meta.url).toString(),
        128: new URL(`../images/logo-icon-128.png`, import.meta.url).toString(),
      },
    });
  }
  browser.action.setBadgeText({ text: '' });
}

function setPausedIcon() {
  browser.action.setIcon({
    path: {
      16: new URL(
        `../images/logo-icon-16-disabled.png`,
        import.meta.url
      ).toString(),
      32: new URL(
        `../images/logo-icon-32-disabled.png`,
        import.meta.url
      ).toString(),
      48: new URL(
        `../images/logo-icon-48-disabled.png`,
        import.meta.url
      ).toString(),
      128: new URL(
        `../images/logo-icon-128-disabled.png`,
        import.meta.url
      ).toString(),
    },
  });
  browser.action.setBadgeText({ text: '!' });
  browser.action.setBadgeBackgroundColor({ color: '#FF9D1C' });
}

export class ContentScriptManager {
  private globalPreferences: GlobalPreferences;
  private providerInjection: GlobalPreferences['state']['providerInjection'];
  static ALARM_NAME = 'provider-injection';
  static emitter = createNanoEvents<{ alarm: () => void }>();

  static handleAlarm(alarm: browser.Alarms.Alarm) {
    if (alarm.name === ContentScriptManager.ALARM_NAME) {
      ContentScriptManager.emitter.emit('alarm');
    }
  }

  constructor(globalPreferences: GlobalPreferences) {
    this.globalPreferences = globalPreferences;
    ContentScriptManager.emitter.on('alarm', () => {
      this.removeExpiredRecords();
    });
  }

  removeExpiredRecords() {
    const now = Date.now();
    this.globalPreferences.setState((state) =>
      produce(state, (draft) => {
        if (draft.providerInjection) {
          for (const key in draft.providerInjection) {
            const value = draft.providerInjection[key];
            if (value && value.expires != null && value.expires <= now) {
              delete draft.providerInjection[key];
            }
          }
          if (Object.keys(draft.providerInjection).length === 0) {
            delete draft.providerInjection;
          }
        }
      })
    );
    return this;
  }

  private setActionIcon(_: unknown, __: unknown, tab: browser.Tabs.Tab | null) {
    const matches = this.getMatches();
    const excludeMatches = this.getExcludeMatches();
    const origin = tab?.url ? new URL(tab.url).origin : null;

    if (
      !matches ||
      (origin && excludeMatches?.some((item) => item.includes(origin)))
    ) {
      setPausedIcon();
    } else {
      setActiveIcon();
    }
  }

  private async updateActionIcon() {
    browser.tabs.onUpdated.addListener(this.setActionIcon.bind(this));
    browser.tabs.onActivated.addListener(async ({ tabId }) => {
      const tab = await browser.tabs.get(tabId);
      this.setActionIcon(null, null, tab);
    });
    browser.windows.onFocusChanged.addListener(async (windowId) => {
      const tabs = await browser.tabs.query({ active: true, windowId });
      tabs?.forEach((tab) => {
        if (tab.active) {
          this.setActionIcon(null, null, tab);
        }
      });
    });

    const tabs = await browser.tabs.query({ active: true });
    tabs?.forEach((tab) => {
      if (tab.active) {
        this.setActionIcon(null, null, tab);
      }
    });
  }

  activate() {
    // TODO: may be call this.removeExpiredRecords() here instead of outside
    this.handleChange();
    this.globalPreferences.on('change', this.handleChange.bind(this));
    this.globalPreferences.on('change', this.setAndDiscardAlarms.bind(this));
    this.updateActionIcon();
  }

  async setAndDiscardAlarms() {
    const allAlarms = await browser.alarms.getAll();
    const scheduled = allAlarms
      .filter(({ name }) => name === ContentScriptManager.ALARM_NAME)
      .map((alarm) => alarm.scheduledTime);
    const requiredAlarms = Object.values(this.providerInjection || {})
      .filter(isTruthy)
      .map((value) => value.expires)
      .filter((value: number | null): value is number => Boolean(value))
      .sort((a, b) => a - b);
    const toSet = difference(requiredAlarms, scheduled);
    const toDiscard = difference(scheduled, requiredAlarms);

    if (toDiscard.length) {
      // there can actually be only one alarm for each name
      await browser.alarms.clear(ContentScriptManager.ALARM_NAME);
    }
    if (toSet.length) {
      // there can actually be only one alarm for each name
      browser.alarms.create(ContentScriptManager.ALARM_NAME, {
        when: toSet[0],
      });
    }
  }

  async handleChange() {
    const { providerInjection } = await this.globalPreferences.getPreferences();
    if (providerInjection !== this.providerInjection) {
      this.providerInjection = providerInjection;
      this.update();
    }
  }

  async update() {
    const inPageScriptLocation =
      browser.runtime.getManifest().web_accessible_resources?.[0];
    if (!inPageScriptLocation || typeof inPageScriptLocation === 'string') {
      throw new Error('Missing manifest field: web_accessible_resources');
    }

    try {
      await chrome.scripting.unregisterContentScripts({
        ids: ['zerion-extension-content-script'],
      });
    } catch (e) {
      console.warn('Could not unregister content script'); // eslint-disable-line no-console
    }

    const matches = this.getMatches();
    const excludeMatches = this.getExcludeMatches();
    if (!matches) {
      return; // do not registerContentScripts at all
    }
    // Register script with "world: 'MAIN'" environment so that it can write to page window
    // See: https://developer.chrome.com/docs/extensions/mv3/content_scripts/#isolated_world
    await chrome.scripting.registerContentScripts([
      {
        id: 'zerion-extension-content-script',
        js: inPageScriptLocation.resources,
        excludeMatches,
        matches,
        world: 'MAIN',
        runAt: 'document_start',
      },
    ]);
    // TODO: update active tab here? But only if it is related to the changes?
    // If we are updating injected scripts because of an alarm going off, it maybe
    // unrelated to the currently active tab. Would be bad UX to update it in this case.
  }

  getMatches() {
    const allUrls = this.providerInjection?.['<all_urls>'];
    if (!allUrls) {
      return ['<all_urls>'];
    }
    const NOTHING_MATCHES = undefined;
    if (allUrls.expires == null) {
      return NOTHING_MATCHES;
    } else if (allUrls.expires > Date.now()) {
      return NOTHING_MATCHES;
    } else {
      return ['<all_urls'];
    }
  }

  getExcludeMatches() {
    if (!this.providerInjection) {
      return undefined;
    }
    const excludeMatches: string[] = [];
    Object.keys(this.providerInjection)
      .filter((key) => key !== '<all_urls>')
      .forEach((key) => {
        const value = this.providerInjection?.[key];
        if (!value) {
          return;
        }
        if (value.expires != null && value.expires < Date.now()) {
          return;
        }
        const url = new URL(key);
        url.pathname = '/*';
        excludeMatches.push(url.href);
      });
    return excludeMatches;
  }
}
