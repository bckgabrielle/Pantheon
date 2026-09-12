"""
Tool schema contract for the Tab Agent.

This is the published contract other roles build against:
- #1 (Extension/Capture) must implement executors matching the *action* tools
  (close_tab, group_tabs, bookmark_tab) with these exact param shapes.
- #2 (Backend/Storage) must implement read endpoints matching the *read* tools
  (list_tabs, search_tabs) with these exact return shapes.

Two categories of tool, handled differently by the reasoning loop:

READ tools  -> resolved live during the loop by calling the backend API.
               The model gets real data back and keeps reasoning.
ACTION tools -> NEVER executed during the loop. Calling one just records a
               proposed action. The loop returns a synthetic ack so the model
               can keep planning, and the real action goes into the final
               Plan for the confirmation UI (#4) to show the user.
"""

READ_TOOL_NAMES = {"list_tabs", "search_tabs"}
ACTION_TOOL_NAMES = {"close_tab", "group_tabs", "bookmark_tab"}

# --- Shared tab object shape (for reference in docstrings / contract docs) ---
# {
#   "tab_id": str,
#   "title": str,
#   "url": str,
#   "favicon": str | null,
#   "window_id": str,
#   "active": bool,
#   "last_accessed": iso8601 str,
#   "device_id": str,
#   "device_name": str,
#   "days_open": number,       # computed server-side by #2
#   "is_duplicate": bool       # computed server-side by #2
# }

TOOL_SCHEMAS = [
    {
        "name": "list_tabs",
        "description": (
            "Get the latest known snapshot of ALL open tabs across all devices "
            "(local + synced remote). Each tab includes server-computed "
            "days_open and is_duplicate flags. Use this first to see the full "
            "picture before proposing anything."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "search_tabs",
        "description": (
            "Search currently known tabs by keyword against title and URL. "
            "Matching is deterministic string matching, not semantic — use "
            "list_tabs and reason over the results yourself for topic "
            "clustering."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Keyword or phrase to match against tab title/url.",
                }
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "close_tab",
        "description": (
            "PROPOSE closing a single tab. This does NOT close anything "
            "immediately — it queues a proposed action that the user must "
            "explicitly confirm in the extension UI. Only propose closing "
            "tabs that are clearly stale and/or duplicate; explain why in "
            "your final summary."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tab_id": {"type": "string"},
                "reason": {
                    "type": "string",
                    "description": "Short human-readable reason this tab is a close candidate.",
                },
            },
            "required": ["tab_id", "reason"],
            "additionalProperties": False,
        },
    },
    {
        "name": "group_tabs",
        "description": (
            "PROPOSE grouping a set of tabs under a named tab group. Does not "
            "execute immediately — queued for user confirmation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tab_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 2,
                },
                "group_name": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["tab_ids", "group_name", "reason"],
            "additionalProperties": False,
        },
    },
    {
        "name": "bookmark_tab",
        "description": (
            "PROPOSE bookmarking a single tab into a folder. Does not execute "
            "immediately — queued for user confirmation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tab_id": {"type": "string"},
                "folder": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["tab_id", "folder", "reason"],
            "additionalProperties": False,
        },
    },
]
