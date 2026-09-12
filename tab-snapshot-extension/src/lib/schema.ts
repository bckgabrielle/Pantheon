/** Versioned, shared contract. Publish this file as a package before integrating other services. */
/** Breaking change: v2 adds form-check and snooze state. Notify backend and agent consumers before merging. */
export const TAB_SNAPSHOT_SCHEMA_VERSION = 2 as const;

export interface TabSnapshot {
  /** A Chrome tab id locally, or a sessions API id for a synced tab. */
  tab_id: string;
  title: string;
  url: string;
  favicon: string | null;
  window_id: string;
  active: boolean;
  last_accessed: number | null;
  device_id: string;
  device_name: string;
  has_form?: boolean;
  form_check_status?: "unchecked" | "checked" | "error";
  snoozed?: boolean;
  snoozed_at?: number;
}

export interface SnapshotEnvelope {
  schema_version: typeof TAB_SNAPSHOT_SCHEMA_VERSION;
  captured_at: number;
  tabs: TabSnapshot[];
}

export interface ProposedAction {
  type: "close" | "group" | "bookmark" | "remindLater";
  tab_ids: number[];
  group_name?: string;
  folder?: string;
}

export type TabLocalState = Pick<TabSnapshot, "has_form" | "form_check_status" | "snoozed" | "snoozed_at">;
