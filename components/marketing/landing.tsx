import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * Public landing page (route "/", signed-out visitors).
 * Speaks to two audiences: tutorial centre owners (who sign up) and students/parents.
 * Copy rules: questions are original (never claim real past papers), no outcome
 * guarantees (docs/01), no online checkout yet, so the action is centre registration.
 */

/** Public contact for centres (given by the founder for the landing page). */
const WHATSAPP_DISPLAY = "0701 534 7742";
const WHATSAPP_URL = "https://wa.me/2347015347742";
const EMAIL = "matthewfolaweogunnaike@gmail.com";

const darkGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink-line px-5 font-mono text-[0.78rem] font-medium uppercase tracking-[0.06em] text-ink-hi transition-colors hover:bg-ink-soft";

export function Landing() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Audiences />
        <Loop />
        <Features />
        <Honesty />
        <PilotCta />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="bg-ink">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" aria-label="Verity home">
          <Wordmark onDark />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/login" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 font-mono text-[0.78rem] uppercase tracking-[0.06em] text-ink-lo hover:text-ink-hi">
            Sign in
          </Link>
          <span className="hidden sm:block">
            <Link href="/register/institution" className={buttonClass("primary")}>
              Register your centre
            </Link>
          </span>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-ink text-ink-hi">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-10 md:grid-cols-[1.15fr_1fr] md:items-center md:pb-24 md:pt-16">
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-gold-soft">JAMB / UTME · WAEC / WASSCE · Built for Nigeria</p>
          <h1 className="mt-4 font-serif text-[2.4rem] leading-[1.08] sm:text-5xl md:text-[3.6rem]">
            A score tells you what happened. Verity tells you <em className="text-gold-soft">what to do next.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-lo">
            Timed tests and full JAMB mocks that show every student which topics are strong, which need attention, and what to practise
            next. Tutorial centres see the same picture for the whole class, long before results day.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register/institution" className={buttonClass("gold")}>
              Register your centre
            </Link>
            <Link href="#students" className={darkGhost}>
              I’m a student or parent
            </Link>
          </div>
          <p className="mt-5 font-mono text-xs text-ink-lo">Centres start using Verity in January, ahead of UTME 2027.</p>
        </div>
        <SampleSlip />
      </div>
    </section>
  );
}

