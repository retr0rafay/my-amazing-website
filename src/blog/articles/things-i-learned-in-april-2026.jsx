/**
 * Things I Learned in April 2026
 */

import ShareButton from '../../components/ShareButton/ShareButton'

export const meta = {
  title: 'Things I Learned in April 2026',
  date: '2026-04-24',
  slug: 'things-i-learned-in-april-2026',
  preview:
    'April was packed with paternity leave reflections, LLM research, practical engineering lessons, hydration habits, and progress on new AI projects.',
}

export default function ThingsILearnedInApril2026Article() {
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
          April has been quite the busy month! I&apos;m currently on paternity leave as I spend more time
          with my infant son, but I&apos;ve been diving into some tasks that are helping me stay busy as I
          enter this new age of being a parent of 2 kids.
        </p>

        <ul>
          <li>
            I&apos;ve been reading this research paper{' '}
            <a href="https://arxiv.org/pdf/2210.03629" target="_blank" rel="noopener noreferrer">
              (REACT: Synergizing Reasoning And Acting in Language Models)
            </a>{' '}
            which is a great introduction into the world of LLMs. I plan to write my own reflections after
            reading this paper, but so far, I&apos;m loving it. Basically, there used to be 2 types of LLMs:
            one for thinking, and one for acting. The acting model would take on some action without any
            thought, and the thinking model would only think within its black box, meaning that it has no
            access to the outside world when it comes to grabbing the latest information about a particular
            subject. This in turn would lead to factual hallucinations, something that can be prevented by
            having a model that can think and act synergistically. I&apos;ll talk more about this in another
            post once I finish the paper.
          </li>
          <li>
            If you&apos;re unfamiliar with a language, learn the core concepts behind what that language is
            capable of and then use AI to assist you in your work. The more you know about a language&apos;s
            intricacies, the better you&apos;ll be able to prompt the AI, consuming less tokens and saving
            money.
          </li>
          <li>
            Drink lots and lots of water. I didn&apos;t realize just how much water I wasn&apos;t consuming each
            day. I&apos;ve started to drink at least 100 oz a day, and it&apos;s been a game changer for my skin.
            Honestly, it&apos;s the simple things that give us the most results.
            <div className="article__compare-grid">
              <figure className="article__figure article__figure--compare">
                <img
                  src="/assets/miscellaneous/water-before-photo.png"
                  alt="Rafay before improving daily water intake"
                  className="article__img"
                />
                <figcaption className="article__figcaption">
                  February 2026 (before): skin and overall appearance prior to consistent hydration.
                </figcaption>
              </figure>
              <figure className="article__figure article__figure--compare">
                <img
                  src="/assets/miscellaneous/water-progress-photo.png"
                  alt="Rafay after improving daily water intake"
                  className="article__img"
                />
                <figcaption className="article__figcaption">
                  April 2026 (after): daily hydration has made a noticeable difference.
                </figcaption>
              </figure>
            </div>
          </li>
          <li>
            Started working on an extension called Site Seeker, where this extension would have a LLM that
            scans the webpage, then returns a list of Reddit threads that are related to that site&apos;s
            content. It&apos;s a great way to see what others are talking about for that particular topic on
            that website. What&apos;s left is to continue making improvements on making the LLM understand the
            context better on some sites, such as Rotten Tomatoes, where it should return a list of threads
            from Reddit that are talking about a particular movie&apos;s RT rating. I&apos;m hoping to launch this
            in May!
            <figure className="article__figure">
              <img
                src="/assets/miscellaneous/site-seeker-community.png"
                alt="Site Seeker extension showing related Reddit community threads"
                className="article__img"
              />
              <figcaption className="article__figcaption">
                Site Seeker surfacing Reddit threads related to the current page.
              </figcaption>
            </figure>
            <figure className="article__figure">
              <img
                src="/assets/miscellaneous/site-seeker-side-by-side.png"
                alt="Site Seeker running alongside an IGN article"
                className="article__img"
              />
              <figcaption className="article__figcaption">
                Site Seeker running side-by-side with an article for live context matching.
              </figcaption>
            </figure>
          </li>
          <li>
            I created my own personal assistant and I talk more about it here{' '}
            <a href="/blog/building-your-own-ai-assistant">(Building Your Own AI Assistant)</a>. It was a big
            endeavor and I dreamed of having my own digital twin that could help me with certain tasks, such
            as letting me know how much range I have in both cars at home, integrating Home Assistant to be
            able to connect to many of my devices at home such as the TVs and lights and also added voice
            support thanks to ElevenLabs. This is only accessible to me, so I would need to log in through a
            hidden endpoint which would allow me to then be able to access my bot. The bot is available
            publicly, but certain features such as locking and unlocking my car can only be done by me, and
            I have security measures for that. I&apos;ll be upgrading the agent as I continue to add more
            context to it.
            <figure className="article__figure">
              <img
                src="/assets/miscellaneous/personal-bot-ui.png"
                alt="Rafay Bot interface showing secure personal assistant dashboard"
                className="article__img article__img--app-screenshot"
              />
              <figcaption className="article__figcaption">
                Personal bot UI.
              </figcaption>
            </figure>
          </li>
        </ul>

        <p>
          It has been quite the busy month, and I have a little over 2 weeks left of my parental leave so
          I&apos;m working on making the most of it with my family. I&apos;ll probably be exploring the North Georgia
          mountains with my family during the remainder of my parental leave, so I&apos;m really looking forward
          to reflecting over some things and having a nice reset.
        </p>

        <p>Thank you for reading and I will see you next month!</p>
      </div>
    </article>
  )
}
