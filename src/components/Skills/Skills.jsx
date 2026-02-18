import AnimatedSection from '../AnimatedSection'
import './Skills.css'

const skillGroups = [
  { label: 'Coding', icon: 'code', items: ['Python', 'Java', 'PHP', 'C#', 'JavaScript', 'SQL'] },
  { label: 'Software', icon: 'tools', items: ['Linux', 'Eclipse', 'IntelliJ IDEA', 'PyCharm', 'Microsoft Visual Studio'] },
  { label: 'DevOps & Tools', icon: 'pipeline', items: ['Docker', 'Cassandra', 'Jenkins', 'GitHub', 'Grafana', 'Prometheus', 'CI/CD Pipelines', 'Linux'] },
  { label: 'Databases & Cloud', icon: 'database', items: ['PostgreSQL', 'Google Cloud Storage', 'Firebase', 'Microsoft SQL Server', 'Cassandra'] },
]

function CodeIcon() {
  return (
    <svg className="skills__category-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function ToolsIcon() {
  return (
    <svg className="skills__category-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg className="skills__category-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4v8H2z" />
      <path d="M10 4h4v16h-4z" />
      <path d="M18 8h4v12h-4z" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg className="skills__category-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

const iconMap = { code: CodeIcon, tools: ToolsIcon, pipeline: PipelineIcon, database: DatabaseIcon }

export default function Skills() {
  return (
    <AnimatedSection as="section" className="skills section" id="skills" aria-labelledby="skills-heading">
      <header className="skills__header">
        <h2 id="skills-heading" className="section__title">Skills</h2>
        <p className="skills__subtitle">// tech stack · CS fundamentals</p>
      </header>
      <div className="skills__grid">
        {skillGroups.map((group, groupIndex) => {
          const IconComponent = iconMap[group.icon]
          return (
            <div key={group.label} className="skills__card card">
              <div className="skills__card-inner">
                <div className="skills__category">
                  {IconComponent && <IconComponent />}
                  <h3 className="skills__label">{group.label}</h3>
                </div>
                <ul className="skills__list">
                  {group.items.map((item, i) => (
                    <li key={item} className="skills__pill">
                      <span className="skills__pill-text">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </AnimatedSection>
  )
}
