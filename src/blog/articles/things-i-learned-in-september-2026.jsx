/**
 * September 2026
 */

import ShareButton from '../../components/ShareButton/ShareButton'

export const meta = {
  title: 'September 2026',
  date: '2026-09-24',
  slug: 'september-2026',
  preview:
    'Five months later: Dragon Con with Tom Welling, USpot nearing beta, a viral Persona 3 unboxing, gym progress, Wolverine, and thoughts on coding with AI.',
}

export default function ThingsILearnedInSeptember2026Article() {
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
          I just realized that it&apos;s been 5 months since I&apos;ve made a post here. A lot has definitely
          happened, with my son turning 6 months, working on a new gym app for iOS and Android, and working
          on some great things at work. September has definitely been a great month, and here are some of
          the highlights.
        </p>

        <ul>
          <li>
            Went to Dragon Con and met Tom Welling, who played Clark Kent in Smallville from 2001 until
            2011. It was a surreal experience getting to meet him, especially since I always saw him on TV
            and this was the best coming-of-age show that I watched. He&apos;s a really great person and
            down to earth.
            <figure className="article__figure">
              <img
                src="/assets/miscellaneous/dragon-con-tom-welling.png"
                alt="Meeting Tom Welling at Dragon Con"
                className="article__img"
              />
              <figcaption className="article__figcaption">
                Meeting Tom Welling at Dragon Con.
              </figcaption>
            </figure>
          </li>
          <li>
            I&apos;m now getting close to beta test readiness for the fitness app. The app is called USpot,
            and basically, gym goers can not only log their workouts, but also see what their friends are
            doing, get notified when friends hit the gym or break a PR record, and even see how busy their
            gym is at any given time! They can also start group workout sessions where their friends can
            log their workouts for them, while they just focus on their workouts without taking their
            phones out. Trainers would also be able to better manage their clients, such as sending them
            workout routines, checking in with them through messaging, and keeping track of their progress.
            <figure className="article__figure">
              <video
                className="article__video"
                src="/assets/miscellaneous/uspot-demo.mp4"
                controls
                playsInline
                preload="metadata"
              />
              <figcaption className="article__figcaption">
                USpot demo walkthrough.
              </figcaption>
            </figure>
          </li>
          <li>
            I recently revived my{' '}
            <a
              href="https://www.instagram.com/gameroomsaga"
              target="_blank"
              rel="noopener noreferrer"
            >
              gamer account on Instagram
            </a>
            , and the first video that I posted went viral,
            and it&apos;s definitely my most viral post to date. I had bought the Persona 3 Reload Aigis
            Edition box set, where it came with the game, an art book, the complete soundtrack, and an
            Aigis figure. It seems as though many people really liked the{' '}
            <a
              href="https://www.instagram.com/reel/DdDKxdttHJf/"
              target="_blank"
              rel="noopener noreferrer"
            >
              unboxing that I did
            </a>
            , and there still seems to be a good amount of engagement that is rising. I&apos;ve been
            posting some more videos and photos since then, and it&apos;s been a great creative hobby of
            mine. I hope to continue going and to share valuable content for gamers.
          </li>
          <li>
            My gym routine is now back on track. I had taken some days off since I wasn&apos;t feeling well,
            but I&apos;m very much recovered. The only thing I now have to work on is eating well, because
            it&apos;s so easy to just order food or go to a restaurant.
          </li>
          <li>
            I&apos;ve been playing Marvel&apos;s Wolverine as well as The Blood of DawnWalker. I&apos;m
            honestly loving both games, but I&apos;m working on finishing Wolverine first since it&apos;s
            shorter. It&apos;s definitely a great ride, and I cannot wait to see what happens next. The
            reviews seemed to be way too harsh in my opinion, because most people who were also skeptical
            played the game and said that it wasn&apos;t as bad as what the reviews were saying. As a
            Wolverine fan, I absolutely am enjoying the game and hope to see more of Logan in future Marvel
            games by Insomniac.
            <div className="article__compare-grid">
              <figure className="article__figure article__figure--compare">
                <img
                  src="/assets/miscellaneous/marvel-wolverine-menu.png"
                  alt="Marvel's Wolverine main menu on TV"
                  className="article__img"
                />
                <figcaption className="article__figcaption">
                  Marvel&apos;s Wolverine main menu.
                </figcaption>
              </figure>
              <figure className="article__figure article__figure--compare">
                <video
                  className="article__video"
                  src="/assets/miscellaneous/blood-of-dawnwalker-cover.mp4"
                  controls
                  playsInline
                  preload="metadata"
                />
                <figcaption className="article__figcaption">
                  The Blood of Dawnwalker cover.
                </figcaption>
              </figure>
            </div>
          </li>
        </ul>

        <h3>Thoughts</h3>
        <p>
          I&apos;ve also been having some thoughts recently on the sudden change to using AI to automate our
          workflows as software engineers. To be very honest, I would be lying if I said that it hasn&apos;t
          made a huge difference in how I go about my tasks, but the one thing I really miss is getting to
          write code on my own because that feeling of accomplishment was much higher than when an AI model
          can do it for me. Sure, I can write a well thought-out prompt, mention the constraints and feed
          very specific information, but that joy just isn&apos;t there. It only comes when I see that the
          app is performing very well when there are a large number of users on it at the same time.
          It&apos;s still nice to see the features come to life, and I do get some joy out of that, but
          it&apos;s as though I click a button that completes a Lego set instead of me putting the pieces
          together and enjoying the fruits of my labor. I&apos;m still getting used to this new way of
          working as a Software Engineer, but I&apos;m glad that I learned the fundamentals and coded by
          hand before LLMs came into the picture.
        </p>

        <p>Here&apos;s what I&apos;m looking forward to in the next month:</p>
        <ol>
          <li>Get USpot live for beta testing</li>
          <li>
            Enjoy New York City, especially since I have not gone in 13 years. I&apos;m heading there for a
            work trip and I&apos;m really excited to meet everyone in person. Can&apos;t wait to explore the
            city, eat some good food, and visit old friends.
          </li>
          <li>
            Grow my gamer Instagram account to 300 followers. At the moment it&apos;s at 141, but I want to
            improve my content creation. I went from only around 20 followers to 141 within a matter of
            weeks.
          </li>
        </ol>

        <p>Thanks for reading and I&apos;ll see you in the next one!</p>
      </div>
    </article>
  )
}
