import { useState, useEffect } from 'react';
import api from '../api/axios';
import OpportunityCard from '../components/OpportunityCard';
import SearchBar from '../components/SearchBar';
import FilterDropdown from '../components/FilterDropdown';
import Pagination from '../components/Pagination';
import Loader from '../components/Loader';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState([]);
  // Page info from the API: { page, limit, total, totalPages, hasNext }.
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search + filter state live here and are passed down (lifting state up).
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [domains, setDomains] = useState([]);
  const [page, setPage] = useState(1);

  // Load the domain list once for the dropdown.
  useEffect(() => {
    api
      .get('/domains')
      .then((res) => setDomains(res.data.data))
      .catch(() => setDomains([]));
  }, []);

  // Debounce the search input (~400ms) so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Changing a filter must reset to page 1: staying on page 4 of the old result
  // set would land on an empty page whenever the new set is smaller.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, domain]);

  // Refetch whenever the search term, domain, or page changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api
      .get('/opportunities', { params: { search: debouncedSearch, domain, page } })
      .then((res) => {
        if (!active) return;
        setOpportunities(res.data.data);
        setMeta(res.data.meta);
      })
      .catch(() => {
        if (active) setError('Could not load opportunities. Is the server running?');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, domain, page]);

  const goToPage = (next) => {
    setPage(next);
    // Otherwise page 2 opens scrolled to wherever the pager was clicked.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="page-header">
        <h1>Explore Opportunities</h1>
        {/* meta.total is the size of the whole result set, not just this page. */}
        <span className="muted">{meta ? `${meta.total} listed` : ''}</span>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} />
        <FilterDropdown value={domain} onChange={setDomain} domains={domains} />
      </div>

      {loading ? (
        <Loader label="Loading opportunities…" />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : opportunities.length === 0 ? (
        <div className="state">No opportunities found. Try a different search or filter.</div>
      ) : (
        <>
          <div className="grid">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp._id} opportunity={opp} />
            ))}
          </div>
          <Pagination meta={meta} onPageChange={goToPage} label="opportunities" />
        </>
      )}
    </>
  );
}
