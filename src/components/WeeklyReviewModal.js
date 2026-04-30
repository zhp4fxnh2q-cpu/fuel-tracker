/**
 * WeeklyReviewModal — Sunday review UI.
 * Shows trended weight change, avg intake, prior vs new TDEE + targets,
 * and a plain-English reasoning paragraph. Three actions: accept, skip,
 * diet break.
 */
import React, { useEffect, useState } from 'react';
import { previewReview, commitReview } from '../lib/review';

export default function WeeklyReviewModal({ open, settings, onClose, onCommitted }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const r = await previewReview(settings);
      if (cancelled) return;
      setData(r);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, settings]);

  const commit = async (action) => {
    if (!data?.preview) return;
    setBusy(true);
    const r = await commitReview({ settings, preview: data.preview, action });
    setBusy(false);
    if (r.ok) {
      onCommitted?.(r.settings);
      onClose();
    } else {
      setError(r.error?.message || 'Save failed');
    }
  };

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={header}>
          <button onClick={onClose} style={headerBtn}>Cancel</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div className="fuel-page-title" style={{ margin: 0 }}>Weekly review</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div style={{ width: 56 }} />
        </div>

        <div style={body}>
          {loading && <div className="empty">Computing…</div>}

          {!loading && data && !data.eligible && (
            <div className="fuel-card" style={{ borderColor: 'rgba(245,158,11,0.32)', background: 'var(--warn-fill)' }}>
              <div className="fuel-label" style={{ color: 'var(--warn)' }}>Not enough data yet</div>
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{data.reason}</div>
            </div>
          )}

          {!loading && data && data.eligible && data.preview && (
            <>
              <div className="fuel-card">
                <div className="fuel-label">14-day summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 10 }}>
                  <Stat label="Trended weight" value={`${signed(data.preview.trendChange)} lbs`} />
                  <Stat label="Avg daily kcal" value={`${data.preview.avgKcal.toLocaleString()}`} />
                  <Stat label="Days logged" value={`${data.daysLogged} / 14`} />
                  <Stat label="Confidence" value={data.confidence} />
                </div>
              </div>

              <div className="fuel-card" style={{ marginTop: 12 }}>
                <div className="fuel-label">TDEE estimate</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{data.preview.priorTDEE.toLocaleString()}</div>
                  <div style={{ color: 'var(--text-tertiary)' }}>→</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{data.preview.newTDEE.toLocaleString()}</div>
                  <div style={{ marginLeft: 'auto', fontSize: 12, color: data.preview.newTDEE >= data.preview.priorTDEE ? 'var(--accent)' : 'var(--warn)' }}>
                    {signed(data.preview.newTDEE - data.preview.priorTDEE)} kcal
                  </div>
                </div>
              </div>

              <div className="fuel-card" style={{ marginTop: 12 }}>
                <div className="fuel-label">Daily targets</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 10 }}>
                  <DiffStat label="Training day" prior={data.preview.priorTrainingKcal} next={data.preview.newTargets?.training?.kcal} unit="kcal" />
                  <DiffStat label="Rest day" prior={data.preview.priorRestKcal} next={data.preview.newTargets?.rest?.kcal} unit="kcal" />
                  <DiffStat label="Protein" prior="" next={data.preview.newTargets?.training?.protein_g} unit="g" />
                  <DiffStat label="Fat" prior="" next={data.preview.newTargets?.training?.fat_g} unit="g" />
                </div>
              </div>

              {data.preview.newTargets?.carb_warning && (
                <div className="fuel-card" style={{ marginTop: 12, borderColor: 'rgba(245,158,11,0.32)', background: 'var(--warn-fill)' }}>
                  <div className="fuel-label" style={{ color: 'var(--warn)' }}>Carb floor approached</div>
                  <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
                    Training-day carbs would land below the 100g floor. Consider a diet break instead of pushing the deficit deeper.
                  </div>
                </div>
              )}

              <div className="fuel-card" style={{ marginTop: 12 }}>
                <div className="fuel-label">Reasoning</div>
                <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: 'var(--text-primary)' }}>
                  {data.preview.reasoning}
                </div>
              </div>

              {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
                <button
                  onClick={() => commit('accept')}
                  disabled={busy}
                  className="fuel-btn fuel-btn-primary"
                  style={{ padding: '14px', fontSize: 15 }}
                >
                  {data.preview.adjusted ? 'Accept changes' : 'Confirm — no change'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => commit('skip')} disabled={busy} className="fuel-btn" style={{ flex: 1 }}>
                    Skip this week
                  </button>
                  <button onClick={() => commit('diet_break')} disabled={busy} className="fuel-btn" style={{ flex: 1 }}>
                    Take a diet break
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DiffStat({ label, prior, next, unit }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
        {prior !== '' && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 13 }}>{prior} → </span>}
        {next ?? '—'}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

function signed(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 250,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const sheet = {
  width: '100%', maxWidth: '36rem', height: '92vh',
  background: 'var(--bg-elev-1)',
  borderTopLeftRadius: 18, borderTopRightRadius: 18,
  border: '1px solid var(--card-border)', borderBottom: 'none',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};
const header = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '14px 12px 10px',
  borderBottom: '1px solid var(--card-border)',
};
const headerBtn = {
  background: 'transparent', border: 'none',
  color: 'var(--text-secondary)',
  fontSize: 14, fontWeight: 500,
  padding: '6px 10px', borderRadius: 8,
  cursor: 'pointer', minWidth: 56,
};
const body = { flex: 1, overflowY: 'auto', padding: '16px' };
