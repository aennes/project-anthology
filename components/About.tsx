import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const COLLECTION = [
  {
    title: 'Anthology',
    href: '/',
    tag: 'Home',
    blurb: 'Long-form stories — rivalries, tragedy, myth — told like cinema, not spreadsheets.',
  },
  {
    title: 'Timeline',
    href: '/timeline',
    tag: 'Stories',
    blurb: 'The same narratives arranged decade by decade. Scroll the spine, open any chapter.',
  },
  {
    title: 'Season Tracker',
    href: '/season-tracker',
    tag: 'Live',
    blurb: 'Standings, calendars, and session results for the current grid — updated as the season unfolds.',
  },
  {
    title: 'Circuit Atlas',
    href: '/tracks',
    tag: 'Tracks',
    blurb: 'Every circuit on the calendar: history, layout, and the stories etched into each corner.',
  },
  {
    title: 'Radio Anthology',
    href: '/radio-anthology',
    tag: 'Audio',
    blurb: 'Iconic team radio moments — tension, humour, and raw emotion from the pit wall.',
  },
  {
    title: 'News',
    href: '/news',
    tag: 'Headlines',
    blurb: 'Curated F1 headlines from trusted outlets. Read the full story at the source.',
  },
] as const;

const About: React.FC = () => {
  return (
    <motion.div
      className="about-page relative min-h-screen bg-f1-black text-paper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <header
        className="about-page__hero cine-letterbox cine-vignette"
        aria-labelledby="about-hero-title"
      >
        <span className="cine-hero-glow" aria-hidden="true" />
        <span className="cine-hero-grain" aria-hidden="true" />
        <div className="about-page__hero-inner cine-route-hero">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-[2px] w-12 bg-[#ff1801]" />
            <span className="font-section-divider text-[12px] tracking-[0.2em] uppercase text-[rgba(255,24,1,0.82)]">
              THE ARCHIVE PROJECT
            </span>
            <div className="h-[2px] w-12 bg-[#ff1801]" />
          </div>
          <h1 id="about-hero-title">About</h1>
          <p className="about-page__deck">A cinematic archive of Formula 1</p>
          <p className="about-page__detail">Stories · Circuits · Seasons · Radio</p>
        </div>
        <div className="absolute bottom-6 left-0 right-0 flex justify-center md:hidden" style={{ zIndex: 9 }} aria-hidden="true">
          <span className="animate-bounce text-white/50 text-lg leading-none select-none">↓</span>
        </div>
      </header>

      <div className="about-page__fade" aria-hidden="true" />

      <div className="about-page__body">
        <motion.section
          className="about-page__section"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-8%' }}
          transition={{ duration: 0.45 }}
        >
          <p className="about-page__label">What this is</p>
          <h2 className="about-page__heading">Beyond the timing sheet</h2>
          <p className="about-page__prose">
            Project Anthology is an independent fan project — not affiliated with Formula 1,
            the FIA, or any team. It exists to preserve and retell the sport&apos;s human drama:
            the rivalries, the mistakes, the myths that outlive the lap charts.
          </p>
          <p className="about-page__prose">
            The tone is editorial and cinematic: letterboxed heroes, grain, and typography that
            treats each story like a frame from a film — because statistics alone rarely explain
            why a moment still hurts decades later.
          </p>
        </motion.section>

        <motion.section
          className="about-page__section"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-8%' }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <p className="about-page__label">Focus</p>
          <h2 className="about-page__heading">Narrative first</h2>
          <p className="about-page__prose">
            Anthology prioritises context over cold data. When we cite results, it is in service
            of character, consequence, and culture — the why behind the what.
          </p>
          <p className="about-page__prose">
            News headlines link out to original reporting. Track and season data draw on public
            sources. Everything here is built for fans who already love the sport and want to
            feel it again, not for official record-keeping.
          </p>
        </motion.section>

        <motion.section
          className="about-page__section about-page__section--collection"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-8%' }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <p className="about-page__label">The collection</p>
          <h2 className="about-page__heading">Six doors into the same world</h2>
          <p className="about-page__prose about-page__prose--lead">
            Each subsite shares the same visual language but serves a different pace of discovery.
          </p>

          <ul className="about-page__grid">
            {COLLECTION.map((item, index) => {
              const isReactRoute = item.href === '/' || item.href === '/timeline' || item.href === '/news';
              const cardClass = 'about-page__card cine-hover-lift';
              const cardInner = (
                <>
                  <span className="about-page__card-tag">{item.tag}</span>
                  <h3 className="about-page__card-title">{item.title}</h3>
                  <p className="about-page__card-blurb">{item.blurb}</p>
                  <span className="about-page__card-cta" aria-hidden>
                    Enter <span>→</span>
                  </span>
                </>
              );

              return (
                <motion.li
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                >
                  {isReactRoute ? (
                    <Link to={item.href} className={cardClass}>
                      {cardInner}
                    </Link>
                  ) : (
                    <a href={item.href} className={cardClass}>
                      {cardInner}
                    </a>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </motion.section>

        <motion.footer
          className="about-page__disclaimer"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <p className="about-page__label">Disclaimer</p>
          <p>
            Formula 1®, F1®, and related marks are trademarks of their respective owners.
            Project Anthology is unofficial fan work for education and appreciation only.
            No endorsement is implied. If you spot an error, treat it as a fan edit — not gospel.
          </p>
        </motion.footer>
      </div>
    </motion.div>
  );
};

export default About;
