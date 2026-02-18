import { useInView } from '../../hooks/useInView'
import './AnimatedSection.css'

export default function AnimatedSection({ children, className = '', as: Component = 'div', ...props }) {
  const [ref, isInView] = useInView()

  return (
    <Component
      ref={ref}
      className={`animated-section ${isInView ? 'animated-section--visible' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  )
}
