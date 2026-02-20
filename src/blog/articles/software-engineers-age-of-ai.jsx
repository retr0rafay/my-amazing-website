/**
 * Software Engineers in the Age of AI
 */

import LinkWithPreview from '../../components/LinkWithPreview/LinkWithPreview'
import ShareButton from '../../components/ShareButton/ShareButton'

export const meta = {
  title: 'Software Engineers in the Age of AI',
  date: '2026-02-20',
  slug: 'software-engineers-in-the-age-of-ai',
  preview:
    'I had been writing code line by line for as long as I can remember. Whenever I would get stuck, I would go to StackOverflow to see if anyone had gone through the same issue. Never did I think that I could receive help from an AI...',
}

export default function SoftwareEngineersAgeOfAIArticle() {
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
          I had been writing code line by line for as long as I can remember. Whenever I would get stuck, I would go to StackOverflow to see if anyone had gone through the same issue. There were times where I would be stuck on a bug for hours, only to sleep on it and then solve it the next morning. Never did I think that I could receive help from an AI where I could just copy and paste the error message that I'm receiving. I knew that this would be a game changer for years to come, but it also made me think about what the future looks like for software engineers like myself.
        </p>

        <h3 className="article__subtitle">Thoughts on Cursor</h3>
        <p>
          Cursor was introduced to me by a friend who has a multi-million dollar startup, and at first I was skeptical on what it had to offer. As I was building the first version of Rounds.so, I was teaching myself the React framework. Lo and behold, Cursor was able to set up the front end for me very quickly! As time went on, I started to understand some of the patterns that the React framework has as I would split the UI into different components. It wired the frontend, backend and db very smoothly.
        </p>
        <p>
          Using AI to code definitely sped up my productivity. I would be lying if I said that it isn't great. However, I started to ask myself where my value would stand as a software engineer if Cursor or Claude Code can do work that would normally take weeks into days. But as I kept using Cursor for my development, I started to notice its flaws.
        </p>
        <p>
          For example, API keys would be hardcoded into some of the backend files, such as <code className="code-ref">settings.py</code>, instead of storing them in a <code className="code-ref">.env</code> file or in a secrets vault, such as Google Secrets Manager as well as others. This is a huge security vulnerability where hackers are waiting to jump in. If you expose your API keys or other sensitive information in your code, you are setting yourself up for many charges, and worse, access to data that is very private. The Tea App itself is an example of this, where many women's driver's licenses were stolen due to poor security practices. At other times, it would delete some files that I didn't mention to delete, and this would cause all types of headaches. Thankfully it doesn't happen as much now from what I've seen, but this is also a lesson to keep pushing code into your GitHub repo the moment you make changes. This itself will be a lifesaver for your work, just in case the AI crashes or your computer crashes.
        </p>
        <p>
          The cool thing I noticed is that you can add your own rules to Cursor, such as what design patterns to follow, what security is needed, such as not adding API keys to backend files and also provide it with best practices.           I highly recommend checking out this Git repo that has rules that you can use:{' '}
          <LinkWithPreview
            href="https://github.com/PatrickJS/awesome-cursorrules?tab=readme-ov-file"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://github.com/PatrickJS/awesome-cursorrules
          </LinkWithPreview>
          . Star this repo as a thank you to PatrickJS.
        </p>

        <h3 className="article__subtitle">What Does This Mean for Software Engineers?</h3>
        <p>
          When I first learned how to code, typing <code className="code-ref">System.out.println('Hello World')</code> felt like magic. I felt that I could do anything. I learned about compilers, operating systems, data structures, algorithms, web development and so on. I would hone these skills at all the companies that I'd work for, along with building my own company. Being able to understand a concept really well and then having it come to life was the best thing that many software engineers felt. When everything comes from your brain, where things are written on paper, translated into code, run through the compiler and shown on the screen, you feel that you gain a super power. You feel as though you want to share the knowledge that you just learned with the rest of your friends, family and colleagues. But now everyone is asking, "What super power do we have if AI is doing so much of the heavy lifting? Where do we come in?"
        </p>
        <figure className="article__figure">
          <img
            src="/assets/miscellaneous/madison-kanna-identity-tweet.png"
            alt="Tweet from Madison Kanna: 'as a software engineer, i feel a real loss of identity right now... the craft that shaped me is suddenly eclipsed by a machine. who am i now?'"
            className="article__img"
          />
          <figcaption className="article__figcaption">
            Madison Kanna (@Madisonkanna) on the identity question many engineers are asking.
          </figcaption>
        </figure>
        <p>
          I wholeheartedly believe that the best software engineers will be the ones who know how to use AI effectively. When phone cameras came out, photographers didn't go out of business. In fact, I think I see more business than ever for professional photographers! Anyone can take pictures and add filters, but there are those who are very skilled in photography, whether it's with a phone or with a heavy-grade camera. If phones took out the photography business, you wouldn't see weddings, birthdays and other special events only have videos and pictures only taken by people at the event. When a professional does that work, it feels a lot more meaningful since that person knows how to produce the best work. The same goes for software engineering. Sure, being able to come up with a prototype is easier than ever, and coding has become democratized to the masses, but what about scalability? What about caching? What about determining whether your app should be server-less? All these questions are answered by someone who knows exactly how the system comes together.
        </p>
        <p>
          I still believe that Software Engineering will continue to thrive. It's just in a readjustment period as companies are thinking about their strategy when it comes to the tech landscape of their business. With tools such as Cursor and Claude Code, the sky is the limit and now there's not really a need to ask for help on Stack Overflow or on other sites anymore. The best engineers will be those who truly understand what the code is doing, how it's organized and how the system comes together. Software engineers will mostly guide the entire process when it comes to building features or fixing bugs, while doing testing and making sure that edge cases are met. Many people have this question though. What will happen to entry-level software engineers? That is something that I will discuss on my next post.
        </p>
      </div>
    </article>
  )
}
