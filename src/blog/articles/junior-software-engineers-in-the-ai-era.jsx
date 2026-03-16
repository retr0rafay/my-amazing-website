/**
 * Junior Software Engineers in the AI Era
 */

import LinkWithPreview from '../../components/LinkWithPreview/LinkWithPreview'
import ShareButton from '../../components/ShareButton/ShareButton'

export const meta = {
  title: 'Junior Software Engineers in the AI Era',
  date: '2026-03-16',
  slug: 'junior-software-engineers-in-the-ai-era',
  preview:
    'Juniors serve as the backbone and future of tech. At least this is how it should be. If you do not have someone to learn, grow and expand their knowledge of the system, there won’t be anyone to replace the senior engineers.',
}

export default function JuniorSoftwareEngineersInTheAIEraArticle() {
  return (
    <article className="article">
      <header className="article__header">
        <div className="article__header-row">
          <h2 className="article__title">{meta.title}</h2>
          <ShareButton />
        </div>
        <time className="article__date" dateTime={meta.date}>
          {meta.date}
        </time>
      </header>
      <div className="article__body">
        <p>
          Juniors serve as the backbone and future of tech. At least this is how it should be. If you do not have someone to learn, grow and expand their knowledge of the system, there won’t be anyone to replace the senior engineers who may go into retirement or switch companies. The best scenario is having juniors learn from seniors and continue to grow in their career.
        </p>

        <figure className="article__figure">
          <img
            src="/assets/miscellaneous/you-can-do-it-jr-devs.jpg"
            alt="Illustration encouraging junior developers that they can do it"
            className="article__img"
          />
          <figcaption className="article__figcaption">
            You can do it, junior developers - keep going.
          </figcaption>
        </figure>

        <p>
          I’ve been hearing many things lately regarding the future of junior software engineers and whether companies will need to hire them, especially since AI tools are capable of producing output much faster. Here is where I stand with all this:
        </p>
        <ul>
          <li>Without juniors, you have no one to help shape the future of the company</li>
          <li>There is no career growth if a company only sticks with seniors who can use AI very well</li>
          <li>AI tools are very helpful, but they are not perfect, and you still need humans to guide the process</li>
          <li>Just as a baby learns to crawl before walking, you need to invest in juniors who can learn the basics before they can take on larger tasks</li>
        </ul>

        <figure className="article__figure">
          <img
            src="/assets/miscellaneous/dev-stages.png"
            alt="Developer Stages infographic: Junior (Learning by Fire), Mid-Level (Mastering the Flow), and Senior (The Grand Architect)"
            className="article__img"
          />
          <figcaption className="article__figcaption">
            Developer stages - from learning by fire to the grand architect.
          </figcaption>
        </figure>

        <h3 className="article__subtitle">What I Would Do If I Was a Junior Engineer</h3>
        <p>
          Before I talk about what I would do, I want to start off by saying that I graduated in 2016 with my bachelor’s in Computer Science, a time when it was not as difficult to land a job compared to 2026. I did not have an active Github, nor was my LinkedIn active. All I needed was a bachelor’s degree and that was enough for me to get my foot in the door.
        </p>
        <p>
          Now, I see juniors or college students posting daily or weekly over what projects they’re working on or what events they are attending in order to get their name out. LinkedIn has made it easier to get noticed by others especially when you consistently post about something that could provide value. When I think about this, I realize just how far the goal posts have moved when it comes to landing a job right out of graduation, or at least landing an internship that could lead to a full-time offer.
        </p>
        <p>
          Hearing about layoffs from Atlassian, Block, Amazon, Salesforce, Google and Meta isn’t something that helps ease tensions either. For many people, these are the dream companies that they would want to be in, due to high compensation packages and world-class benefits. However, I learned over time that it’s better to have a dream role rather than a dream company because you want to enjoy the work that you do and be obsessed with improving your craft. When you do that, you are setting yourself up to be hirable no matter where you go.
        </p>

        <p>
          Now, back to what I would personally do if I was a junior or in college in 2026:
        </p>
        <ol>
          <li>
            Understand programming patterns deeply, especially object-oriented programming. This is what’s commonly used throughout the industry.
          </li>
          <li>
            Once you understand programming patterns, you will be able to write better prompts when you tell the LLM what to do. You will be able to maximize the LLM’s capabilities as you get better at prompting and reviewing code. I highly recommend checking out Esco Obong’s article:{' '}
            <LinkWithPreview
              href="https://www.linkedin.com/pulse/writing-high-quality-production-code-llms-solved-problem-esco-obong-odx7f/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Writing High Quality Production Code with LLMs is a Solved Problem
            </LinkWithPreview>
            .
          </li>
          <li>
            I know this one might not be taken well, but practice Leetcode daily. We can get into this whole discussion about whether Leetcode measures how well an engineer can perform on the job (it doesn’t), but it’s the gateway to getting many offers that can be life-changing. If you treat Leetcode problems as challenges rather than preparing for interviews, you’ll have much more fun doing them. I will say that Leetcode problems improve your problem-solving skills.
          </li>
          <li>
            Start reading Designing Data Intensive Applications by Martin Kleppmann. It’s the only book you will ever need to understand distributed systems and it will help you with understanding system design.
          </li>
          <li>
            Network as much as you can. 3 out of the 5 companies I’ve worked at were possible because of referrals. I remember applying to one company 5 times before I got an interview, because the last try had a referral tied to it.
          </li>
          <li>
            Get feedback on your resume from at least 3 people who are in the industry. They can very much help you tailor your resume in a way that can increase your chances of landing that interview.
          </li>
          <li>
            Keep sharing what you are doing on LinkedIn. This helps for exposure and others can see just how invested you are in your education.
          </li>
          <li>
            If you’re in school, take advantage of as many opportunities as you can, whether it’s going to the teachers’ office hours, presenting yourself at a career fair, attending events related to your field, etc. This can have a ripple effect over the opportunities that can arise.
          </li>
          <li>
            Participate in hackathons. This is something I wish I did back in school. Hackathons are a haven for meeting with like-minded people and building cool stuff that you can showcase.
          </li>
        </ol>

        <p>
          I hope that these tips help and if you feel that it’s valuable, please feel free to share with others!
        </p>
      </div>
    </article>
  )
}