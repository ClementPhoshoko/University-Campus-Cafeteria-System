import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconAdjustmentsHorizontal,
  IconMap,
  IconSearch,
} from "@tabler/icons-react";
import PageContainer from "../../components/layout/PageContainer.jsx";
import PageHeader from "../../components/layout/PageHeader.jsx";
import CafeteriaCard from "../../components/cards/CafeteriaCard.jsx";
import { cafeterias, heroImage } from "../home/homeData.js";
import "./cafeteria.css";

const DIRECTORY_FILTERS = [
  { id: "open", label: "Open Now" },
  { id: "popular", label: "Popular" },
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "meals", label: "Meals" },
  { id: "snacks", label: "Snacks" },
  { id: "drinks", label: "Drinks" },
];

const DIRECTORY_DETAILS = {
  "main-campus-cafe": { category: "popular", location: "Main site · Near the atrium", rating: "4.6", reviewCount: 230 },
  "library-bistro": { category: "lunch", location: "North site · Library level", rating: "4.8", reviewCount: 184 },
  "res-court-kitchen": { category: "meals", location: "South site · Residence court", rating: "4.7", reviewCount: 156 },
  "science-snack-bar": { category: "snacks", location: "North site · Science building", rating: "4.4", reviewCount: 98 },
  "grill-house-court": { category: "lunch", location: "Main site · Courtyard", rating: "4.5", reviewCount: 212 },
  "dining-hall-central": { category: "breakfast", location: "Main site · Central hall", rating: "4.6", reviewCount: 301 },
  "east-gate-gather": { category: "drinks", location: "South site · East gate", rating: "4.5", reviewCount: 127 },
  "courtyard-eats": { category: "snacks", location: "South site · Open courtyard", rating: "4.3", reviewCount: 89 },
};

const DIRECTORY_CAFETERIAS = cafeterias.map((cafeteria) => ({
  ...cafeteria,
  ...DIRECTORY_DETAILS[cafeteria.id],
}));

function FilterChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`cafeteria_filter-chip${active ? " cafeteria_filter-chip--active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function FilterChipGroup({ activeFilter, onChange }) {
  return (
    <div className="cafeteria_filter-scroll" role="group" aria-label="Cafeteria filters">
      {DIRECTORY_FILTERS.map((filter) => (
        <FilterChip
          key={filter.id}
          active={activeFilter === filter.id}
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

  const visibleCafeterias = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return DIRECTORY_CAFETERIAS.filter((cafeteria) => {
      const matchesQuery = !normalizedQuery
        || [cafeteria.name, cafeteria.description, cafeteria.location]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesFilter = activeFilter === "open"
        ? cafeteria.status === "open"
        : cafeteria.category === activeFilter;

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query]);

  return (
    <PageContainer noPad>
      <div className="cafeteria_hero">
        <img src={heroImage} alt="" className="cafeteria_hero-bg" aria-hidden="true" />
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
              <FilterChipGroup activeFilter={activeFilter} onChange={setActiveFilter} />
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
