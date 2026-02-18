import AnimatedSection from '../AnimatedSection'
import './ResumeCTA.css'

// Replace with your Google Drive resume link (use "Share" → "Anyone with the link" for view/download)
const RESUME_URL = 'https://drive.google.com/file/d/YOUR_FILE_ID/view'

export default function ResumeCTA() {
  return (
    <AnimatedSection as="section" className="resume-cta section" aria-labelledby="resume-cta-heading">
      <p id="resume-cta-heading" className="resume-cta__text">Want to Know More?</p>
      <a
        href={RESUME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="resume-cta__button"
      >
        Download My Resume!
      </a>
    </AnimatedSection>
  )
}
