import { useEffect, useMemo, useState } from 'react'
import { mission, milestones } from './mission'
import collectionHealth from '../data/collection-health.json'

function useMissionElapsed() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return useMemo(() => {
    const elapsedMs = Math.max(0, now - new Date(mission.launchTime).getTime())
    const totalSeconds = Math.floor(elapsedMs / 1000)
    const days = Math.floor(totalSeconds / 86_400)
    const hours = Math.floor((totalSeconds % 86_400) / 3_600)
    const minutes = Math.floor((totalSeconds % 3_600) / 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds }
  }, [now])
}

function formatElapsedPart(value: number) {
  return value.toString().padStart(2, '0')
}

function statusLabel(status: string) {
  switch (status) {
    case 'complete':
      return 'Complete'
    case 'upcoming':
      return 'Upcoming'
    case 'conditional':
      return 'If needed'
    case 'not_required':
      return 'Not required'
    case 'awaiting_confirmation':
      return 'Awaiting confirmation'
    default:
      return 'Planned'
  }
}

function publicationDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }) : 'Date unavailable'
}

export default function App() {
  const elapsed = useMissionElapsed()
  const checkedAt = collectionHealth.lastSuccessfulCheckAt as string | null
  const age = checkedAt ? Date.now() - Date.parse(checkedAt) : NaN
  const validCheck = Number.isFinite(age) && age >= 0
  const minutes = Math.floor(age / 60000)
  const checkedAgo = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} minute${minutes === 1 ? '' : 's'} ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) === 1 ? '' : 's'} ago` : `${Math.floor(minutes / 1440)} day${Math.floor(minutes / 1440) === 1 ? '' : 's'} ago`
  const fresh = Number.isFinite(age) && age >= 0 && age <= collectionHealth.staleAfterHours * 3600000

  return (
    <main className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">NASA · Nancy Grace Roman Space Telescope</p>
          <h1>Roman Mission Monitor</h1>
          <p className="lede">
            Following Roman from launch through commissioning and onward to science.
          </p>
        </div>
        <a className="nasa-link" href={mission.nasaMissionPage} target="_blank" rel="noreferrer">
          NASA mission page ↗
        </a>
      </header>

      <section className="status-grid" aria-label="Mission status">
        <article className="status-card status-primary">
          <span className="label">Current phase</span>
          <strong>{mission.phase}</strong>
          <span className="subtle">Destination: {mission.destination}</span>
        </article>

        <article className="status-card">
          <span className="label">Mission elapsed time</span>
          <div className="elapsed" aria-label={`${elapsed.days} days ${elapsed.hours} hours ${elapsed.minutes} minutes ${elapsed.seconds} seconds`}>
            <span><strong>{elapsed.days}</strong><small>days</small></span>
            <span><strong>{formatElapsedPart(elapsed.hours)}</strong><small>hours</small></span>
            <span><strong>{formatElapsedPart(elapsed.minutes)}</strong><small>min</small></span>
            <span><strong>{formatElapsedPart(elapsed.seconds)}</strong><small>sec</small></span>
          </div>
        </article>

        <article className="status-card">
          <span className="label">Latest confirmed milestone</span>
          <strong>{mission.latestHeadline}</strong>
          <span className="subtle">Reported {publicationDate(mission.latestPublishedAt)}</span>
          <a href={mission.latestSource} target="_blank" rel="noreferrer">NASA update ↗</a>
        </article>
      </section>

      <div role="status" aria-atomic="true">
        {!fresh && (
          <p className="freshness-warning">
            {validCheck ? 'Source checks are overdue; information may be outdated.' : 'Source freshness is unavailable; information may be outdated.'}
          </p>
        )}
      </div>

      <section className="journey-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Journey</p>
            <h2>Earth → Sun–Earth L2</h2>
          </div>
          <span className="journey-meta">~1 million miles · insertion {mission.orbitalInsertionTiming}</span>
        </div>

        <div className="journey-line" aria-hidden="true">
          <div className="earth">EARTH</div>
          <div className="track">
            <div className="rocket" title="Roman">◆</div>
          </div>
          <div className="l2">L2</div>
        </div>
        <p className="disclaimer">
          This is a mission-status visualization, not live spacecraft telemetry. Position is intentionally not inferred from elapsed time.
        </p>
      </section>

      <section className="content-grid">
        <div className="timeline-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Commissioning</p>
              <h2>Mission timeline</h2>
            </div>
            <a href={mission.commissioningPage} target="_blank" rel="noreferrer">NASA commissioning ↗</a>
          </div>

          <ol className="timeline">
            {milestones.map((milestone) => (
              <li key={milestone.id} className={`timeline-item ${milestone.status}`}>
                <div className="timeline-marker" aria-hidden="true" />
                <div className="timeline-body">
                  <div className="timeline-title-row">
                    <h3>{milestone.title}</h3>
                    <span className={`status-pill ${milestone.status}`}>{statusLabel(milestone.status)}</span>
                  </div>
                  <p className="timing">{milestone.timing}</p>
                  <p>{milestone.description}</p>
                  <a href={milestone.source} target="_blank" rel="noreferrer">Source ↗</a>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="latest-panel">
          <p className="eyebrow">Latest official update</p>
          <h2>{mission.latestArticle.title}</h2>
          <p className="subtle">Published {publicationDate(mission.latestArticle.publishedAt)}</p>
          <p>{mission.latestArticle.summary}</p>
          <dl>
            <div>
              <dt>Launch</dt>
              <dd>30 Aug 2026 · 11:26 UTC</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{mission.destination}</dd>
            </div>
            <div>
              <dt>Insertion</dt>
              <dd>{mission.orbitalInsertionTiming}</dd>
            </div>
          </dl>
          <a className="button-link" href={mission.latestArticle.source} target="_blank" rel="noreferrer">
            Read NASA update ↗
          </a>
        </aside>
      </section>

      <footer>
        <div className="footer-meta">
          <details className="freshness-details">
            <summary>
              <span>{validCheck ? `Sources checked ${checkedAgo}` : 'Source check time unavailable'}</span>
              <span className="details-label">Details</span>
            </summary>
            <div className="freshness-explanation">
              {validCheck && <p>Last successful check: <time dateTime={checkedAt!}>{new Date(checkedAt!).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time>.</p>}
              <p>Checks run hourly. Data is marked stale after {collectionHealth.staleAfterHours} hours. A successful check does not imply new mission news.</p>
            </div>
          </details>
          <span>Unofficial project using public NASA mission information.</span>
        </div>
        <a href="https://github.com/rmlowe/roman-mission-monitor" target="_blank" rel="noreferrer">Source on GitHub ↗</a>
      </footer>
    </main>
  )
}
