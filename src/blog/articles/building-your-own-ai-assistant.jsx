/**
 * Building Your Own AI Assistant Is Already Possible
 */

import ShareButton from '../../components/ShareButton/ShareButton'

export const meta = {
  title: 'Building Your Own AI Assistant Is Already Possible',
  date: '2026-04-10',
  slug: 'building-your-own-ai-assistant',
  preview:
    'Since LLMs have come into the picture, it has never been easier to build your own personal assistant—control devices, get reminders, and remember what you often forget. Here is an overview of how you can build one.',
}

export default function BuildingYourOwnAIAssistantArticle() {
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
          Since LLMs have come into the picture, it has never been easier to build your own personal assistant that can do things such as control devices in your home, send you reminders and remember things that you may often forget. This assistant can be your &quot;second brain&quot;, as author and productivity expert Tiago Forte puts it. In this article, I&apos;m giving an overview on how you can build your own AI assistant to make your life much easier.
        </p>

        <figure className="article__figure">
          <img
            src="/assets/miscellaneous/rafay-bot-assistant-ui.png"
            alt="Rafay Bot assistant: dark UI with cyan accents and grid background, chat panel with integrations for Anthropic, ElevenLabs, Tesla Fleet, Firebase, and Google, plus suggested prompts and message input"
            className="article__img article__img--app-screenshot"
            loading="lazy"
            decoding="async"
          />
          <figcaption className="article__figcaption">
            The personal assistant UI on my site—scoped chat, integrations, and A2A-backed tools.
          </figcaption>
        </figure>

        <h3 className="article__subtitle">What Should Your Agent Do?</h3>
        <p>
          This is the first question that you should ask, right before getting into the code. Instead of having a general-purpose agent that can answer everything, think about how you can customize it for your needs, otherwise it would not be any different than using ChatGPT or Claude. Do you want it to:
        </p>
        <ul>
          <li>Automate devices in your home, such as light switches and TVs?</li>
          <li>Give you information on how much mileage you have in order to decide whether you can make an upcoming trip?</li>
          <li>Remind you of your meetings throughout the day?</li>
          <li>Alert you with any reminders that you&apos;ve set for yourself?</li>
          <li>Store information about any appointments for you and your dependents?</li>
        </ul>
        <p>
          The list is definitely endless, but this list is similar to the use cases that I was thinking about when building my own agent. Once you have a list of what use cases you want your agent to solve, research whether there are any open-source or paid APIs that you can integrate, depending on your budget.
        </p>
        <p>From the list I provided above, here are the APIs that can be used to solve them:</p>
        <ul>
          <li>
            <a href="https://www.home-assistant.io" target="_blank" rel="noopener noreferrer">
              Home Assistant
            </a>
          </li>
          <li>
            <a href="https://developer.tesla.com" target="_blank" rel="noopener noreferrer">
              Tesla Fleet
            </a>
          </li>
          <li>Google Calendar API (activate on GCP console)</li>
          <li>Store in a Google Sheet (for simplicity)</li>
          <li>Notion API or similar (depends on where you store this info)</li>
        </ul>
        <p>
          Once you find the APIs that can be integrated with your agent, check whether the cost of calling those APIs fits within your budget. Thankfully, computing costs are not that high, but some services, such as Home Assistant, require a monthly or yearly fee. With other API services, you can set a limit on how much you want to pay per month, such as $10, and then if it gets past that threshold, you get a message that lets you know that you&apos;ve already hit your limit and you can always increase it.
        </p>

        <h3 className="article__subtitle">Choosing an AI Model To Run Your Agent</h3>
        <p>
          The AI model will serve as the basis for communicating with your agent, whether you use Claude, Gemini or GPT. Personally, I chose Claude. When you decide which model you will use, generate an API key that will be used to call it.
        </p>

        <h3 className="article__subtitle">Files for Your Agent</h3>
        <p>
          When you have many APIs that are being integrated into your agent, it&apos;s best practice to create a dedicated folder. To keep it simple, just call it <code>api</code> and have all your integrations within that directory. In this manner, you can keep your integrations separate from the other logic within your code. You would not want to mix everything up. That would be a recipe for disaster and it would be very hard to maintain. I&apos;ve personally seen codebases where the backend would be hosted on just one file. You heard that right. It would contain all of the queries, APIs and services all in one place, which was a huge jumbled mess. If your software isn&apos;t a prototype, it&apos;s best to have those separation of concerns.
        </p>
        <p>
          The other file you should have for local testing is <code>.env</code>. This file houses all of your API keys. Do not, and I mean do not feed this into your LLM or anywhere else in your codebase. It&apos;s almost as if you&apos;re giving the public multiple copies of your house keys if you do that. If any of your API keys get compromised, rotate them ASAP. In production, depending on the service that is running your app, such as GCP or AWS, they each have their own secrets manager where you can store these keys. This practice is very secure and you never want these keys to be published in your repo. The app itself will grab the values that are in the secrets manager.
        </p>
        <p>
          If you would like outside agents to interact with yours, you will need an <code>agent.json</code> file that tells other agents what your agent is, protocol details (such as JSON-RPC), example prompts and where to call it. It&apos;s like an API &quot;business card&quot;. If you have certain skills for your agent that need to be gated, make sure to only have those skills accessible by the authenticated users who are eligible to call them. Another file, <code>llms.txt</code>, is a text-readable file that tells other users about your agent and it&apos;s good for discoverability. Not all LLM crawlers can parse agent-card schemes (<code>agent.json</code>) well, so it&apos;s good to have both to have support across many ecosystems.
        </p>
        <figure className="article__figure">
          <pre className="article__pre" aria-label="Example project layout for agent-related files">
            {`agent/
├── .env                          # secrets locally; gitignored
├── server.js                     # production static + API mount
├── api/                          # integrations & routes
│   ├── server.js                 # dev API process - not used in production
│   ├── a2a.js
│   ├── a2aCore.js
│   ├── authOwner.js
│   ├── googleHomeBridge.js
│   ├── haven.js
│   ├── homeAssistantClient.js
│   ├── ownerChat.js
│   ├── ownerTts.js
│   ├── teslaChargeNotify.js
│   ├── teslaTripEstimate.js
│   └── ttsStrip.js
└── public/
    ├── llms.txt
    └── .well-known/
        └── agent.json`}
          </pre>
          <figcaption className="article__figcaption">
            Example layout on this site: API modules under <code>api/</code>, discoverability under <code>public/</code>, secrets in <code>.env</code> only on your machine.
          </figcaption>
        </figure>

        <h3 className="article__subtitle">Tech Stack</h3>
        <p>
          Agents can be supported by a wide variety of programming languages, but it&apos;s up to you as the individual on which tech stack you want to use. Here is what I use for my agent:
        </p>
        <ul>
          <li>Frontend: React</li>
          <li>Backend runtime: Node.js</li>
          <li>LLM provider: Anthropic</li>
          <li>Agent protocol: JSON-RPC style A2A endpoint (<code>/api/a2a</code>)</li>
          <li>Auth / gating: Header secrets + Firebase Auth</li>
        </ul>

        <h3 className="article__subtitle">How Does a Personal Agent Work?</h3>
        <p>
          Think of your agent as an assistant that has access to many things, such as your calendar, your car keys, your devices and so on. When you tell it what to do, it has to decide exactly which task to complete based on the prompt that is given. For example, if I tell my agent, &quot;Turn off the kitchen lights&quot;, it should be able to only turn off the kitchen lights without turning off lights elsewhere. Here is a diagram on how that agent works:
        </p>
        <figure className="article__figure">
          <img
            src="/assets/miscellaneous/a2a_cartoon_flow.svg"
            alt="A2A cartoon flow: caller sends JSON-RPC to Express router, auth gate, Claude and tool loop, then reply"
            className="article__img article__img--flow-diagram"
            width={680}
            height={1020}
            loading="lazy"
            decoding="async"
          />
          <figcaption className="article__figcaption">
            High-level flow from caller through the A2A router to the model and tools (illustrated).
          </figcaption>
        </figure>
        <p>
          When you send a message to the agent, that message will be formatted in a JSON-RPC way, basically letting the agent know exactly what it needs to do in a way that it can understand. The Express router (<code>api/a2a.js</code>) is the HTTP entry point for agent-to-agent communication. The caller can either be another agent or it can be a human. All that matters is that <code>/api/a2a/</code> is designed to accept calls from other agents, not just humans. Basically, the caller could be:
        </p>
        <ol>
          <li>You, the user typing in the UI.</li>
          <li>Another agent, which sends JSON-RPC requests.</li>
          <li>A script or tool that can hit the endpoint.</li>
        </ol>
        <p>
          Once the Express router receives the JSON-RPC requests, it will parse the messages from users or external agents. It also checks the credentials of the user or external agent on what they are capable of asking your agent to do:
        </p>
        <ol>
          <li>
            <strong>Public mode</strong> — no restrictions on what could be asked by users or external agents. This can be limited based on what the agent should be able to answer, such as a summary about its owner.
          </li>
          <li>
            <strong>Tesla tools mode</strong> — validates the header (<code>x-a2a-tesla-secret</code>) or a bearer token.
          </li>
          <li>
            <strong>Owner mode</strong> — validates the owner secret, which allows the user or external agent to access all the tools.
          </li>
        </ol>
        <p>
          Once the authorization step is done by the Express router, the message is delegated by the core agent function (<code>runA2aAgent()</code>) which passes the message and auth context. In this example, this message gets passed to Claude.
        </p>
        <p>
          Claude then runs what is known as a tool loop when processing a request in <code>runA2aAgent()</code>. Basically, it decides it needs to call a tool based on the message received along with the auth headers. If I ask the agent to check my Model 3&apos;s charge state, it would call the <code>get_tesla_charge_state</code> tool which gets run.
        </p>
        <figure className="article__figure">
          <pre className="article__pre">
            {`async function runToolBlock(block) {
  if (block.name === 'list_tesla_vehicles') {
    return listTeslaVehicles()
  }
  if (block.name === 'get_tesla_charge_state') {
    const input = block.input || {}
    return getTeslaChargeState({
      vehicle_query: input.vehicle_query,
    })
  }
  if (block.name === 'estimate_tesla_trip') {
    const input = block.input || {}
    return estimateTeslaTrip({
      destination: input.destination,
      origin_address: input.origin_address,
      vehicle_query: input.vehicle_query,
    })
  }
  // …additional branches (e.g. door command, Home Assistant, unknown tool)
}`}
          </pre>
          <figcaption className="article__figcaption">
            Start of <code>runToolBlock</code> in <code>api/a2aCore.js</code> — first three Tesla Fleet <code>tool_use</code> mappings (the real function continues).
          </figcaption>
        </figure>
        <p>
          That tool hits the Tesla Fleet API and then gets a result. That result is then fed back to Claude as a <code>tool_result</code> message. If it decides that it&apos;s already done everything, then it stops the tool loop and sends the message back to the end user or external agent. If I asked the agent to turn off all the lights in my house and to lock my cars, it would need to call two tools which would run the Tesla Fleet API and Home Assistant before sending a result.
        </p>
        <p>
          Since the agent can be integrated with multiple tools, we need to think about how we can optimize the agent to send faster responses. Here are some ways in which that can be done:
        </p>
        <ol>
          <li>
            <strong>Lower the default output budget:</strong> Basically, configure your max tokens to a lower number, such as going from 2048 to 1024. What this means is that the max tokens caps how long a response should be from Claude in a single API call. If you ask the agent to &quot;turn off the tv in the living room&quot;, you want it to say something along the lines of &quot;Okay, done&quot; or &quot;Okay, the tv has been turned off in the living room&quot;. You wouldn&apos;t need this response to write you a novel over what&apos;s been done. This helps preserve token usage which in turn reduces latency because the model will stop sooner.
          </li>
          <li>
            <strong>Lower the default loop depth:</strong> Have it where the agent can&apos;t run more than a certain number of tools at a time. If you have 8 tools, have its max turns be set to 6. If you think that there will be complex workflows within your agent, it&apos;s best to decide the max number of tools that it should run at the same time.
          </li>
          <li>
            <strong>Run the tools in parallel:</strong> This is by far the most impactful optimization. Instead of having the agent run one tool at a time, you can have multiple tools run at the same time. This can be done via <code>Promise.all(…)</code>. When Claude responds with multiple <code>tool_use</code> blocks in one turn, it may decide that it needs to call both <code>get_tesla_charge_state</code> and <code>list_tesla_vehicles</code> at the same time. Here is how that would look if your agent runs these one by one:
            <pre className="article__pre">
              {`Claude → call tool A → wait → get result → call tool B → wait → get result`}
            </pre>
            With <code>Promise.all()</code>, they would run simultaneously:
            <pre className="article__pre">
              {`call tool A ──┐
              ├── wait for both → get results
call tool B ──┘`}
            </pre>
            If each tool took about 500ms to run, it would take around 1000ms to run for both tools. With parallel execution, the runtime would be at the mercy of the slowest-running tool, so if you have 3 tools that run at 200ms, 100ms and 400ms respectively, then the entire process of making the call and returning the result would take 400ms instead of 700ms. However, this assumes that each tool runs independently and doesn&apos;t depend on the result of another tool. If tool B relies on tool A, then this cannot be parallelized. But for read-only lookups, parallelism is a safe option.
          </li>
        </ol>
      </div>
    </article>
  )
}
