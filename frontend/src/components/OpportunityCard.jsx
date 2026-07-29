import { Link } from 'react-router-dom';

export default function OpportunityCard({ opportunity }) {
  const { _id, title, company, domain, type, location } = opportunity;

  return (
    <div className="card opp-card">
      <div>
        <h3>{title}</h3>
        <div className="company">{company}</div>
      </div>
      <div className="opp-card-meta">
        <span className="badge badge-primary">{domain}</span>
        <span className="badge badge-type">{type}</span>
        {location && <span className="badge">📍 {location}</span>}
      </div>
      <div className="opp-card-foot">
        <Link to={`/opportunities/${_id}`} className="btn btn-outline btn-sm">
          View details →
        </Link>
      </div>
    </div>
  );
}
