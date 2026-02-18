import AnimatedSection from '../AnimatedSection'
import './Experience.css'

// Simple Icons CDN (brand colors); use iconUrl for icons that don't load (e.g. AWS)
const ICONS_CDN = 'https://cdn.simpleicons.org'

function TechIcon({ name, slug, iconUrl }) {
  const url =
    iconUrl ||
    `${ICONS_CDN}/${slug || name.toLowerCase().replace(/\s+/g, '')}`
  return (
    <span className="experience__tech-item" title={name}>
      <img src={url} alt="" className="experience__tech-icon" width={20} height={20} />
      <span className="experience__tech-name">{name}</span>
    </span>
  )
}

const jobs = [
  {
    title: 'Software Engineer',
    company: 'GreenSpark Software',
    period: 'Feb. 2026 – Present',
    current: true,
    tech: [
      {
        name: 'AWS',
        iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg',
      },
      { name: 'TypeScript', slug: 'typescript' },
      { name: 'React', slug: 'react' },
    ],
  },
  {
    title: 'Software Engineer',
    company: 'Flexbone',
    period: 'Oct. 2025 – Present',
    current: true,
    tech: [
      { name: 'Python', slug: 'python' },
      { name: 'React', slug: 'react' },
      { name: 'GCP', slug: 'googlecloud' },
    ],
  },
  {
    title: 'Co-Founder & CTO',
    company: 'Rounds.so',
    period: 'Sep. 2024 – Present',
    tech: [
      { name: 'React', slug: 'react' },
      { name: 'Python', slug: 'python' },
      { name: 'Flask', slug: 'flask' },
      { name: 'PostgreSQL', slug: 'postgresql' },
      { name: 'Stripe', slug: 'stripe' },
      { name: 'Docker', slug: 'docker' },
      { name: 'Grafana', slug: 'grafana' },
      { name: 'Prometheus', slug: 'prometheus' },
    ],
  },
  {
    title: 'Software Engineer',
    company: 'Salesforce',
    period: 'Jan. 2020 – Sep. 2025',
    tech: [
      { name: 'Python', slug: 'python' },
      { name: 'Java', slug: 'openjdk' },
    ],
  },
  {
    title: 'Software Engineer',
    company: 'The Home Depot',
    period: 'Oct. 2017 – Dec. 2019',
    tech: [{ name: 'Java', slug: 'openjdk' }],
  },
]

export default function Experience() {
  return (
    <AnimatedSection as="section" className="experience section" id="experience" aria-labelledby="experience-heading">
      <header className="experience__section-header">
        <h2 id="experience-heading" className="section__title">Work Experience</h2>
        <p className="experience__subtitle">// career timeline</p>
      </header>
      <div className="experience__list">
        {jobs.map((job) => (
          <article
            key={`${job.company}-${job.period}`}
            className={`experience__card experience__terminal card ${job.current ? 'experience__card--current' : ''}`}
          >
            <div className="experience__terminal-bar" aria-hidden="true">
              <div className="experience__terminal-dots">
                <span className="experience__terminal-dot experience__terminal-dot--red" />
                <span className="experience__terminal-dot experience__terminal-dot--yellow" />
                <span className="experience__terminal-dot experience__terminal-dot--green" />
              </div>
              <span className="experience__terminal-title">
                {job.company}
                {job.current && <span className="experience__current-badge" aria-label="Current position"> · current</span>}
              </span>
            </div>
            <div className="experience__terminal-body">
              <div className="experience__role-line">
                <span className="experience__prompt">$</span>
                <span className="experience__role">{job.title}</span>
                <span className="experience__period">{job.period}</span>
              </div>
              {job.tech?.length > 0 && (
                <div className="experience__tech">
                  {job.tech.map((t) => (
                    <TechIcon key={t.name} name={t.name} slug={t.slug} iconUrl={t.iconUrl} />
                  ))}
                </div>
              )}
              <div className="experience__cursor-line">
                <span className="experience__prompt">$</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AnimatedSection>
  )
}
