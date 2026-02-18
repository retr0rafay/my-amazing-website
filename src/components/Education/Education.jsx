import AnimatedSection from '../AnimatedSection'
import './Education.css'

const schools = [
  {
    name: 'Georgia Institute of Technology',
    location: 'Atlanta, GA',
    graduated: 'December 2018',
    degree: 'Master of Science in Computer Science',
    concentrations: 'Computing Systems',
  },
  {
    name: 'Georgia State University',
    location: 'Atlanta, GA',
    graduated: 'May 2016',
    degree: 'Bachelor of Science in Computer Science',
    concentrations: 'Computer Software Systems',
  },
]

export default function Education() {
  return (
    <AnimatedSection as="section" className="education section" id="education" aria-labelledby="education-heading">
      <h2 id="education-heading" className="section__title">Education</h2>
      <div className="education__grid">
        {schools.map((school) => (
          <article key={school.name} className="education__card education__terminal card">
            <div className="education__terminal-bar" aria-hidden="true">
              <div className="education__terminal-dots">
                <span className="education__terminal-dot education__terminal-dot--red" />
                <span className="education__terminal-dot education__terminal-dot--yellow" />
                <span className="education__terminal-dot education__terminal-dot--green" />
              </div>
              <span className="education__terminal-title">education — {school.name.includes('Institute') ? 'gatech' : 'gsu'}</span>
            </div>
            <div className="education__terminal-body">
              <div className="education__terminal-line">
                <span className="education__terminal-prompt">$</span>
                <span className="education__terminal-cmd"> cat education.txt</span>
              </div>
              <div className="education__terminal-line education__terminal-line--output">
                <span className="education__terminal-label">SCHOOL:</span> {school.name}
              </div>
              <div className="education__terminal-line education__terminal-line--output">
                <span className="education__terminal-label">LOCATION:</span> {school.location}
              </div>
              <div className="education__terminal-line education__terminal-line--output">
                <span className="education__terminal-label">GRADUATED:</span> {school.graduated}
              </div>
              <div className="education__terminal-line education__terminal-line--output">
                <span className="education__terminal-label">DEGREE:</span> {school.degree}
              </div>
              <div className="education__terminal-line education__terminal-line--output">
                <span className="education__terminal-label">CONCENTRATIONS:</span> {school.concentrations}
              </div>
              <div className="education__terminal-line">
                <span className="education__terminal-prompt">$</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AnimatedSection>
  )
}
