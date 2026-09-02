# Changelog

## 0.1.0

### New Features

- Search for movies and TV shows by title, with an optional release-year filter.
- See the plot, IMDb rating, poster, and trailer together on one details page.
- Check whether a title is included with a subscription or available to rent or buy on popular streaming services.
- Browse the other movies in a collection when a title belongs to a series.
- Quickly return to recently viewed titles using history stored on the current device.

### Improvements

- Repeated searches and reopened movie details load faster while making fewer requests to external services.
- The application remains responsive during busier periods and reports temporary overload instead of waiting indefinitely.
- Search input is checked more carefully, reducing failed requests and producing more predictable results.
- Viewing history has a safe size limit and accepts only valid entries, preventing it from slowing down the browser.
- Additional browser protections reduce the risk of loading unsafe content.
- Installation and deployment use consistent dependency versions, reducing unexpected differences between environments.
- The production image contains only the files required to run WITMO, making downloads and deployments smaller.

### Bug Fixes

- YouTube trailers can play inside WITMO again instead of showing player error 153.
- Viewing history is no longer replaced with an empty list when the application starts.
- Corrupted or manually modified history data no longer causes problems when opening the page.
- Production builds no longer depend on downloading Google Fonts, allowing builds to complete when that service is unavailable.
- Invalid titles, years, and movie identifiers are rejected before a request is sent to external services.
