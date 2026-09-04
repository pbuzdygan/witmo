# Changelog

## 0.1.1

### New Features

- Choose whether to search everywhere, only movies, or only TV series.
- WITMO now includes an install-ready app description and icon for supported browsers.

### Improvements

- The movie page now brings streaming availability, the poster, rating, plot, and trailer closer together with less scrolling.
- Search is more compact, offers a quick `/` shortcut, and gives clearer feedback while it is working.
- Long plots can be expanded whenever you want to read the complete description.
- WITMO has a new logo, a complete set of app icons, and a quieter tagline.

### Bug Fixes

- Year and type filters now keep all search results consistent with the selected options.
- Relevant titles no longer disappear just because they were outside the first few matches from a movie provider.
- Typing into search fields on mobile no longer enlarges the page.
- Streaming availability remains easy to read on narrow screens without pushing the trailer too far down.
- Streaming help now closes when you click elsewhere and uses colored dots instead of describing their colors in text.
- The header information panel now stays fully visible on narrow mobile screens.

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
