# WITMO Roadmap

This roadmap captures possible directions rather than committed release dates.

## Before the first public release

- Complete the deferred secret-management cleanup and verify the repository with the secret-scanning workflow.
- Add browser-level tests for search, movie details, collections, and viewing history.
- Review accessibility, keyboard navigation, mobile layouts, and loading states.

## Product ideas

- Add a watchlist and favorites.
- Let users optionally create an account and synchronize viewing history between devices.
- Support additional languages, regions, and streaming providers.
- Explore recommendations and comparisons between related titles.

## Operational improvements

- Add production monitoring for provider failures, response times, and rate-limit events.
- Move caching and request limits to shared infrastructure if WITMO is scaled to multiple application instances.
- Add contract tests that detect breaking changes in OMDb and TMDb responses.
