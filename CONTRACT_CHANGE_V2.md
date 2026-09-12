# Required integration notice: TabSnapshot schema v2 (breaking)

Send this notice to backend engineer #2 and agent engineer #3 before merging. `schema_version` is now `2`; consumers must accept the new optional fields `has_form`, `form_check_status`, `snoozed`, and `snoozed_at`.

The extension owns deterministic, local staleness and form detection. The agent should focus on topic clustering and nuanced close recommendations. The snapshot POST payload already includes these fields. New browser executor: `remindLater(tab_id, folder?)`; it bookmarks the tab and leaves it open, then permanently suppresses stale prompts until an explicit future un-snooze action is added.
