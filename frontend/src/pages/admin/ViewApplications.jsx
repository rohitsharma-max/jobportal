import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Loader from '../../components/Loader';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import { LIMITS, optional } from '../../utils/validationRules';
import { isEmbeddableResume } from '../../utils/resumeUrl';

const statuses = ['All', 'Pending', 'Approved', 'Rejected'];
// Same cap the backend query schema enforces on ?company=
const companyRule = optional('Company search', { max: LIMITS.search.max });
const statusClass = {
  Pending: 'badge-warning',
  Approved: 'badge-success',
  Rejected: 'badge-danger',
};

export default function ViewApplications() {
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [domains, setDomains] = useState([]);
  const [filters, setFilters] = useState({ status: 'All', domain: '', company: '' });
  const [companyError, setCompanyError] = useState('');
  const [preview, setPreview] = useState(null);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Keyed by application id (not a single flag) so approving one row doesn't
  // disable every other row's buttons — the requests are independent PATCHes
  // and there's no reason to serialize them. The value is the target status,
  // so the clicked button can show "Approving…"/"Rejecting…" instead of just
  // going dark.
  const [pendingStatus, setPendingStatus] = useState({});

  // useCallback + an explicit dependency list, so the effect below declares
  // everything it actually reads. `filters.company` is included here even though
  // it is applied on submit rather than on change — leaving it out of the
  // closure's dependencies was what tripped the exhaustive-deps warning.
  const load = useCallback(() => {
    setLoading(true);
    setError('');

    const params = { page };
    if (filters.status !== 'All') params.status = filters.status;
    if (filters.domain) params.domain = filters.domain;
    if (filters.company.trim()) params.company = filters.company.trim();

    Promise.all([
      api.get('/applications', { params }),
      api.get('/applications/stats'),
      api.get('/domains'),
    ])
      .then(([applicationRes, statsRes, domainRes]) => {
        setApplications(applicationRes.data.data);
        setMeta(applicationRes.data.meta);
        setStats(statsRes.data.data);
        setDomains(domainRes.data.data);
      })
      .catch(() => setError('Could not load applications.'))
      .finally(() => setLoading(false));
  }, [page, filters.status, filters.domain, filters.company]);

  // Deliberately NOT depending on `load` itself: the company box updates
  // `filters.company` on every keystroke, which would rebuild `load` and refetch
  // per character. The company filter is applied by its Search button instead.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.status, filters.domain]);

  // Changing a filter shrinks the result set, so keep the user off a page that
  // may no longer exist.
  const changeFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  // Escape closes the preview. A modal that can only be dismissed by finding its
  // Close button is a keyboard trap.
  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  const fmtDate = (date) => new Date(date).toLocaleDateString();

  const updateStatus = async (id, status) => {
    setPendingStatus((prev) => ({ ...prev, [id]: status }));
    try {
      const res = await api.patch(`/applications/${id}/status`, { status });
      setApplications((prev) => prev.map((item) => (item._id === id ? res.data.data : item)));
      const statsRes = await api.get('/applications/stats');
      setStats(statsRes.data.data);
      toast(`Application ${status.toLowerCase()}.`, 'success');
    } catch (err) {
      toast(
        err.response?.data?.message || 'Could not update application status.',
        'error',
      );
    } finally {
      // Always clears, so a failed request re-enables the row's buttons
      // instead of leaving them stuck.
      setPendingStatus((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleCompanyChange = (event) => {
    const { value } = event.target;
    setFilters((prev) => ({ ...prev, company: value }));
    if (companyError) setCompanyError('');
  };

  const handleCompanySearch = (event) => {
    event.preventDefault();
    const invalid = companyRule(filters.company);
    if (invalid) {
      setCompanyError(invalid);
      toast(invalid, 'error');
      return;
    }
    setCompanyError('');

    // A new search is a new result set, so it starts from page 1. Either the
    // page change drives the refetch, or we already are on page 1 and fetch
    // directly — never both, so two requests can't race and land out of order.
    if (page !== 1) setPage(1);
    else load();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Admin - Applications</h1>
          <p className="muted page-subtitle">Review applicants, filter by domain/company, and manage status.</p>
        </div>
        <Link to="/admin" className="btn btn-outline">Back to dashboard</Link>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card"><span>Total requests</span><strong>{stats.total}</strong></div>
          <div className="stat-card"><span>Pending</span><strong>{stats.byStatus.Pending}</strong></div>
          <div className="stat-card"><span>Approved</span><strong>{stats.byStatus.Approved}</strong></div>
          <div className="stat-card"><span>Rejected</span><strong>{stats.byStatus.Rejected}</strong></div>
        </div>
      )}

      <form className="admin-filterbar" onSubmit={handleCompanySearch} noValidate>
        <select
          value={filters.status}
          aria-label="Filter by status"
          onChange={(e) => changeFilter({ status: e.target.value })}
        >
          {statuses.map((status) => <option key={status}>{status}</option>)}
        </select>
        <select
          value={filters.domain}
          aria-label="Filter by domain"
          onChange={(e) => changeFilter({ domain: e.target.value })}
        >
          <option value="">All domains</option>
          {domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
        </select>
        <input
          placeholder="Search company"
          aria-label="Search by company"
          maxLength={LIMITS.search.max}
          aria-invalid={companyError ? true : undefined}
          aria-describedby={companyError ? 'company-filter-error' : undefined}
          className={companyError ? 'field-invalid' : ''}
          value={filters.company}
          onChange={handleCompanyChange}
        />
        <button className="btn btn-outline" type="submit">Search</button>
      </form>
      {companyError && (
        <span className="field-error" id="company-filter-error" role="alert">
          {companyError}
        </span>
      )}

      {stats && (
        <div className="insight-grid">
          <section className="insight-panel">
            <h2>Requests by domain</h2>
            {stats.byDomain.length === 0 ? <p className="muted">No domain data yet.</p> : stats.byDomain.map((item) => (
              <div className="insight-row" key={item.domain}><span>{item.domain}</span><strong>{item.count}</strong></div>
            ))}
          </section>
          <section className="insight-panel">
            <h2>Top companies</h2>
            {stats.byCompany.length === 0 ? <p className="muted">No company data yet.</p> : stats.byCompany.map((item) => (
              <div className="insight-row" key={item.company}><span>{item.company}</span><strong>{item.count}</strong></div>
            ))}
          </section>
        </div>
      )}

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : applications.length === 0 ? (
        <div className="state">No applications match these filters.</div>
      ) : (
        <>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Opportunity</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Resume</th>
                <th>Applied</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => {
                const opportunity = application.opportunityId;
                return (
                  <tr key={application._id}>
                    <td>
                      <strong>{application.name}</strong>
                      <div className="muted">{application.email}</div>
                      <div className="muted">{application.phone || 'No phone'}</div>
                    </td>
                    <td>
                      {opportunity ? `${opportunity.title} - ${opportunity.company}` : 'Deleted opportunity'}
                      {opportunity?.status === 'archived' && (
                        <div className="muted">archived</div>
                      )}
                    </td>
                    <td>{opportunity?.domain || '-'}</td>
                    <td><span className={`badge ${statusClass[application.status || 'Pending'] || ''}`}>{application.status || 'Pending'}</span></td>
                    <td>
                      {/* Only files we uploaded can be previewed inline. An
                          applicant-supplied link opens in its own tab instead —
                          see utils/resumeUrl.js for why. */}
                      {!application.resumeLink ? (
                        '-'
                      ) : isEmbeddableResume(application.resumeLink) ? (
                        <button className="link-button" type="button" onClick={() => setPreview(application)}>
                          Preview
                        </button>
                      ) : (
                        <a
                          href={application.resumeLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="link-button"
                        >
                          Open link ↗
                        </a>
                      )}
                    </td>
                    <td>{fmtDate(application.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={(application.status || 'Pending') === 'Approved' || !!pendingStatus[application._id]}
                          onClick={() => updateStatus(application._id, 'Approved')}
                        >
                          {pendingStatus[application._id] === 'Approved' ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={(application.status || 'Pending') === 'Rejected' || !!pendingStatus[application._id]}
                          onClick={() => updateStatus(application._id, 'Rejected')}
                        >
                          {pendingStatus[application._id] === 'Rejected' ? 'Rejecting…' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination meta={meta} onPageChange={setPage} label="applications" />
        </>
      )}

      {preview && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-modal-title"
          onClick={() => setPreview(null)}
        >
          {/* Stop a click inside the panel from closing it via the backdrop. */}
          <div className="resume-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2 id="resume-modal-title">{preview.name}&apos;s resume</h2>
                <p className="muted">{preview.opportunityId?.title} - {preview.opportunityId?.company}</p>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setPreview(null)}>Close</button>
            </div>
            {/* `sandbox` with no allow-scripts: the framed document renders but
                cannot run JavaScript, navigate the top-level window, or submit
                forms. Browsers' built-in PDF viewer is unaffected. */}
            <iframe
              title="Resume preview"
              src={preview.resumeLink}
              sandbox=""
              referrerPolicy="no-referrer"
            />
            <div className="modal-foot">
              <a
                href={preview.resumeLink}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-outline"
              >
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
