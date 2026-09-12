export async function closeTab(tab_id: number): Promise<void> {
  const tab = await chrome.tabs.get(tab_id).catch(() => undefined);
  if (!tab) throw new Error(`Tab ${tab_id} no longer exists`);
  await chrome.tabs.remove(tab_id);
}

export async function groupTabs(tab_ids: number[], group_name: string): Promise<number> {
  if (!tab_ids.length) throw new Error("At least one tab is required");
  const tabs = await Promise.all(tab_ids.map((id) => chrome.tabs.get(id).catch(() => undefined)));
  const existingIds = tabs.flatMap((tab) => (tab?.id === undefined ? [] : [tab.id]));
  if (!existingIds.length) throw new Error("None of the requested tabs still exist");
  const groupId = await new Promise<number>((resolve, reject) => {
    chrome.tabs.group({ tabIds: [existingIds[0]!, ...existingIds.slice(1)] }, (id) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(id);
    });
  });
  await chrome.tabGroups.update(groupId, { title: group_name, color: "blue" });
  return groupId;
}

export async function bookmarkTab(tab_id: number, folder?: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const tab = await chrome.tabs.get(tab_id).catch(() => undefined);
  if (!tab?.url) throw new Error(`Tab ${tab_id} no longer exists or cannot be bookmarked`);
  const tree = await chrome.bookmarks.getTree();
  const existingFolder = folder ? tree[0]?.children?.find((node) => node.title === folder) : undefined;
  const parentId = folder ? (existingFolder?.id ?? (await chrome.bookmarks.create({ parentId: "1", title: folder })).id) : "1";
  return chrome.bookmarks.create({ parentId, title: tab.title, url: tab.url });
}

/** Bookmarks the tab and excludes it from prompts until a caller explicitly un-snoozes it. */
export async function remindLater(tab_id: number, folder = "Snoozed Tabs"): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const bookmark = await bookmarkTab(tab_id, folder);
  const values = await chrome.storage.local.get("tabState");
  const tabState = (values.tabState ?? {}) as Record<string, { snoozed?: boolean; snoozed_at?: number }>;
  tabState[String(tab_id)] = { ...tabState[String(tab_id)], snoozed: true, snoozed_at: Date.now() };
  await chrome.storage.local.set({ tabState });
  return bookmark;
}
