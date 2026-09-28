import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconAdjustmentsHorizontal,
  IconMap,
  IconSearch,
} from "@tabler/icons-react";
import { useAuth } from "../../hooks/useAuth.js";
import { listCafeterias } from "../../services/adminApi.js";
import { heroImage } from "../home/homeData.js";
import PageContainer from "../../components/layout/PageContainer.jsx";
import PageHeader from "../../components/layout/PageHeader.jsx";
import CafeteriaCard from "../../components/cards/CafeteriaCard.jsx";
import "./cafeteria.css";

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

function FilterChipGroup({ activeFilter, onChange, cafeterias }) {
  const counts = useMemo(() => ({
    open: cafeterias.filter(c => c.status === 'open').length,
    popular: cafeterias.filter(c => c.category === 'popular').length,
    breakfast: cafeterias.filter(c => c.category === 'breakfast').length,
    lunch: cafeterias.filter(c => c.category === 'lunch').length,
    meals: cafeterias.filter(c => c.category === 'meals').length,
    snacks: cafeterias.filter(c => c.category === 'snacks').length,
    drinks: cafeterias.filter(c => c.category === 'drinks').length,
  }), [cafeterias]);

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
    </div>
  );
}

export default function CafeteriaPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(searchParams.get("filter") || "open");
  const [showFilters, setShowFilters] = useState(true);
  const { session } = useAuth();
  const [cafeterias, setCafeterias] = useState([]);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    listCafeterias(token, { page: 1, limit: 100 })
      .then((res) => { setCafeterias(res?.cafeterias || []); })
      .catch(() => {});
  }, [session]);

  const visibleCafeterias = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cafeterias.filter((cafeteria) => {
      const matchesQuery = !normalizedQuery
        || [cafeteria.name, cafeteria.description]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesFilter = activeFilter === "open"
        ? cafeteria.status === "open"
        : cafeteria.category === activeFilter;

      return matchesQuery && matchesFilter;
    });
  }, [cafeterias, activeFilter, query]);

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
              <FilterChipGroup activeFilter={activeFilter} onChange={setActiveFilter} cafeterias={cafeterias} />
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
          <div className="cafeteria_results-heading">
            <span>{visibleCafeterias.length} cafeterias</span>
            {query && <span className="cafeteria_results-query">for "{query}"</span>}
          </div>
          {visibleCafeterias.length > 0 ? (
            <div className="cafeteria_grid">
              {visibleCafeterias.map((cafeteria) => (
                <CafeteriaCard key={cafeteria.id} {...cafeteria} variant="directory" to={`/cafeterias/${cafeteria.id}`} />
              ))}
            </div>
          ) : (
            <div className="cafeteria_empty">
              <h2>No cafeterias found</h2>
              <p>Try changing your search or filters.</p>
              <button type="button" className="cafeteria_clear-button" onClick={() => { setQuery(""); setActiveFilter("open"); }}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>
    </PageContainer>
  );
}
