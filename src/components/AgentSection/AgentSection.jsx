import { useMemo, useState } from 'react'
import AnimatedSection from '../AnimatedSection'
import './AgentSection.css'

function buildCurlExample(origin) {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'message/send',
    params: {
      message: {
        parts: [{ kind: 'text', text: 'Who is Rafay?' }],
      },
    },
  }
  const json = JSON.stringify(payload)
  return `curl -X POST ${origin}/api/a2a \\
  -H "Content-Type: application/json" \\
  -d '${json}'`
}

export default function AgentSection({ embedded = false }) {
  const [copied, setCopied] = useState(false)

  const curlExample = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://rafaysyed.dev'
    return buildCurlExample(origin)
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(curlExample)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <AnimatedSection
      as={embedded ? 'div' : 'section'}
      role={embedded ? 'region' : undefined}
      className={`agent-section ${embedded ? 'agent-section--embedded' : 'section'}`}
      id="agent"
      aria-labelledby="agent-heading"
    >
      <div className="agent-section__surface">
        <header className="agent-section__header">
          <div className="agent-section__header-main">
            <div className="agent-section__title-row">
              <span className="agent-section__bot-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="agent-section__bot-svg">
                  <path
                    className="agent-section__bot-antenna"
                    d="M24 4v8M20 4h8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle className="agent-section__bot-antenna-tip" cx="24" cy="4" r="2" fill="currentColor" />
                  <rect
                    className="agent-section__bot-head"
                    x="10"
                    y="14"
                    width="28"
                    height="24"
                    rx="6"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle className="agent-section__bot-eye agent-section__bot-eye--l" cx="19" cy="24" r="2.5" fill="currentColor" />
                  <circle className="agent-section__bot-eye agent-section__bot-eye--r" cx="29" cy="24" r="2.5" fill="currentColor" />
                  <path
                    className="agent-section__bot-mouth"
                    d="M19 32h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div className="agent-section__title-stack">
                <p className="agent-section__subtitle">{'// a2a & discovery'}</p>
                <h2 id="agent-heading" className="agent-section__headline">
                  Site agent
                </h2>
                <div className="agent-section__bot-pulse" aria-hidden="true">
                  <span className="agent-section__bot-pulse-dot" />
                  <span className="agent-section__bot-pulse-dot" />
                  <span className="agent-section__bot-pulse-dot" />
                </div>
              </div>
            </div>
          </div>
          <p className="agent-section__status-pill" role="status">
            <span className="agent-section__status-dot" aria-hidden="true" />
            <span className="agent-section__status-label">Online</span>
          </p>
        </header>

        <p className="agent-section__lede">
          Other agents can POST JSON-RPC to this domain and get a short reply about me. Discovery:{' '}
          <a href="/llms.txt" className="agent-section__inline">
            llms.txt
          </a>{' '}
          and{' '}
          <a href="/.well-known/agent.json" className="agent-section__inline">
            agent.json
          </a>
          .
        </p>

        <div className="agent-section__terminal card">
          <div className="agent-section__terminal-bar" aria-hidden="true">
            <div className="agent-section__terminal-left">
              <div className="agent-section__terminal-dots">
                <span className="agent-section__terminal-dot agent-section__terminal-dot--red" />
                <span className="agent-section__terminal-dot agent-section__terminal-dot--yellow" />
                <span className="agent-section__terminal-dot agent-section__terminal-dot--green" />
              </div>
              <span className="agent-section__terminal-title">POST /api/a2a · message/send</span>
            </div>
          </div>
          <div className="agent-section__terminal-body">
            <pre className="agent-section__code">
              {curlExample}
              <span className="agent-section__cursor" aria-hidden="true" />
            </pre>
            <button
              type="button"
              className="agent-section__copy"
              onClick={handleCopy}
              aria-label={copied ? 'Copied to clipboard' : 'Copy curl command'}
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="agent-section__chips" role="list">
          <a className="agent-section__chip" href="/llms.txt" role="listitem">
            <span className="agent-section__chip-label">llms.txt</span>
            <span className="agent-section__chip-meta">LLM index</span>
          </a>
          <a className="agent-section__chip" href="/.well-known/agent.json" role="listitem">
            <span className="agent-section__chip-label">agent.json</span>
            <span className="agent-section__chip-meta">Discovery</span>
          </a>
        </div>
      </div>
    </AnimatedSection>
  )
}
