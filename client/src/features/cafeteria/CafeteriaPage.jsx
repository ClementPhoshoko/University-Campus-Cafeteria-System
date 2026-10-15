import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconAdjustmentsHorizontal,
  IconMap,
  IconSearch,
} from "@tabler/icons-react";
import PageContainer from "../../components/layout/PageContainer.jsx";
import PageHeader from "../../components/layout/PageHeader.jsx";
import CafeteriaCard from "../../components/cards/CafeteriaCard.jsx";
import CafeteriaCardSkeleton from "../../components/cards/CafeteriaCardSkeleton.jsx";
import { useAuth } from '../../hooks/useAuth.js';
import { listVendors } from '../../services/employeeApi.js';
import { mapVendorToCafeteriaCard } from '../home/homeTransform.js';
import { heroImage } from "../home/homeData.js";
import { CACHE_TTL } from '../../services/cache.js';
import { useFetch } from '../../hooks/useFetch.js';
import "./cafeteria.css";

const DIRECTORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open Now" },
  { id: "top-rated", label: "Top rated" },
];

function FilterChip({ active, children, count, onClick }) {
  return (
    <button
      type="button"
      className={`cafeteria_filter-chip${active ? " cafeteria_filter-chip--active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
      {count !== undefined && (
        <span className="cafeteria_filter-chip__count">{count}</span>
      )}
    </button>
  );
}

function FilterChipGroup({ activeFilter, onChange, counts, categories, selectedCategory, onCategoryChange }) {
  return (
    <div className="cafeteria_filter-scroll" role="group" aria-label="Cafeteria filters">
      {DIRECTORY_FILTERS.map((filter) => (
        <FilterChip
          key={filter.id}
          active={activeFilter === filter.id}
          count={counts[filter.id]}
          onClick={() => onChange(filter.id)}
        >
          {filter.label}
        </FilterChip>
      ))}
      {categories.map(([category, count]) => (
        <FilterChip
          key={category}
          active={selectedCategory.toLowerCase() === category.toLowerCase()}
          count={count}
          onClick={() => onCategoryChange(category)}
        >
          {category}
        </FilterChip>
      ))}
    </div>
  );
}

export default function CafeteriaPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const requestedFilter = searchParams.get("filter");
  const [activeFilter, setActiveFilter] = useState(
    DIRECTORY_FILTERS.some((filter) => filter.id === requestedFilter) ? requestedFilter : "all",
  );
  const selectedCategory = searchParams.get("category") || '';
  const [showFilters, setShowFilters] = useState(true);
  useEffect(() => {
    setActiveFilter(
      DIRECTORY_FILTERS.some((filter) => filter.id === requestedFilter) ? requestedFilter : "all",
    );
  }, [requestedFilter]);

  const loadDirectory = useCallback(async ({ signal }) => {
    const firstPage = await listVendors({ page: 1, limit: 100, token, signal, cache: 'no-cache' });
    const totalPages = Math.max(1, Number(firstPage?.pagination?.totalPages) || 1);
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => listVendors({
        page: index + 2,
        limit: 100,
        token,
        signal,
        cache: 'no-cache',
      }))
    );
    const cafeteriaList = [
      ...(firstPage?.vendors || []),
      ...remainingPages.flatMap((response) => response?.vendors || []),
    ];

    return cafeteriaList.map(mapVendorToCafeteriaCard);
  }, [token]);
  const directory = useFetch(loadDirectory, {
    cacheKey: 'employee:vendor-directory',
    enabled: Boolean(token),
    staleTime: CACHE_TTL.employeeVendorDirectory,
  });
  const cafeterias = token ? directory.data || [] : [];
  const loading = Boolean(token) && directory.isLoading && !directory.data;
  const error = directory.error && !directory.data
    ? directory.error?.message || 'Unable to load cafeterias.'
    : null;
  const refreshError = directory.error && directory.data
    ? 'Could not refresh cafeteria information. Showing the last loaded data.'
    : null;

  const counts = useMemo(() => ({
    all: cafeterias.length,
    open: cafeterias.filter((c) => c.status === 'open').length,
    'top-rated': cafeterias.filter((c) => Number(c.rating) > 0).length,
  }), [cafeterias]);

  const categoryCounts = useMemo(() => {
    const countsByCategory = new Map();
    cafeterias.forEach((cafeteria) => {
      new Set(cafeteria.categories.map((category) => category.trim()).filter(Boolean))
        .forEach((category) => countsByCategory.set(category, (countsByCategory.get(category) || 0) + 1));
    });
    return [...countsByCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [cafeterias]);

  const visibleCafeterias = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = cafeterias.filter((cafeteria) => {
      const matchesQuery = !normalizedQuery || [
        cafeteria.name,
        cafeteria.description,
        ...cafeteria.locations.flatMap((item) => [item.site_name, item.building_name]),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      const matchesFilter = activeFilter === 'all'
        ? true
        : activeFilter === 'open'
          ? cafeteria.status === 'open'
          : Number(cafeteria.rating) > 0;
      const matchesCategory = !selectedCategory
        || cafeteria.categories.some((category) => category.toLowerCase() === selectedCategory.toLowerCase());

      return matchesQuery && matchesFilter && matchesCategory;
    });
    if (activeFilter !== 'top-rated') return filtered;
    return filtered.sort((a, b) => (
      Number(b.rating) - Number(a.rating)
      || b.reviewCount - a.reviewCount
      || a.name.localeCompare(b.name)
    ));
  }, [activeFilter, cafeterias, query, selectedCategory]);

  const changeFilter = (filter) => {
    setActiveFilter(filter);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (filter === 'all') next.delete('filter');
      else next.set('filter', filter);
      return next;
    });
  };

  const changeCategory = (category) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (selectedCategory.toLowerCase() === category.toLowerCase()) next.delete('category');
      else next.set('category', category);
      return next;
    });
  };

  const clearFilters = () => {
    setQuery('');
    setActiveFilter('all');
    setSearchParams({});
  };

  return (
    <PageContainer noPad>
      <div className="cafeteria_hero">
        <img src={heroImage} alt="" className="cafeteria_hero-bg" aria-hidden="true" loading="eager" />
        <div className="cafeteria_hero-inner">
          <div className="cafeteria_hero-left">
            <PageHeader
              eyebrow="Food at work"
              title="Cafeterias"
              subtitle="Discover cafeterias across Merchant Place."
            />
            <div className="cafeteria_search-row">
              <div className="search-field">
                <IconSearch size={18} stroke={1.8} />
                <input
                  type="search"
                  placeholder="Search cafeterias..."
                  aria-label="Search cafeterias"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="cafeteria_filter-button"
                aria-label="Toggle cafeteria filters"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((visible) => !visible)}
              >
                <IconAdjustmentsHorizontal size={18} stroke={1.8} />
                <span>Filters</span>
              </button>
            </div>
            <div className={`cafeteria_filters-bar${showFilters ? " cafeteria_filters-bar--visible" : ""}`}>
              <FilterChipGroup
                activeFilter={activeFilter}
                onChange={changeFilter}
                counts={counts}
                categories={categoryCounts}
                selectedCategory={selectedCategory}
                onCategoryChange={changeCategory}
              />
            </div>
          </div>
          <div className="cafeteria_hero-right">
            <div className="cafeteria_map-placeholder" aria-label="Map view placeholder">
              <IconMap size={32} stroke={1.4} />
              <span>Map view coming soon</span>
            </div>
          </div>
        </div>
      </div>

      <main className="cafeteria_page">
        <section className="cafeteria_results" aria-live="polite" aria-label="Cafeteria results">
          {refreshError && <p role="status">{refreshError}</p>}
          <div className="cafeteria_results-heading" aria-live="polite">
            <span>{loading ? 'Loading' : `${visibleCafeterias.length} cafeterias`}</span>
            {activeFilter !== 'all' && (
              <span className="cafeteria_results-query">
                {DIRECTORY_FILTERS.find((filter) => filter.id === activeFilter)?.label}
              </span>
            )}
            {query && <span className="cafeteria_results-query">for "{query}"</span>}
            {selectedCategory && <span className="cafeteria_results-query">in {selectedCategory}</span>}
          </div>
          {error ? (
            <div className="cafeteria_empty">
              <h2>Unable to load cafeterias</h2>
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="cafeteria_grid" role="status" aria-label="Loading cafeterias">
              {Array.from({ length: 6 }, (_, index) => (
                <CafeteriaCardSkeleton key={index} variant="directory" />
              ))}
            </div>
          ) : visibleCafeterias.length > 0 ? (
            <div className="cafeteria_grid">
              {visibleCafeterias.map((cafeteria) => (
                <CafeteriaCard key={cafeteria.id} {...cafeteria} variant="directory" to={`/cafeterias/${cafeteria.id}`} />
              ))}
            </div>
          ) : (
            <div className="cafeteria_empty">
              <h2>No cafeterias found</h2>
              <p>Try changing your search or filters.</p>
              <button type="button" className="cafeteria_clear-button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>
    </PageContainer>
  );
}
