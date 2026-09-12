interface TabView { tab_id: string; title: string; url: string; has_form?: boolean; }
const captureButton = document.querySelector<HTMLButtonElement>("#capture")!;
const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const staleEl = document.querySelector<HTMLDivElement>("#stale")!;
const formsEl = document.querySelector<HTMLDivElement>("#forms")!;

async function request(message: unknown): Promise<any> { return chrome.runtime.sendMessage(message); }
function render(target: HTMLElement, tabs: TabView[], actions: boolean) {
  target.replaceChildren();
  if (!tabs.length) { target.innerHTML = '<div class="empty">Nothing to show</div>'; return; }
  for (const tab of tabs) {
    const row = document.createElement("div"); row.className = "row";
    const title = document.createElement("div"); title.className = "title"; title.textContent = tab.title || "Untitled tab";
    const url = document.createElement("div"); url.className = "url"; url.textContent = tab.url;
    row.append(title, url);
    if (actions) {
      const actionRow = document.createElement("div"); actionRow.className = "actions";
      for (const [label, type] of [["Remind me later", "remindLater"], ["Close", "close"]] as const) {
        const button = document.createElement("button"); button.textContent = label;
        button.addEventListener("click", async () => { button.disabled = true; const result = await request({ type, tab_id: Number(tab.tab_id) }); statusEl.textContent = result.ok ? `${label} complete` : `Error: ${result.error}`; await refresh(); });
        actionRow.append(button);
      }
      row.append(actionRow);
    }
    target.append(row);
  }
}
async function refresh() {
  statusEl.textContent = "Checking local tabs and forms…";
  const result = await request({ type: "popupTabs" });
  if (!result.ok) { statusEl.textContent = `Error: ${result.error}`; return; }
  render(staleEl, result.staleTabs, true); render(formsEl, result.formTabs, true);
  statusEl.textContent = "Form checks run only while this popup is open.";
}
captureButton.addEventListener("click", async () => { captureButton.disabled = true; statusEl.textContent = "Capturing…"; const result = await request({ type: "capture" }); statusEl.textContent = result.ok ? "Snapshot captured" : `Error: ${result.error}`; captureButton.disabled = false; await refresh(); });
void refresh();
