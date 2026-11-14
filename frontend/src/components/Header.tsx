// App header: brand, navigation, "Show the engine" switch and actor picker.
import { NavLink } from 'react-router-dom';
import { Cpu, ShieldHalf } from 'lucide-react';
import { useReviewers } from '../api/hooks';
import { ROLE_LABEL } from '../labels';
import { useSession } from '../session';

export function Header() {
  const { actorId, changeActor, engine, setEngine } = useSession();
  const reviewers = useReviewers(actorId);
  return (
    <header className="topbar">
      <NavLink to="/" className="brand">
        <ShieldHalf size={22} aria-hidden /> Integrity Desk
      </NavLink>
      <nav aria-label="Main" className="nav">
        <NavLink to="/" end>Queue</NavLink>
        <NavLink to="/rules">Rules</NavLink>
        <NavLink to="/audit">Audit</NavLink>
      </nav>
      <div className="topbar-tools">
        <button
          type="button"
          role="switch"
          aria-checked={engine}
          className={engine ? 'switch on' : 'switch'}
          onClick={() => setEngine(!engine)}
        >
          <Cpu size={16} aria-hidden /> Show the engine
          <span className="switch-track" aria-hidden><span className="switch-knob" /></span>
        </button>
        <label className="actor">
          <span className="sr-only">Acting as</span>
          <select value={actorId} onChange={(e) => changeActor(e.target.value)}>
            {!reviewers.data?.some((r) => r.reviewer_id === actorId) && <option value={actorId}>{actorId}</option>}
            {reviewers.data?.map((r) => (
              <option key={r.reviewer_id} value={r.reviewer_id}>
                {r.name} · {ROLE_LABEL[r.role]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
