import { useMemo, useState } from 'react';
import {
  IconAdjustmentsHorizontal,
  IconBuildingCommunity,
  IconMap,
  IconSearch,
} from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import CafeteriaCard from '../../components/cards/CafeteriaCard.jsx';
import { cafeterias } from '../home/homeData.js';
import './cafeteria.css';

const DIRECTORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open now' },
  { id: 'main', label: 'Main site' },
  { id: 'north', label: 'North site' },
  { id: 'south', label: 'South site' },
];

const DIRECTORY_DETAILS = {
  'main-campus-cafe': { site: 'main', location: 'Main site · Near the atrium', rating: '4.6', reviewCount: 230 },
  'library-bistro': { site: 'north', location: 'North site · Library level', rating: '4.8', reviewCount: 184 },
  'res-court-kitchen': { site: 'south', location: 'South site · Residence court', rating: '4.7', reviewCount: 156 },
  'science-snack-bar': { site: 'north', location: 'North site · Science building', rating: '4.4', reviewCount: 98 },
  'grill-house-court': { site: 'main', location: 'Main site · Courtyard', rating: '4.5', reviewCount: 212 },
  'dining-hall-central': { site: 'main', location: 'Main site · Central hall', rating: '4.6', reviewCount: 301 },
  'east-gate-gather': { site: 'south', location: 'South site · East gate', rating: '4.5', reviewCount: 127 },
  'courtyard-eats': { site: 'south', location: 'South site · Open courtyard', rating: '4.3', reviewCount: 89 },
};

const DIRECTORY_CAFETERIAS = cafeterias.map((cafeteria) => ({
  ...cafeteria,
  ...DIRECTORY_DETAILS[cafeteria.id],
}));

function FilterChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`cafeteria_filter-chip${active ? ' cafeteria_filter-chip--active' : ''}`}
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
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);

  const visibleCafeterias = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return DIRECTORY_CAFETERIAS.filter((cafeteria) => {
      const matchesQuery = !normalizedQuery
        || [cafeteria.name, cafeteria.description, cafeteria.location]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesFilter = activeFilter === 'all'
        || (activeFilter === 'open' && cafeteria.status === 'open')
        || cafeteria.site === activeFilter;

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query]);

  return (
    <PageContainer className="cafeteria_page-container">
      <main className="cafeteria_page">
        <header className="cafeteria_header">
          <div className="cafeteria_header-copy">
            <span className="cafeteria_overline"><IconBuildingCommunity size={16} /> Food at work</span>
            <h1 className="cafeteria_title">Cafeterias</h1>
            <p className="cafeteria_subtitle">Discover cafeterias across Merchant Place.</p>
          </div>
          <button type="button" className="cafeteria_map-button" aria-label="Open cafeteria map">
            <IconMap size={18} stroke={1.8} />
            <span>Map view</span>
          </button>
        </header>

        <section className="cafeteria_controls" aria-label="Search and filter cafeterias">
          <label className="cafeteria_search">
            <IconSearch size={19} stroke={1.8} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cafeterias..."
              aria-label="Search cafeterias"
            />
          </label>
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
        </section>

        {showFilters && <FilterChipGroup activeFilter={activeFilter} onChange={setActiveFilter} />}

        <section className="cafeteria_results" aria-live="polite" aria-label="Cafeteria results">
          <div className="cafeteria_results-heading">
            <span>{visibleCafeterias.length} cafeterias</span>
            {query && <span className="cafeteria_results-query">for “{query}”</span>}
          </div>
          {visibleCafeterias.length > 0 ? (
            <div className="cafeteria_grid">
              {visibleCafeterias.map((cafeteria) => (
                <CafeteriaCard key={cafeteria.id} {...cafeteria} variant="directory" />
              ))}
            </div>
          ) : (
            <div className="cafeteria_empty">
              <h2>No cafeterias found</h2>
              <p>Try changing your search or filters.</p>
              <button type="button" className="cafeteria_clear-button" onClick={() => { setQuery(''); setActiveFilter('all'); }}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>
    </PageContainer>
  );
}
