# Rebar Session Context

## Purpose

This document tracks current architecture state and active risk areas for contributor handoff.

## Current Implementation Snapshot

- Capture paths: web/manual, batch ingest, share endpoint, extension clipping, Telegram bot, CSV/OCR import
- Review loop: daily review with interval doubling, undo, history, daily/weekly digest (email/telegram/webhook)
- Library: filtering, cursor pagination, bulk operations, tag management, export (markdown/obsidian/json/csv/logseq)
- Search: full-text with tsvector, semantic search toggle
- Record detail: markdown content, annotations, note history, tag management
- MCP: read-only tools (search, get, today)
- Extension: Manifest v3, quick tag picker, reader heuristics (Kindle/Ridi/Millie)
- Auth: Bearer token (web) + API key (external) + cookie session (extension)

## Completed Work Summary

22 rounds of implementation covering:
- Security hardening (CORS, auth bypass, DNS guards, input limits, origin validation, TOCTOU protection)
- Component decomposition (capture, library, review, record detail, navigation — all split into sub-components)
- Test coverage expansion (269 tests: unit, API integration, property-based, UI smoke/interaction, proxy/origin)
- Performance optimization (lazy loading, React.memo, useCallback, explicit column selects, query cache tuning)
- Import/export pipeline (Readwise CSV, Telegram bot, webhook export, incremental export, Logseq format)
- Notification system (email/telegram/webhook fan-out for daily review and weekly digest)
- Accessibility (pa11y-ci pipeline, WCAG2AA compliance, keyboard navigation)

## Active Risk Watchlist

- Keep semantic search path aligned with actual DB capabilities
- Ensure cron schedules and endpoint protections stay synchronized
- Monitor extension service worker lifecycle edge cases
- Maintain strict ownership checks on all bulk and mutation APIs
- Watch for drift between runtime DB state and `db/schema.sql` after future migrations

## Handoff Checklist

- Verify auth assumptions before touching capture/review routes
- Re-check state transition constraints for any record mutation changes
- Confirm RLS and ownership validation on every new query path
- Run tests/build after API or extension flow changes
