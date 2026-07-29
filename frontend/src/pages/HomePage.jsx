import { useState, useEffect } from 'react';
import api from '../api/axios';
import OpportunityCard from '../components/OpportunityCard';
import SearchBar from '../components/SearchBar';
import FilterDropdown from '../components/FilterDropdown';
import Loader from '../components/Loader';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search + filter state live here and are passed down (lifting state up).
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [domains, setDomains] = useState([]);

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

  // Refetch whenever the debounced search term or domain changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api
      .get('/opportunities', { params: { search: debouncedSearch, domain } })
      .then((res) => {
        if (active) setOpportunities(res.data.data);
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
  }, [debouncedSearch, domain]);

  return (
    <>
      <div className="page-header">
        <h1>Explore Opportunities</h1>
        <span className="muted">{opportunities.length} listed</span>
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
        <div className="grid">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp._id} opportunity={opp} />
          ))}
        </div>
      )}
    </>
  );
}
