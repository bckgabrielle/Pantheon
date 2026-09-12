import { bookmarkTab, closeTab, groupTabs, remindLater } from "./actions";
import { TAB_SNAPSHOT_SCHEMA_VERSION, type SnapshotEnvelope, type TabLocalState, type TabSnapshot } from "../lib/schema";

const DEVICE_ID = "local-chrome";
const DEVICE_NAME = "This Chrome";
const ALARM_NAME = "tabSnapshot";
const tabActivity = new Map<number, number>();

async function recordActivity(tabId: number): Promise<void> {
  const at = Date.now();
  tabActivity.set(tabId, at);
  const values = await chrome.storage.local.get("tabActivity");
  const stored = (values.tabActivity ?? {}) as Record<string, number>;
  await chrome.storage.local.set({ tabActivity: { ...stored, [tabId]: at } });
}

async function forgetActivity(tabId: number): Promise<void> {
  tabActivity.delete(tabId);
  const values = await chrome.storage.local.get("tabActivity");
  const stored = (values.tabActivity ?? {}) as Record<string, number>;
  delete stored[String(tabId)];
  await chrome.storage.local.set({ tabActivity: stored });
}

function localTab(tab: chrome.tabs.Tab, state: TabLocalState): TabSnapshot | undefined {
  if (tab.id === undefined || !tab.url) return undefined;
  return {
    tab_id: String(tab.id), title: tab.title ?? "", url: tab.url, favicon: tab.favIconUrl ?? null,
    window_id: String(tab.windowId), active: tab.active, last_accessed: tabActivity.get(tab.id) ?? tab.lastAccessed ?? null,
    device_id: DEVICE_ID, device_name: DEVICE_NAME, ...state,
  };
}

export async function getLocalTabs(): Promise<TabSnapshot[]> {
  const values = await chrome.storage.local.get(["tabActivity", "tabState"]);
  const stored = (values.tabActivity ?? {}) as Record<string, number>;
  const tabState = (values.tabState ?? {}) as Record<string, TabLocalState>;
  return (await chrome.tabs.query({})).flatMap((tab) => {
    if (tab.id !== undefined && stored[String(tab.id)] !== undefined) tabActivity.set(tab.id, stored[String(tab.id)]);
    const snapshot = localTab(tab, tab.id === undefined ? {} : (tabState[String(tab.id)] ?? { form_check_status: "unchecked" }));
    return snapshot ? [snapshot] : [];
  });
}

/** Popup-only form check. Never call this from alarms or snapshot capture. */
export async function checkForForms(tabId: number): Promise<TabLocalState> {
  let state: TabLocalState;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.querySelectorAll("form").length > 0,
    });
    state = { has_form: Boolean(results[0]?.result), form_check_status: "checked" };
  } catch {
    // Includes closed tabs and injection-restricted pages such as chrome:// URLs.
    state = { form_check_status: "error" };
  }
  const values = await chrome.storage.local.get("tabState");
  const tabState = (values.tabState ?? {}) as Record<string, TabLocalState>;
  tabState[String(tabId)] = { ...tabState[String(tabId)], ...state };
  await chrome.storage.local.set({ tabState });
  return tabState[String(tabId)]!;
}

export function getStaleTabs(tabs: TabSnapshot[], thresholdMs: number, now = Date.now()): TabSnapshot[] {
  return tabs.filter((tab) => !tab.snoozed && tab.last_accessed !== null && now - tab.last_accessed >= thresholdMs);
}

async function popupTabs(): Promise<{ staleTabs: TabSnapshot[]; formTabs: TabSnapshot[] }> {
  const localTabs = await getLocalTabs();
  await Promise.all(localTabs.map((tab) => checkForForms(Number(tab.tab_id))));
  const checkedTabs = await getLocalTabs();
  return {
    staleTabs: getStaleTabs(checkedTabs, 7 * 24 * 60 * 60 * 1000),
    formTabs: checkedTabs.filter((tab) => tab.has_form && !tab.snoozed),
  };
}

