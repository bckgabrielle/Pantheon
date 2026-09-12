# Tab Snapshot extension

`npm run build` creates the unpacked extension in `dist/`.

## Test in Chrome

1. Open `chrome://extensions`, enable Developer mode, then choose **Load unpacked** and select `dist`.
2. Open the extension's **service worker** inspection link. It should log `Tab Snapshot service worker installed` after installation and `Tab snapshot` after a capture.
3. Click the extension icon and choose **Capture now**. Inspect `chrome.storage.local` to verify `latestSnapshot` has schema version 1 and the exact `TabSnapshot` fields.

## Integration contract

The versioned shared schema and proposed-action shape are in `src/lib/schema.ts`; promote that file into a shared package before backend/agent integration. Executable browser actions are exported from `src/background/actions.ts`: `closeTab(tab_id)`, `groupTabs(tab_ids, group_name)`, and `bookmarkTab(tab_id, folder)`.

Remote tabs require another Chrome device signed into the same account with tab sync enabled. Validate remote device names and timestamps in a real-device test. Before deploying a real backend, set `backendEndpoint` and optional `apiKey` in `chrome.storage.local`; failures are retained in `pendingSnapshots` and retried on the next capture/alarm. No remote request is made until an endpoint is configured.
