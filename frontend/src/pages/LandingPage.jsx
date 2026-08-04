import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';

// Mirrors backend/src/config/constants.js DOMAINS verbatim. /api/domains is
// public and returns the same list, but a first paint before that request
// resolves (or a network hiccup) must never leave this section empty — this
// is the fallback, not a duplicate source of truth.
const FALLBACK_DOMAINS = [
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning',
  'UI/UX Design',
  'DevOps',
  'Cybersecurity',
  'Marketing',
  'Finance',
  'Human Resources',
  'Content Writing',
];

// The three real values of APPLICATION_STATUSES (backend/src/config/constants.js)
// plus the honest framing that stage 3 is Approved-OR-Rejected, not a promise.
const TRACK_STAGES = [
  {
    label: 'Apply',
    caption: 'Submit once, with your résumé.',
    stageClass: 'landing-track-stage-apply',
  },
  {
    label: 'Under review',
    caption: 'The team reviews your application.',
    stageClass: 'landing-track-stage-review',
  },
  {
    label: 'Decision',
    caption: 'Approved or rejected — you always hear back.',
    stageClass: 'landing-track-stage-decision',
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [domains, setDomains] = useState(FALLBACK_DOMAINS);

  // A logged-in visitor should never see marketing copy — send them straight
  // to the list. Gated on `loading` resolving first: firing this while
  // AuthContext's GET /auth/me is still in flight would flash this page for
  // anyone already signed in, then yank them away a moment later.
  useEffect(() => {
    if (!loading && user) navigate('/opportunities', { replace: true });
  }, [loading, user, navigate]);

  // Real content, not invented: the same public endpoint the (now
  // logged-in-only) list page reads for its filter dropdown. Errors are
  // swallowed — FALLBACK_DOMAINS above already covers that case.
  useEffect(() => {
    api
      .get('/domains')
      .then((res) => {
        if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setDomains(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Covers both the initial auth check and the moment after it resolves to a
  // logged-in user but before the effect above has navigated away — either
  // way, showing the landing page here would be the flash this component
  // exists to prevent.
  if (loading || user) return <Loader />;

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <p className="landing-eyebrow">Internships &amp; graduate roles</p>
          <h1 className="landing-h1">Find the role. Track the outcome.</h1>
          <p className="landing-lede">
            Browse openings across engineering, design, data and business. Apply in one place,
            and see exactly where every application stands.
          </p>
          <div className="landing-cta-row">
            <Link to="/register" className="btn btn-primary landing-cta">
              Get started
            </Link>
            <Link to="/login" className="btn btn-outline landing-cta">
              I already have an account
            </Link>
          </div>

          <div className="landing-track" aria-label="How applications are handled">
            {TRACK_STAGES.map((stage, i) => (
              <div className="landing-track-step" key={stage.label}>
                {i > 0 && (
                  <span className="landing-track-connector" aria-hidden="true">
                    →
                  </span>
                )}
                <div
                  className="landing-track-item"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`landing-track-stage ${stage.stageClass}`}>
                    <span className="landing-track-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="landing-track-label">{stage.label}</span>
                    {stage.label === 'Decision' && (
                      <span className="landing-track-outcomes">
                        <span className="badge badge-success">Approved</span>
                        <span className="badge badge-danger">Rejected</span>
                      </span>
                    )}
                  </div>
                  <p className="landing-track-caption">{stage.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="landing-section landing-domains"
        aria-labelledby="landing-domains-eyebrow"
      >
        <p className="landing-eyebrow" id="landing-domains-eyebrow">
          Domains we cover
        </p>
        <div className="landing-chip-row">
          {domains.map((domain) => (
            <span key={domain} className="badge badge-primary">
              {domain}
            </span>
          ))}
        </div>
      </section>

      <section
        className="landing-section landing-cards"
        aria-labelledby="landing-cards-heading"
      >
        <h2 className="landing-h2" id="landing-cards-heading">
          What you can do here
        </h2>
        <div className="landing-card-grid">
          <div className="card landing-do-card">
            <h3>Search and filter</h3>
            <p className="muted">
              Narrow openings by domain, type and keyword so you only see roles worth your time.
            </p>
          </div>
          <div className="card landing-do-card">
            <h3>Apply in one place</h3>
            <p className="muted">
              One application form per role, with your résumé attached or linked.
            </p>
          </div>
          <div className="card landing-do-card">
            <h3>Follow every application</h3>
            <p className="muted">
              A single dashboard showing which applications are pending, approved or rejected.
            </p>
          </div>
        </div>
      </section>

      <section
        className="landing-section landing-closing"
        aria-labelledby="landing-closing-heading"
      >
        <h2 className="landing-h2" id="landing-closing-heading">
          Ready to start applying?
        </h2>
        <p className="landing-lede landing-closing-lede">
          Create an account to browse every open role.
        </p>
        <Link to="/register" className="btn btn-primary landing-cta">
          Get started
        </Link>
      </section>
    </div>
  );
}
