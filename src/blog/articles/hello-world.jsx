/**
 * Hello, World! — first blog post.
 */

const LOGOS_BASE = '/assets/companies'

const companies = [
  { name: 'General Motors', logo: 'general-motors.png' },
  { name: 'The Home Depot', logo: 'home-depot.png' },
  { name: 'Salesforce', logo: 'salesforce.png' },
  { name: 'Rounds.so', logo: 'rounds.png' },
  { name: 'Flexbone', logo: 'flexbone.png' },
  { name: 'GreenSpark (Current)', logo: 'greenspark.png' },
]

export const meta = {
  title: 'Hello, World!',
  date: '2025-02-18',
  slug: 'hello-world',
  preview:
    'For those of you who are visiting, I\'ve been a software engineer for almost 10 years as of this article\'s publishing and I\'ve worked at a variety of companies...',
}

export default function HelloWorldArticle() {
  return (
    <article className="article">
      <header className="article__header">
        <h2 className="article__title">{meta.title}</h2>
        <time className="article__date" dateTime={meta.date}>
          {meta.date}
        </time>
      </header>
      <div className="article__body">
        <p>
          For those of you who are visiting, I've been a software engineer for almost 10 years as of this article's publishing and I've worked at a variety of companies, such as:
        </p>
        <ul className="article__companies">
          {companies.map(({ name, logo }) => (
            <li key={name} className="article__company">
              <img
                src={`${LOGOS_BASE}/${logo}`}
                alt=""
                className="article__company-logo"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
              <span className="article__company-name">{name}</span>
            </li>
          ))}
        </ul>
        <p>
          I've worked across many different tech stacks, but my specialty is in the backend. What I enjoy about the backend is that we can take in all this data, modify it in a certain way, transfer it to another service and store it all in a database! My favorite DB has been Postgres and I absolutely enjoy all that it has to offer. My website is made with React, divided up into different components and deployed in repl.it. I'm super excited to share all my thoughts here regarding tech and other things.
        </p>
        <p>
        One thing to note is that I will NEVER use AI to write my posts. I wholeheartedly believe that AI is a powerful tool that can be used to help us, but it should never be used to replace human thought.

        </p>
        <p>
          In my free time, I like to spend time with my family, exercise, play video games and explore different parks. I hope to one day head to Yosemite and YellowStone National Park!
        </p>
        <p>
          Thank you for visiting, and I look forward to seeing you here again soon once my next post is up!
        </p>
      </div>
    </article>
  )
}
