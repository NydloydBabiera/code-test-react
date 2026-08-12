import React, { useEffect, useMemo, useRef, useState } from 'react';
import Spinner from './components/Spinner';
import './App.css';

const API_BASE = 'https://ll.thespacedevs.com/2.3.0/launches/';
const PAGE_LIMIT = 10;
const DEFAULT_SEARCH = 'Starlink';

function App() {
  const [launches, setLaunches] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLaunch, setSelectedLaunch] = useState(null);
  const scrollRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);
  const cacheRef = useRef({});

  const buildUrl = (query, offset = 0) =>
    `${API_BASE}?limit=${PAGE_LIMIT}&offset=${offset}&search=${encodeURIComponent(query)}`;

  const fetchLaunches = async (url, append = false) => {
    try {
      if (append) {
        setFetchingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const cachedPage = cacheRef.current[url];
      if (cachedPage) {
        setLaunches(prev => (append ? [...prev, ...cachedPage.results] : cachedPage.results));
        setNextUrl(cachedPage.nextUrl);
        setError(null);
        setThrottleResetAt(null);
        return;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        const throttleDetail = data?.detail || data?.message || data?.error || '';
        const waitSeconds = retryAfter || data?.expected_available_in || data?.wait || '';
        const throttleMessage = throttleDetail
          ? `${throttleDetail}${waitSeconds ? ` Retry.` : ''}`
          : `Unable to load launches (${response.status}).`;

        if (response.status === 429) {
          throw new Error(throttleMessage || 'Too many requests. Please try again later.');
        }

        throw new Error(`Unable to load launches (${response.status}).`);
      }

      const results = Array.isArray(data.results) ? data.results : [];
      const nextPage = data.next || null;
      cacheRef.current[url] = { results, nextUrl: nextPage };

      setLaunches(prev => (append ? [...prev, ...results] : results));
      setNextUrl(nextPage);
      setError(null);
    } catch (err) {
      setError(err.message || 'Unexpected error fetching launch data.');
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };

  useEffect(() => {
    fetchLaunches(buildUrl(DEFAULT_SEARCH));
  }, []);

  const filteredLaunches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return launches;
    return launches.filter(launch => {
      const name = launch.name?.toLowerCase() || '';
      const missionName = launch.mission?.name?.toLowerCase() || '';
      const status = launch.status?.name?.toLowerCase() || '';
      const rocket = launch.rocket?.configuration?.name?.toLowerCase() || '';
      return (
        name.includes(term) ||
        missionName.includes(term) ||
        status.includes(term) ||
        rocket.includes(term)
      );
    });
  }, [launches, searchTerm]);

  const handleSearchSubmit = event => {
    event.preventDefault();
  };

  const loadMore = () => {
    if (loading || fetchingMore || !nextUrl || isThrottled) {
      return;
    }
    fetchLaunches(nextUrl, true);
  };

  useEffect(() => {
    const container = scrollRef.current;
    const sentinel = loadMoreTriggerRef.current;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!container || !sentinel || loading || fetchingMore || !nextUrl || isThrottled) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: container,
        rootMargin: '180px',
      }
    );

    observer.observe(sentinel);
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [loading, fetchingMore, nextUrl, isThrottled, launches.length]);

  const formatDate = value => {
    if (!value) return 'Unknown date';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const getStatusClass = status => {
    if (!status || !status.abbrev) {
      return 'launch__status--info';
    }
    if (/success/i.test(status.abbrev)) return 'launch__status--success';
    if (/failure|fail|abort/i.test(status.abbrev)) return 'launch__status--danger';
    if (/pending|hold|go/i.test(status.abbrev)) return 'launch__status--warning';
    return 'launch__status--info';
  };

  return (
    <div className="App">
      <div className="container">
        <section className="launch">
          <div className="launch__header">
            <div>
              <h1>Starlink launches</h1>
              <p className="launch__subtitle">Search, scroll, and inspect Starlink launch history.</p>
            </div>
            <form className="search" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                className="search__input"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search Starlink launches..."
                aria-label="Search launches"
              />
              <button type="submit" className="btn btn--primary">
                Search
              </button>
            </form>
          </div>

          {error && (
            <div className="error">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setError(null);
                  fetchLaunches(buildUrl(DEFAULT_SEARCH));
                }}
              >
                Retry
              </button>
            </div>
          )}

          <div className="launch__wrapper" ref={scrollRef}>
            {loading && launches.length === 0 ? (
              <div className="loading-state">
                <Spinner color="#1976d2" />
                <p>Loading launch data...</p>
              </div>
            ) : (
              <div className="launch__list">
                {filteredLaunches.map(launch => {
                  const imageUrl =
                    launch.image?.image_url ||
                    launch.mission?.image ||
                    launch.rocket?.configuration?.image?.image_url ||
                    null;

                  return (
                    <button
                      key={launch.id}
                      type="button"
                      className="launch__item"
                      onClick={() => setSelectedLaunch(launch)}
                    >
                      <div className="launch__body">
                        <div className="launch__media">
                          {imageUrl ? (
                            <img src={imageUrl} alt={launch.name} />
                          ) : (
                            <div className="launch__image-fallback">No preview</div>
                          )}
                        </div>
                        <div className="launch__details">
                          <div className="launch__top-row">
                            <h2>{launch.name}</h2>
                            <span className={`launch__status ${getStatusClass(launch.status)}`}>
                              {launch.status?.abbrev || 'Unknown'}
                            </span>
                          </div>
                          <p className="launch__description">
                            {launch.mission?.description || 'No mission description available.'}
                          </p>
                          <div className="launch__meta">
                            <span className="launch__meta-item">{formatDate(launch.net)}</span>
                            <span className="launch__meta-item">
                              {launch.rocket?.configuration?.name || 'Unknown rocket'}
                            </span>
                            <span className="launch__meta-item">{launch.pad?.name || 'Unknown pad'}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {!loading && launches.length === 0 && (
                  <p className="no-content">No launches loaded yet.</p>
                )}
                {!loading && launches.length > 0 && filteredLaunches.length === 0 && (
                  <p className="no-content">No loaded launches match &quot;{searchTerm}&quot;.</p>
                )}

                {fetchingMore && (
                  <div className="bottom-loader">
                    <Spinner color="#1976d2" />
                    <p>Loading more launches…</p>
                  </div>
                )}

                {!nextUrl && launches.length > 0 && !fetchingMore && (
                  <div className="max-reached">No more launches to load.</div>
                )}

                <div ref={loadMoreTriggerRef} className="scroll-sentinel" />
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedLaunch && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setSelectedLaunch(null)} />
          <div className="modal__content" role="document">
            <button className="modal__close" onClick={() => setSelectedLaunch(null)} aria-label="Close details">
              ×
            </button>
            <div className="modal__header">
              <h2>{selectedLaunch.name}</h2>
              <span className={`launch__status ${getStatusClass(selectedLaunch.status)}`}>
                {selectedLaunch.status?.name || selectedLaunch.status?.abbrev || 'Status Unknown'}
              </span>
            </div>
            <div className="modal__body">
              {selectedLaunch.image?.image_url ? (
                <img className="modal__image" src={selectedLaunch.image.image_url} alt={selectedLaunch.name} />
              ) : (
                <div className="modal__image-fallback">No image available</div>
              )}
              <div className="modal__details">
                <p>{selectedLaunch.mission?.description || 'Mission description not available.'}</p>
                <div className="launch__meta modal__meta">
                  <span className="launch__meta-item">NET: {formatDate(selectedLaunch.net)}</span>
                  <span className="launch__meta-item">
                    Rocket: {selectedLaunch.rocket?.configuration?.full_name || selectedLaunch.rocket?.configuration?.name || 'Unknown'}
                  </span>
                  <span className="launch__meta-item">Pad: {selectedLaunch.pad?.name || 'Unknown'}</span>
                </div>
                <div className="modal__extra">
                  <p>
                    <strong>Launch provider:</strong> {selectedLaunch.launch_service_provider?.name || 'Unknown'}
                  </p>
                  <p>
                    <strong>Location:</strong> {selectedLaunch.pad?.location?.name || selectedLaunch.pad?.name || 'Unknown'}
                  </p>
                  <p>
                    <strong>Mission:</strong> {selectedLaunch.mission?.name || 'N/A'}
                  </p>
                  {selectedLaunch.mission?.type && <p><strong>Type:</strong> {selectedLaunch.mission.type}</p>}
                  {selectedLaunch.mission?.orbit?.name && (
                    <p><strong>Orbit:</strong> {selectedLaunch.mission.orbit.name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
