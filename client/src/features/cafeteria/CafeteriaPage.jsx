import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconAdjustmentsHorizontal,
  IconMap,
  IconSearch,
} from "@tabler/icons-react";
import PageContainer from "../../components/layout/PageContainer.jsx";
import PageHeader from "../../components/layout/PageHeader.jsx";
import CafeteriaCard from "../../components/cards/CafeteriaCard.jsx";
import { useAuth } from '../../hooks/useAuth.js';
import { listVendors, getVendor } from '../../services/employeeApi.js';
import { mapVendorToDirectory } from '../home/homeTransform.js';
import { heroImage } from "../home/homeData.js";
import "./cafeteria.css";

const DIRECTORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open Now" },
  { id: "popular", label: "Popular" },
];

function cafeteriaPopularCount(list) {
  return Math.min(3, list.length);
}

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

function FilterChipGroup({ activeFilter, onChange, counts }) {
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
  const { session } = useAuth();
  const token = session?.access_token;
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(searchParams.get("filter") || "all");
  const [showFilters, setShowFilters] = useState(true);
  const [cafeterias, setCafeterias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setCafeterias([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;

    const loadDirectory = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await listVendors({ limit: 20, token });
        const vendorList = response?.vendors || [];
        const details = await Promise.all(
          vendorList.map((vendor) => getVendor(vendor.id, { token }).catch(() => null))
        );

        if (!cancelled) {
          setCafeterias(vendorList.map((vendor, index) => mapVendorToDirectory(vendor, details[index], index)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load cafeterias.');
          setCafeterias([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDirectory();

    return () => { cancelled = true; };
  }, [token]);

  const counts = useMemo(() => ({
    all: cafeterias.length,
    open: cafeterias.filter((c) => c.status === 'open').length,
    popular: cafeteriaPopularCount(cafeterias),
  }), [cafeterias]);

  const visibleCafeterias = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cafeterias.filter((cafeteria) => {
      const matchesQuery = !normalizedQuery || [cafeteria.name, cafeteria.description, cafeteria.location].some((value) => String(value).toLowerCase().includes(normalizedQuery));
      const matchesFilter = activeFilter === 'all'
        ? true
        : activeFilter === 'open'
          ? cafeteria.status === 'open'
          : true;

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, cafeterias, query]);

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
              <FilterChipGroup activeFilter={activeFilter} onChange={setActiveFilter} counts={counts} />
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
            <span>{loading ? 'Loading' : `${visibleCafeterias.length} cafeterias`}</span>
            {query && <span className="cafeteria_results-query">for "{query}"</span>}
          </div>
          {error ? (
            <div className="cafeteria_empty">
              <h2>Unable to load cafeterias</h2>
              <p>{error}</p>
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
              <button type="button" className="cafeteria_clear-button" onClick={() => { setQuery(""); setActiveFilter("all"); }}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>
    </PageContainer>
  );
}
