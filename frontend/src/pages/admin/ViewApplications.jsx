import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Loader from '../../components/Loader';
import { useToast } from '../../components/Toast';
import { LIMITS, optional } from '../../utils/validationRules';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');

    const params = {};
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
        setStats(statsRes.data.data);
        setDomains(domainRes.data.data);
      })
      .catch(() => setError('Could not load applications.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters.status, filters.domain]);

  const fmtDate = (date) => new Date(date).toLocaleDateString();

  const updateStatus = async (id, status) => {
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
    load();
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
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          {statuses.map((status) => <option key={status}>{status}</option>)}
        </select>
        <select
          value={filters.domain}
          aria-label="Filter by domain"
          onChange={(e) => setFilters((prev) => ({ ...prev, domain: e.target.value }))}
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
                    <td>{opportunity ? `${opportunity.title} - ${opportunity.company}` : 'Deleted opportunity'}</td>
                    <td>{opportunity?.domain || '-'}</td>
                    <td><span className={`badge ${statusClass[application.status || 'Pending'] || ''}`}>{application.status || 'Pending'}</span></td>
                    <td>
                      {application.resumeLink ? (
                        <button className="link-button" type="button" onClick={() => setPreview(application)}>View</button>
                      ) : '-'}
                    </td>
                    <td>{fmtDate(application.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm" disabled={(application.status || 'Pending') === 'Approved'} onClick={() => updateStatus(application._id, 'Approved')}>Approve</button>
                        <button className="btn btn-danger btn-sm" disabled={(application.status || 'Pending') === 'Rejected'} onClick={() => updateStatus(application._id, 'Rejected')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="resume-modal">
            <div className="modal-head">
              <div>
                <h2>{preview.name}'s resume</h2>
                <p className="muted">{preview.opportunityId?.title} - {preview.opportunityId?.company}</p>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setPreview(null)}>Close</button>
            </div>
            <iframe title="Resume preview" src={preview.resumeLink} />
            <div className="modal-foot">
              <a href={preview.resumeLink} target="_blank" rel="noreferrer" className="btn btn-outline">Open in new tab</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