/** Readiness-card style result slip with sample data (docs/10 signature motif). */
function SampleSlip() {
  const subjects: [string, number][] = [
    ["Use of English", 68],
    ["Mathematics", 54],
    ["Physics", 61],
    ["Chemistry", 42],
  ];
  const topics: [string, number, boolean][] = [
    ["Mathematics · Algebra", 78, false],
    ["Physics · Motion", 64, false],
    ["Chemistry · Organic chemistry", 31, true],
  ];
  const total = subjects.reduce((s, [, v]) => s + v, 0);
  return (
    <figure className="relative mx-auto w-full max-w-md rounded-[3px] border border-paper-line bg-paper-soft p-5 text-hi shadow-[0_1px_0_var(--paper-line)] sm:p-6">
      <span aria-hidden className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-ink" />
      <span aria-hidden className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-ink" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Sample result slip</p>
          <p className="mt-1 font-serif text-xl">Full JAMB mock</p>
        </div>
        <Stamp>Submitted</Stamp>
      </div>
      <div className="doc-rule my-4" />
      <p className="num text-5xl font-semibold leading-none">
        {total} <span className="text-2xl text-lo">/ 400</span>
      </p>
      <p className="num mt-2 text-xs text-lo">4 subjects · 180 questions · 2 hours</p>
      <table className="grid-table mt-4 text-sm">
        <tbody>
          {subjects.map(([name, score]) => (
            <tr key={name}>
              <td>{name}</td>
              <td className="n">{score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-rule my-4" />
      <p className="eyebrow">Topics</p>
      <div className="mt-1">
        {topics.map(([name, pct, weak]) => (
          <div key={name} className="py-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{name}</span>
              <span className="num">{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-line" aria-hidden>
              <div className={`h-full ${weak ? "bg-brick" : "bg-pine"}`} style={{ width: `${pct}%` }} />
            </div>
            {weak && <p className="mt-1 text-xs font-medium text-brick">Needs attention</p>}
          </div>
        ))}
      </div>
      <div className="doc-rule my-4" />
      <p className="eyebrow">Your next step</p>
      <p className="mt-1 text-sm">Practise Organic chemistry, then review the 9 questions you missed with worked solutions.</p>
      <figcaption className="sr-only">Sample result slip with made-up scores, showing what a student sees after a mock.</figcaption>
    </figure>
  );
}

function Audiences() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <p className="eyebrow">Who it’s for</p>
      <h2 className="mt-2 max-w-2xl font-serif text-3xl md:text-4xl">One set of results, two clear answers.</h2>
      <div className="mt-10 grid gap-px border border-paper-line bg-paper-line md:grid-cols-2">
        <div className="bg-paper-soft p-6 sm:p-8">
          <p className="eyebrow">For tutorial centres and schools</p>
          <h3 className="mt-2 font-serif text-2xl">Know who needs help, and with what.</h3>
          <ul className="mt-5 space-y-3 text-[0.95rem]">
            <Point>Set timed topic tests or a full JAMB mock in a few minutes.</Point>
            <Point>See class averages by topic, weakest first, and the questions most students missed.</Point>
            <Point>Add students from a spreadsheet and print their sign-in slips.</Point>
            <Point>Download results as CSV for your own records.</Point>
          </ul>
          <Link href="/register/institution" className={`${buttonClass("primary")} mt-7`}>
            Register your centre
          </Link>
        </div>
        <div id="students" className="scroll-mt-6 bg-paper-soft p-6 sm:p-8">
          <p className="eyebrow">For students and parents</p>
          <h3 className="mt-2 font-serif text-2xl">Stop guessing what to study.</h3>
          <ul className="mt-5 space-y-3 text-[0.95rem]">
            <Point>Practise under real exam timing, on your phone.</Point>
            <Point>Every result shows your strong topics, weak topics and one clear next step.</Point>
            <Point>Review your mistakes with a worked solution for each question.</Point>
            <Point>Parents can go through the result slip with their child and see real progress, not just one score.</Point>
          </ul>
          <p className="mt-7 text-sm text-lo">
            Students join through their tutorial centre. Already have a sign-in slip?{" "}
            <Link href="/login" className="text-pine underline">
              Sign in here
            </Link>
            . Want Verity at your centre? Share this page with them.
          </p>
        </div>
      </div>
    </section>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <svg className="mt-1 shrink-0" width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <path d="M3 12.5l5.5 5.5L21 5.5" fill="none" stroke="var(--pine)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Loop() {
  const steps: [string, string][] = [
    ["Assess", "A timed test or mock, under exam conditions."],
    ["Understand", "Score by subject and by topic, with weak spots marked."],
    ["Practise", "Worked solutions and a clear next topic to work on."],
    ["Reassess", "Test again on the same topics."],
    ["Improve", "See the topic scores move, test by test."],
  ];
  return (
    <section className="border-y border-paper-line bg-paper-soft">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 max-w-2xl font-serif text-3xl md:text-4xl">
          Not another past-questions app. A loop that <em>closes</em>.
        </h2>
        <ol className="mt-10 grid gap-px border border-paper-line bg-paper-line sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(([title, body], i) => (
            <li key={title} className="bg-paper p-5">
              <span className="num text-sm text-gold">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-serif text-xl">{title}</p>
              <p className="mt-1 text-sm text-lo">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  const items: [string, string, string][] = [
    ["400", "Full JAMB mock", "English plus each student’s three subjects. Each subject marked out of 100, total out of 400, in 2 hours."],
    ["11", "Subjects", "Science, commercial and arts subjects for JAMB and WAEC, organised by syllabus topic."],
    ["0", "Answers lost", "Answers save on the phone as the student goes. If the network drops, the test carries on and syncs later."],
    ["1", "Next step", "Every result ends with one clear thing to practise, and why."],
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <p className="eyebrow">What’s inside</p>
      <h2 className="mt-2 max-w-2xl font-serif text-3xl md:text-4xl">Built for how Nigerian students actually prepare.</h2>
      <dl className="mt-10 grid gap-px border border-paper-line bg-paper-line sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([n, title, body]) => (
          <div key={title} className="bg-paper-soft p-5">
            <dt>
              <span className="num block text-4xl font-semibold text-pine">{n}</span>
              <span className="mt-2 block font-medium">{title}</span>
            </dt>
            <dd className="mt-1 text-sm text-lo">{body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Honesty() {
  return (
    <section className="bg-ink text-ink-hi">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-3 md:py-20">
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-gold-soft">Straight talk</p>
          <h2 className="mt-2 font-serif text-3xl">What we promise, and what we don’t.</h2>
        </div>
        <div className="md:col-span-2 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-medium">Original questions, written to the syllabus</p>
            <p className="mt-2 text-sm text-ink-lo">
              Our questions are written to match the JAMB and WAEC syllabus and exam style. They are not copies of past papers, and every question
              is checked by a second person before students see it.
            </p>
          </div>
          <div>
            <p className="font-medium">Evidence, not guarantees</p>
            <p className="mt-2 text-sm text-ink-lo">
              No app can promise a score. Verity shows what the evidence says: where a student is strong, where they need work, and whether
              they are improving.
            </p>
          </div>
          <div>
            <p className="font-medium">Each centre’s data stays private</p>
            <p className="mt-2 text-sm text-ink-lo">
              A centre sees only its own students and results. Nobody else can see them, and that is enforced in the database, not just hidden
              on screen.
            </p>
          </div>
          <div>
            <p className="font-medium">Made for phones and weak networks</p>
            <p className="mt-2 text-sm text-ink-lo">Works in the browser on an everyday Android phone. Nothing to install.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PilotCta() {
  return (
    <section className="bg-pine text-ink-hi">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-6 pt-14 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-gold-soft">January 2027 · Tutorial centre pilot</p>
          <h2 className="mt-2 max-w-xl font-serif text-3xl">Get your JAMB class ready for March.</h2>
          <p className="mt-2 max-w-xl text-ink-hi/80">Register your centre, add your teachers and students, and run your first test the same day.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
          <Link href="/register/institution" className={buttonClass("gold")}>
            Register your centre
          </Link>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-full border border-moss px-5 font-mono text-[0.78rem] font-medium uppercase tracking-[0.06em] text-ink-hi transition-colors hover:bg-pine-deep">
            Chat on WhatsApp
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <p className="text-sm text-ink-hi/80">
          Prefer to talk first? WhatsApp{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="num underline">
            {WHATSAPP_DISPLAY}
          </a>{" "}
          or email{" "}
          <a href={`mailto:${EMAIL}`} className="break-all underline">
            {EMAIL}
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function Faq() {
  const qs: [string, string][] = [
    [
      "Are these real JAMB or WAEC past questions?",
      "No. Verity uses original questions written to the official syllabus and exam style. We will only add real past papers if we get permission to use them.",
    ],
    [
      "How does a student get access?",
      "Through their tutorial centre or school. The centre adds students and gives each one a sign-in slip with a centre code.",
    ],
    [
      "What if the network goes off in the middle of a test?",
      "The test keeps going. Answers are saved on the phone and sent once the connection is back, even if the page is reloaded.",
    ],
    ["Does it work on a phone?", "Yes. Verity is designed for phones first and works in the browser, with nothing to install."],
    [
      "What does it cost?",
      `Centres in the January pilot will hear about pricing directly before anything is charged. There is no payment on this site. To ask about it, WhatsApp ${WHATSAPP_DISPLAY} or email ${EMAIL}.`,
    ],
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 md:py-20">
      <p className="eyebrow">Questions</p>
      <h2 className="mt-2 font-serif text-3xl">Common questions</h2>
      <div className="mt-8 border-t border-paper-line">
        {qs.map(([q, a]) => (
          <details key={q} className="group border-b border-paper-line">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium">
              {q}
              <span aria-hidden className="num text-lg text-lo group-open:rotate-45 motion-safe:transition-transform">
                +
              </span>
            </summary>
            <p className="pb-5 text-lo">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-ink text-ink-lo">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Wordmark onDark />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink-hi">
            WhatsApp
          </a>
          <a href={`mailto:${EMAIL}`} className="hover:text-ink-hi">
            Email us
          </a>
          <Link href="/login" className="hover:text-ink-hi">
            Sign in
          </Link>
          <Link href="/register/institution" className="hover:text-ink-hi">
            Register your centre
          </Link>
        </div>
        <p>© Lumio. Verity is a Lumio product.</p>
      </div>
    </footer>
  );
}
