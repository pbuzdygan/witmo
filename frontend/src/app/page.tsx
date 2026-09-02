'use client';

/* eslint-disable @next/next/no-img-element -- Poster URLs are dynamic provider assets in a static export. */

import { FormEvent, useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { fetchMovieById, searchMovies } from '@/lib/api';
import { parseMovieHistory, serializeMovieHistory } from '@/lib/history';
import type {
  MovieDetails,
  MovieHistoryEntry,
  MovieSearchResult,
  WatchAvailabilityStatus,
  WatchProvidersAvailability,
} from '@/types/movie';

const HISTORY_STORAGE_KEY = 'witmo_history_v1';
const HISTORY_LIMIT = 50;
type ProviderKey = Exclude<keyof WatchProvidersAvailability, 'region'>;

const PROVIDER_META: Array<{
  key: ProviderKey;
  label: string;
}> = [
  { key: 'netflix', label: 'Netflix' },
  { key: 'primeVideo', label: 'Prime Video' },
  { key: 'appleTv', label: 'Apple TV' },
  { key: 'disneyPlus', label: 'Disney+' },
  { key: 'hboMax', label: 'HBO Max' },
  { key: 'skyShowtime', label: 'SkyShowtime' },
];

export default function HomePage() {
  const [titleQuery, setTitleQuery] = useState('');
  const [yearQuery, setYearQuery] = useState('');
  const [regularResults, setRegularResults] = useState<MovieSearchResult[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieDetails | null>(null);
  const [history, setHistory] = useState<MovieHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [movieLoadingId, setMovieLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [visibleSearchCount, setVisibleSearchCount] = useState(10);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);
  const [showingCollection, setShowingCollection] = useState(false);
  const [activeCollectionName, setActiveCollectionName] = useState<string | null>(null);
  const [activeCollectionItems, setActiveCollectionItems] = useState<MovieSearchResult[]>([]);
  const infoButtonRef = useRef<HTMLDivElement | null>(null);
  const infoPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        // localStorage is external state and must be synchronized after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHistory(parseMovieHistory(stored));
      }
    } catch {
      // ignore malformed data
    }
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !historyLoaded) {
      return;
    }
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, serializeMovieHistory(history));
    } catch {
      // Storage can be unavailable or full; the in-memory history still works.
    }
  }, [history, historyLoaded]);

  useEffect(() => {
    if (!isInfoOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        infoPopoverRef.current?.contains(target) ||
        infoButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsInfoOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInfoOpen]);

  const activeResults = useMemo(() => {
    if (showingCollection) {
      if (selectedMovie?.collection?.items?.length) {
        return selectedMovie.collection.items;
      }
      if (activeCollectionItems.length) {
        return activeCollectionItems;
      }
      return [];
    }
    return regularResults;
  }, [showingCollection, selectedMovie, activeCollectionItems, regularResults]);
  const displayedSearchResults = useMemo(
    () => activeResults.slice(0, visibleSearchCount),
    [activeResults, visibleSearchCount],
  );

  const displayedHistory = useMemo(
    () => history.slice(0, visibleHistoryCount),
    [history, visibleHistoryCount],
  );

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!titleQuery.trim()) {
      setErrorMessage('Wpisz tytuł filmu.');
      return;
    }

    setErrorMessage(null);
    setSearchLoading(true);
    setSearchPerformed(true);
    setSelectedMovie(null);
    setRegularResults([]);
    setShowingCollection(false);
    setActiveCollectionName(null);
    setActiveCollectionItems([]);
    setVisibleSearchCount(0);

    try {
      const results = await searchMovies(titleQuery.trim(), yearQuery.trim() || undefined);
      setRegularResults([...results]);
      setVisibleSearchCount(Math.min(10, results.length || 0));

      if (results.length === 1) {
        await fetchAndSelectMovie(results[0].imdbId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Coś poszło nie tak.');
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchAndSelectMovie = async (imdbId: string) => {
    if (!imdbId) {
      return;
    }
    setErrorMessage(null);
    setSelectedMovie(null);
    setMovieLoadingId(imdbId);
    try {
      const movie = await fetchMovieById(imdbId);
      setSelectedMovie(movie);
      if (showingCollection) {
        if (movie.collection?.items?.length) {
          setActiveCollectionName(movie.collection.name);
          setActiveCollectionItems(movie.collection.items);
          setVisibleSearchCount(Math.min(10, movie.collection.items.length));
        } else {
          setShowingCollection(false);
          setActiveCollectionName(null);
          setActiveCollectionItems([]);
          setVisibleSearchCount(Math.min(10, regularResults.length || 0));
        }
      }

      setHistory((prev) => {
        const filtered = prev.filter((entry) => entry.imdbId !== movie.imdbId);
        const updated = [
          {
            ...movie,
            lastViewedAt: Date.now(),
          },
          ...filtered,
        ];
        const limited = updated.slice(0, HISTORY_LIMIT);
        setVisibleHistoryCount(Math.min(10, limited.length));
        return limited;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nie można pobrać filmu.');
    } finally {
      setMovieLoadingId(null);
    }
  };

  const handleHistorySelect = (entry: MovieHistoryEntry) => {
    fetchAndSelectMovie(entry.imdbId);
  };

  const clearHistory = () => {
    setHistory([]);
    setVisibleHistoryCount(0);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  };

  const handleToggleCollection = () => {
    if (!selectedMovie?.collection?.items?.length) {
      return;
    }
    if (showingCollection) {
      setShowingCollection(false);
      setActiveCollectionName(null);
      setActiveCollectionItems([]);
      setVisibleSearchCount(Math.min(10, regularResults.length || 0));
    } else {
      const items = selectedMovie.collection.items;
      setShowingCollection(true);
      setActiveCollectionName(selectedMovie.collection.name);
      setActiveCollectionItems(items);
      setVisibleSearchCount(Math.min(10, items.length));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-10 lg:flex-row">
        <main className="flex-1 space-y-6">
          <header className="relative space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">WITMO</p>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-semibold text-slate-50 md:text-5xl">
                  What is the movie about?
                </h1>
                <div className="relative" ref={infoButtonRef}>
                  <button
                    type="button"
                    onClick={() => setIsInfoOpen((prev) => !prev)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-50 transition hover:bg-white/10"
                    aria-label="Informacje o kluczach API"
                  >
                    i
                  </button>
                  {isInfoOpen && <InfoPopover ref={infoPopoverRef} />}
                </div>
              </div>
              <p className="text-slate-400">
                Wyszukaj film, sprawdź ocenę IMDb, odkryj opis fabuły i odtwórz trailer bez
                opuszczania aplikacji.
              </p>
            </div>
          </header>

          <div className="mt-8 flex flex-col gap-6 lg:grid lg:grid-cols-[280px_minmax(0,2.6fr)_280px] lg:items-start lg:gap-6">
            <div className="order-2 lg:order-1">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-900/40 backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-50">
                    {showingCollection
                      ? activeCollectionName ?? 'Kolekcja'
                      : 'Wyniki wyszukiwania'}
                  </h2>
                  <span className="text-sm text-slate-400">{activeResults.length}</span>
                </div>
                {displayedSearchResults.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {displayedSearchResults.map((movie) => (
                      <li key={movie.imdbId}>
                        <button
                          onClick={() => fetchAndSelectMovie(movie.imdbId)}
                          className="flex w-full items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-emerald-400 hover:bg-white/10"
                        >
                          {movie.posterUrl ? (
                            <img
                              src={movie.posterUrl}
                              alt={movie.title}
                              className="h-16 w-11 rounded-lg object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-16 w-11 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">
                              Brak
                            </div>
                          )}
                      <div className="flex-1">
                        <p className="font-medium text-slate-50">{movie.title}</p>
                        <p className="text-sm text-slate-400">{movie.year ?? '—'}</p>
                      </div>
                    </button>
                  </li>
                ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    {searchPerformed
                      ? 'Brak wyników dla podanego zapytania.'
                      : 'Wyniki pojawią się po wyszukaniu tytułu.'}
                  </p>
                )}
                {activeResults.length > visibleSearchCount && (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleSearchCount((prev) =>
                        Math.min(prev + 10, activeResults.length),
                      )
                    }
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-transparent py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-emerald-200"
                  >
                    More results
                  </button>
                )}
              </section>
            </div>

            <div className="order-1 space-y-6 lg:order-2">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/40 backdrop-blur">
                <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-300" htmlFor="title">
                      Tytuł filmu lub serialu
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={titleQuery}
                      onChange={(event) => setTitleQuery(event.target.value)}
                      placeholder="np. Wicked lub Stranger Things"
                      maxLength={120}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-base text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div className="w-full md:w-32">
                    <label className="text-sm font-medium text-slate-300" htmlFor="year">
                      Rok (opcjonalnie)
                    </label>
                    <input
                      id="year"
                      type="text"
                      value={yearQuery}
                      onChange={(event) => setYearQuery(event.target.value)}
                      placeholder="2024"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-base text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="mt-6 inline-flex h-[52px] items-center justify-center rounded-2xl bg-emerald-400 px-6 text-base font-semibold text-emerald-950 transition hover:bg-emerald-300 md:mt-auto md:w-40"
                    disabled={searchLoading}
                  >
                    {searchLoading ? 'Szukam…' : 'Szukaj'}
                  </button>
                </form>
                {errorMessage && <p className="mt-4 text-sm text-red-300">{errorMessage}</p>}
              </section>

              <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-950 p-6">
                {movieLoadingId ? (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                    Ładowanie szczegółów…
                  </div>
                ) : selectedMovie ? (
                  <article className="space-y-6">
                    {selectedMovie.watchProviders && (
                      <StreamingAvailability watch={selectedMovie.watchProviders} />
                    )}
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <div className="flex flex-col gap-6 md:flex-row md:flex-1">
                        {selectedMovie.posterUrl && (
                          <img
                            src={selectedMovie.posterUrl}
                            alt={selectedMovie.title}
                            className="h-72 w-48 rounded-3xl object-cover shadow-2xl shadow-black/60"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="flex-1 space-y-4">
                          <div>
                            <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">
                              IMDb rating
                            </p>
                            <p className="text-5xl font-semibold text-slate-50">
                              {selectedMovie.imdbRating ?? '—'}
                            </p>
                          </div>
                          <div>
                            <h2 className="text-3xl font-semibold text-slate-50">
                              {selectedMovie.title}{' '}
                              {selectedMovie.year && (
                                <span className="text-slate-400">({selectedMovie.year})</span>
                              )}
                            </h2>
                          </div>
                          <p className="text-slate-200">
                            {selectedMovie.plot ?? 'Brak opisu tego tytułu w OMDb.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-2xl font-semibold text-slate-50">Trailer</h3>
                        <div className="flex flex-wrap gap-3">
                          {selectedMovie.collection?.items?.length ? (
                            <button
                              type="button"
                              onClick={handleToggleCollection}
                              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/0 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:border-emerald-300 hover:text-emerald-200"
                            >
                              {showingCollection ? 'Ukryj kolekcję' : 'Pokaż kolekcję'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              typeof window !== 'undefined' &&
                              window.open(
                                selectedMovie.youtubeSearchUrl,
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:bg-white/20"
                          >
                            Wyniki na YouTube
                          </button>
                        </div>
                      </div>
                      {selectedMovie.trailerYoutubeKey ? (
                        <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
                          <iframe
                            title={`Trailer ${selectedMovie.title}`}
                            src={`https://www.youtube-nocookie.com/embed/${selectedMovie.trailerYoutubeKey}?autoplay=1&mute=1`}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="strict-origin-when-cross-origin"
                            sandbox="allow-scripts allow-same-origin allow-presentation"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Nie znaleziono trailera w TMDb. Skorzystaj z przycisku, by wyszukać go na
                          YouTube.
                        </p>
                      )}
                    </div>
                  </article>
                ) : (
                  <div className="text-center text-slate-400">
                    {searchPerformed
                      ? 'Wybierz tytuł z listy, aby zobaczyć szczegóły.'
                      : 'Wprowadź tytuł filmu lub serialu, aby rozpocząć.'}
                  </div>
                )}
              </section>
            </div>

            <aside className="order-3 w-full rounded-3xl border border-white/10 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-50">Ostatnie wyszukiwania</h2>
                {displayedHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-sm text-slate-400 transition hover:text-emerald-300"
                  >
                    Wyczyść
                  </button>
                )}
              </div>

              {displayedHistory.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Brak historii. Wyszukaj film, aby zapamiętać wynik.
                </p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {displayedHistory.map((entry) => (
                    <li key={`${entry.imdbId}-${entry.lastViewedAt}`}>
                      <button
                        onClick={() => handleHistorySelect(entry)}
                        className="flex w-full gap-3 rounded-2xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-emerald-400 hover:bg-white/10"
                      >
                        {entry.posterUrl ? (
                          <img
                            src={entry.posterUrl}
                            alt={entry.title}
                            className="h-20 w-14 rounded-xl object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-20 w-14 items-center justify-center rounded-xl bg-slate-800 text-xs text-slate-500">
                            Brak
                          </div>
                        )}
                        <div className="flex flex-1 flex-col">
                          <p className="font-semibold text-slate-50">{entry.title}</p>
                          <p className="text-sm text-slate-400">{entry.year ?? '—'}</p>
                          {entry.imdbRating && (
                            <p className="text-sm text-emerald-300">IMDb: {entry.imdbRating}</p>
                          )}
                          <p className="text-xs text-slate-500">
                            {new Date(entry.lastViewedAt).toLocaleString()}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {history.length > visibleHistoryCount && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleHistoryCount((prev) =>
                      Math.min(prev + 10, history.length),
                    )
                  }
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-transparent py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-emerald-200"
                >
                  More
                </button>
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

const InfoPopover = forwardRef<HTMLDivElement>((_, ref) => (
  <div
    ref={ref}
    className="absolute right-0 top-12 z-50 w-80 rounded-3xl border border-white/20 bg-slate-900/95 p-5 text-sm text-slate-100 shadow-2xl shadow-black/60 backdrop-blur"
  >
    <div className="pointer-events-none absolute -top-2 right-8 h-4 w-4 rotate-45 border border-white/20 bg-slate-900/95" />
    <div className="space-y-3">
      <p className="font-semibold text-slate-50">Aby WITMO działało, potrzebujesz własnych kluczy API:</p>
      <ul className="space-y-1 text-slate-300">
        <li>
          <a
            href="https://www.omdbapi.com/"
            className="text-emerald-300 underline hover:text-emerald-200"
            target="_blank"
            rel="noreferrer"
          >
            OMDb
          </a>
          – po rejestracji wygeneruj <code className="text-slate-100">api key</code>.
        </li>
        <li>
          <a
            href="https://www.themoviedb.org/"
            className="text-emerald-300 underline hover:text-emerald-200"
            target="_blank"
            rel="noreferrer"
          >
            TMDb
          </a>
          – po rejestracji wygeneruj <code className="text-slate-100">api key</code> oraz{' '}
          <code className="text-slate-100">read access token</code>.
        </li>
      </ul>
      <p className="text-slate-400">
        Wybierz jeden region <code>WATCH_REGION</code> (np. PL lub US), aby wskazać, z jakiej biblioteki
        streamingowej mają pochodzić dane o dostępności.
      </p>
    </div>
  </div>
));
InfoPopover.displayName = 'InfoPopover';

const STATUS_LABELS: Record<Exclude<WatchAvailabilityStatus, null>, string> = {
  included: 'W abonamencie',
  rent: 'Wypożyczenie',
  buy: 'Zakup',
};

function StreamingAvailability({ watch }: { watch: WatchProvidersAvailability }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-md shadow-slate-900/40 backdrop-blur">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
        Streaming ({watch.region})
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PROVIDER_META.map((provider) => (
          <ProviderBadge
            key={provider.key}
            label={provider.label}
            status={watch[provider.key]}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderBadge({
  label,
  status,
}: {
  label: string;
  status: WatchAvailabilityStatus;
}) {
  const isAvailable = Boolean(status);
  const chipClasses = isAvailable
    ? 'border-white/30 bg-white/10 text-slate-50'
    : 'border-white/5 bg-transparent text-slate-400 opacity-40';

  const renderStatusDot = () => {
    if (status === 'included') {
      return <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />;
    }
    if (status === 'rent') {
      return <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden="true" />;
    }
    if (status === 'buy') {
      return <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />;
    }
    return <span className="h-2 w-2 rounded-full bg-slate-600" aria-hidden="true" />;
  };

  return (
    <div
      title={label}
      className={`flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 text-xs ${chipClasses}`}
    >
      {renderStatusDot()}
      <span className="font-semibold text-slate-50">{label}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {status ? STATUS_LABELS[status] : '—'}
      </span>
    </div>
  );
}
