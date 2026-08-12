import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Spinner from "./components/Spinner";
import "./App.css";

const API_BASE = "https://dummyjson.com/products";
const PAGE_LIMIT = 10;

function App() {
  const [products, setProducts] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const scrollRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);
  const cacheRef = useRef({});

  const buildUrl = (skip = 0) => `${API_BASE}?limit=${PAGE_LIMIT}&skip=${skip}`;

  const fetchProducts = useCallback(async (url, append = false) => {
    try {
      if (append) {
        setFetchingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const cachedPage = cacheRef.current[url];
      if (cachedPage) {
        setProducts((prev) =>
          append ? [...prev, ...cachedPage.results] : cachedPage.results,
        );
        setNextUrl(cachedPage.nextUrl);
        setError(null);
        return;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        const throttleDetail =
          data?.detail || data?.message || data?.error || "";
        const waitSeconds =
          retryAfter || data?.expected_available_in || data?.wait || "";
        const throttleMessage = throttleDetail
          ? `${throttleDetail}${waitSeconds ? ` Retry.` : ""}`
          : `Unable to load products (${response.status}).`;

        if (response.status === 429) {
          throw new Error(
            throttleMessage || "Too many requests. Please try again later.",
          );
        }

        throw new Error(`Unable to load products (${response.status}).`);
      }

      const results = Array.isArray(data.products) ? data.products : [];
      const nextOffset = data.skip + data.limit;
      const nextPage = nextOffset < data.total ? buildUrl(nextOffset) : null;
      cacheRef.current[url] = { results, nextUrl: nextPage };

      setProducts((prev) => (append ? [...prev, ...results] : results));
      setNextUrl(nextPage);
      setError(null);
    } catch (err) {
      setError(err.message || "Unexpected error fetching product data.");
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(buildUrl());
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      const title = product.title?.toLowerCase() || "";
      const description = product.description?.toLowerCase() || "";
      const category = product.category?.toLowerCase() || "";
      const brand = product.brand?.toLowerCase() || "";
      const tags = Array.isArray(product.tags)
        ? product.tags.join(" ").toLowerCase()
        : "";
      return (
        title.includes(term) ||
        description.includes(term) ||
        category.includes(term) ||
        brand.includes(term) ||
        tags.includes(term)
      );
    });
  }, [products, searchTerm]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
  };

  const loadMore = useCallback(() => {
    if (loading || fetchingMore || !nextUrl) {
      return;
    }
    fetchProducts(nextUrl, true);
  }, [fetchingMore, fetchProducts, loading, nextUrl]);

  useEffect(() => {
    const container = scrollRef.current;
    const sentinel = loadMoreTriggerRef.current;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!container || !sentinel || loading || fetchingMore || !nextUrl) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: container,
        rootMargin: "180px",
      },
    );

    observer.observe(sentinel);
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [fetchingMore, loadMore, loading, nextUrl, products.length]);

  return (
    <div className="App">
      <div className="container">
        <section className="launch">
          <div className="launch__header">
            <div>
              <h1>Product catalog</h1>
              <p className="launch__subtitle">
                Search and scroll through fetched product data.
              </p>
            </div>
            <form className="search" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                className="search__input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
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
                  fetchProducts(buildUrl());
                }}
              >
                Retry
              </button>
            </div>
          )}

          <div className="launch__wrapper" ref={scrollRef}>
            {loading && products.length === 0 ? (
              <div className="loading-state">
                <Spinner color="#1976d2" />
                <p>Loading product data...</p>
              </div>
            ) : (
              <div className="launch__list">
                {filteredProducts.map((product) => {
                  const imageUrl =
                    product.thumbnail ||
                    (Array.isArray(product.images)
                      ? product.images[0]
                      : null) ||
                    null;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="launch__item"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="launch__body">
                        <div className="launch__media">
                          {imageUrl ? (
                            <img src={imageUrl} alt={product.title} />
                          ) : (
                            <div className="launch__image-fallback">
                              No preview
                            </div>
                          )}
                        </div>
                        <div className="launch__details">
                          <div className="launch__top-row">
                            <h2>{product.title}</h2>
                            {product.brand && (
                              <span className="launch__brand">
                                {product.brand}
                              </span>
                            )}
                          </div>
                          <p className="launch__description">
                            {product.description ||
                              "No product description available."}
                          </p>
                          <div className="launch__meta">
                            <span className="launch__meta-item">
                              ${product.price?.toFixed(2) ?? "N/A"}
                            </span>
                            <span className="launch__meta-item">
                              Stock: {product.stock ?? "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {!loading && products.length === 0 && (
                  <p className="no-content">No products loaded yet.</p>
                )}
                {!loading &&
                  products.length > 0 &&
                  filteredProducts.length === 0 && (
                    <p className="no-content">
                      No loaded products match &quot;{searchTerm}&quot;.
                    </p>
                  )}

                {fetchingMore && (
                  <div className="bottom-loader">
                    <Spinner color="#1976d2" />
                    <p>Loading more products...</p>
                  </div>
                )}

                {!nextUrl && products.length > 0 && !fetchingMore && (
                  <div className="max-reached">No more products to load.</div>
                )}

                <div ref={loadMoreTriggerRef} className="scroll-sentinel" />
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedProduct && (
        <div className="modal" role="dialog" aria-modal="true">
          <div
            className="modal__backdrop"
            onClick={() => setSelectedProduct(null)}
          />
          <div className="modal__content" role="document">
            <button
              className="modal__close"
              onClick={() => setSelectedProduct(null)}
              aria-label="Close details"
            >
              ×
            </button>
            <div className="modal__header">
              <h2>{selectedProduct.title}</h2>
              {selectedProduct.brand && (
                <span className="modal__brand">{selectedProduct.brand}</span>
              )}
            </div>
            <div className="modal__body">
              {selectedProduct.thumbnail ||
              (selectedProduct.images && selectedProduct.images[0]) ? (
                <img
                  className="modal__image"
                  src={selectedProduct.thumbnail || selectedProduct.images[0]}
                  alt={selectedProduct.title}
                />
              ) : (
                <div className="modal__image-fallback">No image available</div>
              )}
              <div className="modal__details">
                <p>
                  {selectedProduct.description ||
                    "Product description not available."}
                </p>
                <div className="launch__meta modal__meta">
                  <span className="launch__meta-item">
                    Price: ${selectedProduct.price?.toFixed(2) ?? "N/A"}
                  </span>
                  <span className="launch__meta-item">
                    Rating: {selectedProduct.rating ?? "N/A"}
                  </span>
                  <span className="launch__meta-item">
                    Stock: {selectedProduct.stock ?? "N/A"}
                  </span>
                </div>
                <div className="modal__extra">
                  <p>
                    <strong>Brand:</strong> {selectedProduct.brand || "Unknown"}
                  </p>
                  <p>
                    <strong>Category:</strong>{" "}
                    {selectedProduct.category || "Unknown"}
                  </p>
                  <p>
                    <strong>SKU:</strong> {selectedProduct.sku || "N/A"}
                  </p>
                  <p>
                    <strong>Warranty:</strong>{" "}
                    {selectedProduct.warrantyInformation || "N/A"}
                  </p>
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