export async function getRemoteTabs(): Promise<TabSnapshot[]> {
  const devices = await chrome.sessions.getDevices();
  return devices.flatMap((device) => (device.sessions ?? []).flatMap((session) =>
    (session.tab ? [session.tab] : []).flatMap((tab) => tab.url ? [{
      tab_id: tab.sessionId ?? `${device.deviceName}:${tab.url}`,
      title: tab.title ?? "", url: tab.url, favicon: tab.favIconUrl ?? null,
      window_id: session.window?.sessionId ?? session.tab?.sessionId ?? "unknown-window", active: false, last_accessed: session.lastModified * 1000,
      device_id: device.deviceName, device_name: device.deviceName,
    }] : [])));
}

export async function captureSnapshot(): Promise<SnapshotEnvelope> {
  const snapshot: SnapshotEnvelope = { schema_version: TAB_SNAPSHOT_SCHEMA_VERSION, captured_at: Date.now(), tabs: [...await getLocalTabs(), ...await getRemoteTabs()] };
  await chrome.storage.local.set({ latestSnapshot: snapshot, lastSyncedAt: snapshot.captured_at });
  console.log("Tab snapshot", snapshot);
  return snapshot;
}

async function sendSnapshot(): Promise<SnapshotEnvelope> {
  const snapshot = await captureSnapshot();
  const settings = await chrome.storage.local.get(["backendEndpoint", "apiKey", "pendingSnapshots"]);
  const backendEndpoint = settings.backendEndpoint as string | undefined;
  const apiKey = settings.apiKey as string | undefined;
  const pendingSnapshots = (settings.pendingSnapshots ?? []) as SnapshotEnvelope[];
  // With no configured endpoint this is intentionally a local successful stub.
  if (!backendEndpoint) {
    await chrome.storage.local.set({ lastSendResult: { ok: true, stub: true, at: Date.now(), tabCount: snapshot.tabs.length } });
    return snapshot;
  }
  const queue = [...pendingSnapshots, snapshot];
  try {
    for (const item of queue) {
      const response = await fetch(backendEndpoint, { method: "POST", headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify(item) });
      if (!response.ok) throw new Error(`Snapshot POST failed (${response.status})`);
    }
    await chrome.storage.local.set({ pendingSnapshots: [], lastSendResult: { ok: true, at: Date.now(), tabCount: snapshot.tabs.length } });
  } catch (error) {
    await chrome.storage.local.set({ pendingSnapshots: queue, lastSendResult: { ok: false, at: Date.now(), error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
  return snapshot;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
  console.log("Tab Snapshot service worker installed");
});
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM_NAME) void sendSnapshot(); });
// The toolbar popup's Capture now button is the explicit immediate-capture trigger.
chrome.tabs.onCreated.addListener((tab) => { if (tab.id !== undefined) void recordActivity(tab.id); });
chrome.tabs.onRemoved.addListener((tabId) => { void forgetActivity(tabId); });
chrome.tabs.onUpdated.addListener((tabId, change) => { if (change.status === "complete" || change.url) void recordActivity(tabId); });
chrome.tabs.onActivated.addListener(({ tabId }) => { void recordActivity(tabId); });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === "capture") sendResponse({ ok: true, snapshot: await sendSnapshot() });
      else if (message.type === "status") sendResponse({ ok: true, ...(await chrome.storage.local.get(["lastSyncedAt", "lastSendResult"])) });
      else if (message.type === "close") sendResponse({ ok: true, result: await closeTab(message.tab_id) });
      else if (message.type === "group") sendResponse({ ok: true, groupId: await groupTabs(message.tab_ids, message.group_name) });
      else if (message.type === "bookmark") sendResponse({ ok: true, bookmark: await bookmarkTab(message.tab_id, message.folder) });
      else if (message.type === "remindLater") sendResponse({ ok: true, bookmark: await remindLater(message.tab_id, message.folder) });
      else if (message.type === "popupTabs") sendResponse({ ok: true, ...(await popupTabs()) });
      else throw new Error("Unknown message type");
    } catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  })();
  return true;
});
