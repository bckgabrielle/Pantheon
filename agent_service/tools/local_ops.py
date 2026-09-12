"""
Deterministic, non-LLM tab operations. Keeping these out of the model's
hands keeps them cheap and predictable, per the project's design principle
of not making the LLM do work that plain code does better.
"""
from __future__ import annotations


def search_tabs(tabs: list[dict], query: str) -> list[dict]:
    q = query.strip().lower()
    if not q:
        return []
    out = []
    for tab in tabs:
        title = (tab.get("title") or "").lower()
        url = (tab.get("url") or "").lower()
        if q in title or q in url:
            out.append(tab)
    return out
