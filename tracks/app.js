/* eslint-disable no-use-before-define */
(() => {
  /**
   * Lazy fetch triggers (race history 2021–present):
   * - IntersectionObserver on #sectionHistory: when the block crosses into view (~120px margin), we start
   *   loading per-year rows for the active circuit (at most once per circuit per page load).
   * - Each calendar year: sessionStorage → localStorage (TTL) → network (max 2 concurrent, staggered).
   *
   * Cache keys (value is `{ t, d }` in localStorage; session may store bare `d` or wrapped):
   * | Key | Example |
   * |---|---|
   * | `anthologyTracksRace_${circuitId}_${year}` | `anthologyTracksRace_monaco_2024` |
   * | `anthologyTracksRace_neg_${circuitId}_${year}` | short-lived failed fetch (sessionStorage) |
   */
  const SEASON_MIN = 2021;
  const SEASON_CURRENT = Math.max(SEASON_MIN, new Date().getFullYear());
  const RACE_HISTORY_CACHE_PREFIX = 'anthologyTracksRace_';
  const RACE_HISTORY_TTL_CURRENT_MS = 2 * 60 * 60 * 1000;
  const RACE_HISTORY_TTL_HISTORICAL_MS = 7 * 24 * 60 * 60 * 1000;
  const RACE_HISTORY_NEGATIVE_MS = 5 * 60 * 1000;
  /** Gap between starting each year fetch (ms) to avoid proxy bursts. */
  const RACE_HISTORY_STAGGER_MS = 120;
  const WIKI_COVER_MISS_PREFIX = 'tracks_wiki_cover_miss:';

  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Align with season-tracker/public/circuit resolution (Jolpica circuitId + asset aliases). */
  const CIRCUIT_ASSET_ALIASES = {
    las_vegas: ['vegas'],
    lasvegas: ['vegas'],
  };

  const state = {
    historyObserver: null,
    historyWiredCircuit: '',
    historyStarted: false,
    indexScrollY: 0,
    coverObserver: null,
  };

  const COUNTRY_CODES = {
    Monaco: 'MCO',
    Belgium: 'BEL',
    Italy: 'ITA',
    'United Kingdom': 'GBR',
    Japan: 'JPN',
    Brazil: 'BRA',
    Bahrain: 'BHR',
    'Saudi Arabia': 'KSA',
    Australia: 'AUS',
    USA: 'USA',
    Azerbaijan: 'AZE',
    Spain: 'ESP',
    Hungary: 'HUN',
    Turkey: 'TUR',
    Qatar: 'QAT',
    Singapore: 'SGP',
    Portugal: 'PRT',
    Austria: 'AUT',
    France: 'FRA',
    Mexico: 'MEX',
    China: 'CHN',
    Russia: 'RUS',
    Canada: 'CAN',
    UAE: 'UAE',
    Netherlands: 'NLD',
  };

  const SAFE_IMAGE_HOSTS = new Set(['upload.wikimedia.org']);

  const WIKI_GAP_MS = 400;
  let wikiChain = Promise.resolve();
  let wikiNextAt = 0;

  /** @param {Partial<Circuit> & Pick<Circuit, 'circuitId'|'name'|'country'|'flag_emoji'|'first_f1_race_year'|'lap_length_km'|'total_laps_typical'|'iconic_moment'>} partial */
  function seedCircuit(partial) {
    const id = String(partial.circuitId || '').trim().toLowerCase();
    const city = partial.city || partial.country;
    return {
      circuitId: id,
      hash: partial.hash ?? id,
      name: partial.name,
      country: partial.country,
      city,
      flag_emoji: partial.flag_emoji,
      first_f1_race_year: partial.first_f1_race_year,
      lap_length_km: partial.lap_length_km,
      total_laps_typical: partial.total_laps_typical,
      lap_record: partial.lap_record ?? { driver: '—', time: '—', year: SEASON_CURRENT - 1 },
      character_tags: partial.character_tags ?? ['Modern', 'Grand prix'],
      drs_zones: partial.drs_zones ?? 2,
      overtaking_difficulty: partial.overtaking_difficulty ?? 3,
      editorial_description:
        partial.editorial_description ??
        `${partial.name} is a fixture on the hybrid-era calendar — a venue where setup, tyre life, and race-weekend rhythm show clearly in the timing sheets.`,
      motorsport_legacy:
        partial.motorsport_legacy ??
        `From ${partial.first_f1_race_year} onward it has hosted world-championship rounds that shaped seasons and careers.`,
      pull_quotes: partial.pull_quotes ?? [
        { text: `${partial.name} rewards preparation as much as outright pace.`, attribution: 'Anthology notes' },
      ],
      iconic_moment: partial.iconic_moment,
      sector_profile: partial.sector_profile ?? {
        s1: 'Opening sector: traction, braking, and early-lap positioning.',
        s2: 'Middle sector: tyre temperature and minimum-speed balance.',
        s3: 'Final sector: DRS zones and the run to the line.',
      },
    };
  }

  /**
   * @typedef {object} LapRecord
   * @property {string} driver
   * @property {string} time
   * @property {number} year
   *
   * @typedef {object} IconicMoment
   * @property {number} year
   * @property {string} description
   *
   * @typedef {object} SectorProfile
   * @property {string} s1
   * @property {string} s2
   * @property {string} s3
   *
   * @typedef {object} PullQuote
   * @property {string} text
   * @property {string} [attribution]
   *
   * @typedef {object} Circuit
   * @property {string} circuitId
   * @property {string} hash
   * @property {string} name
   * @property {string} country
   * @property {string} city
   * @property {string} flag_emoji
   * @property {number} first_f1_race_year
   * @property {number} lap_length_km
   * @property {number} total_laps_typical
   * @property {LapRecord} lap_record
   * @property {string[]} character_tags
   * @property {number} drs_zones
   * @property {number} overtaking_difficulty
   * @property {string} editorial_description
   * @property {string} motorsport_legacy
   * @property {PullQuote[]} pull_quotes
   * @property {IconicMoment} iconic_moment
   * @property {SectorProfile} sector_profile
   */

  /** @type {Circuit[]} */
  const CIRCUITS = [
    {
      circuitId: 'monaco',
      hash: 'monaco',
      name: 'Circuit de Monaco',
      country: 'Monaco',
      city: 'Monte Carlo',
      flag_emoji: '🇲🇨',
      first_f1_race_year: 1950,
      lap_length_km: 3.337,
      total_laps_typical: 78,
      lap_record: { driver: 'Lewis Hamilton', time: '1:12.909', year: 2021 },
      character_tags: ['Street', 'Precision', 'Barrier-lined'],
      drs_zones: 1,
      overtaking_difficulty: 5,
      editorial_description:
        'Monaco is theatre shot at 200 km/h: millimetric walls, a harbour shimmer, and qualifying that often decides everything. Overtakes are earned in pit sequence, nerve, or rain — rarely on merit alone down the straight.',
      motorsport_legacy:
        'From the first world championship round in 1950 through the Senna-Prost years to modern precision games, the principality remains the calendar’s most unforgiving ribbon.',
      pull_quotes: [
        { text: 'Like trying to ride a bicycle around your living room.', attribution: 'Nelson Piquet' },
        { text: 'Monaco is the one place you cannot afford a single lazy thought.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 1996,
        description: 'Olivier Panis from 14th on the grid in damp, attritional chaos — the last Ligier win.',
      },
      sector_profile: {
        s1: 'Tight uphill burst out of Ste Devote; traction and rear stability set the tone.',
        s2: 'Casino square to the tunnel: rhythm, kerbs, and zero margin through the Swimming Pool complex.',
        s3: 'Rascasse and Antony Noghès: traction exits and the lonely run to the line.',
      },
    },
    {
      circuitId: 'spa',
      hash: 'spa',
      name: 'Circuit de Spa-Francorchamps',
      country: 'Belgium',
      city: 'Stavelot',
      flag_emoji: '🇧🇪',
      first_f1_race_year: 1950,
      lap_length_km: 7.004,
      total_laps_typical: 44,
      lap_record: { driver: 'Valtteri Bottas', time: '1:46.286', year: 2018 },
      character_tags: ['High-speed', 'Elevation', 'Weather lottery'],
      drs_zones: 2,
      overtaking_difficulty: 2,
      editorial_description:
        'Ardennes forests, compression through Eau Rouge-Raidillon, and long power arcs reward bravery and setup balance. Spa can be serene or savage within one lap of cloud shadow.',
      motorsport_legacy:
        'Home to some of the sport’s most cinematic duels; elevation change and micro-climates keep strategists honest.',
      pull_quotes: [
        { text: 'Spa chooses who it wants to reward — sometimes the brave, sometimes the patient.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 1998,
        description: 'Schumacher’s brotherly clash with Hill in the soaking race — Spa as judge and jury.',
      },
      sector_profile: {
        s1: 'La Source hairpin through Kemmel: tow, DRS, and defensive lines.',
        s2: 'Les Combes to Stavelot: fast direction changes and kerb discipline.',
        s3: 'Bus stop chicane to Blanchimont: braking stability and commitment.',
      },
    },
    {
      circuitId: 'monza',
      hash: 'monza',
      name: 'Autodromo Nazionale Monza',
      country: 'Italy',
      city: 'Monza',
      flag_emoji: '🇮🇹',
      first_f1_race_year: 1950,
      lap_length_km: 5.793,
      total_laps_typical: 53,
      lap_record: { driver: 'Rubens Barrichello', time: '1:21.046', year: 2004 },
      character_tags: ['Low-drag', 'Slipstream', 'Temple of speed'],
      drs_zones: 2,
      overtaking_difficulty: 2,
      editorial_description:
        'The calendar’s purest slipstream chess match: tow trains, late brakes into the chicanes, and fans who treat every lap like liturgy.',
      motorsport_legacy:
        'Royal park, royal noise: Monza is where Italian motorsport identity is measured in decibels and daring.',
      pull_quotes: [
        { text: 'If you don’t love Monza, you’re probably reading the wrong sport.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 2020,
        description: 'Gasly’s shock win — safety cars, penalties, and a sprint through uncertainty.',
      },
      sector_profile: {
        s1: 'Variante del Rettifilo: braking from the highest speeds of the year.',
        s2: 'Lesmos and Ascari: minimum-speed balance and kerb ride.',
        s3: 'Parabolica onto the main straight: traction is currency.',
      },
    },
    {
      circuitId: 'silverstone',
      hash: 'silverstone',
      name: 'Silverstone Circuit',
      country: 'United Kingdom',
      city: 'Silverstone',
      flag_emoji: '🇬🇧',
      first_f1_race_year: 1950,
      lap_length_km: 5.891,
      total_laps_typical: 52,
      lap_record: { driver: 'Max Verstappen', time: '1:27.097', year: 2020 },
      character_tags: ['High-energy', 'Aero-dependent', 'Flowing'],
      drs_zones: 2,
      overtaking_difficulty: 3,
      editorial_description:
        'Full-throttle sweeps, Copse courage, and weather that arrives like gossip across the Northamptonshire fields.',
      motorsport_legacy:
        'Birthplace of the world championship; still a benchmark for modern high-downforce choreography.',
      pull_quotes: [
        { text: 'Silverstone rewards drivers who can dance the car when the wind picks up.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 2021,
        description: 'Verstappen–Hamilton Copse lap-one — a flashpoint in their title war.',
      },
      sector_profile: {
        s1: 'Hamilton straight through Maggots–Becketts: commitment and lateral load.',
        s2: 'Village loop and Luffield: traction and tyre temperature.',
        s3: 'Stowe through Club: braking zones and defensive angles.',
      },
    },
    {
      circuitId: 'suzuka',
      hash: 'suzuka',
      name: 'Suzuka International Racing Course',
      country: 'Japan',
      city: 'Suzuka',
      flag_emoji: '🇯🇵',
      first_f1_race_year: 1987,
      lap_length_km: 5.807,
      total_laps_typical: 53,
      lap_record: { driver: 'Lewis Hamilton', time: '1:30.983', year: 2019 },
      character_tags: ['Figure-eight', 'Rhythm', 'Driver favourite'],
      drs_zones: 1,
      overtaking_difficulty: 4,
      editorial_description:
        'A lap of calligraphy: the Esses ask for micro-adjustments, 130R rewards conviction, and the chicane is a civilised duel.',
      motorsport_legacy:
        'Honda heartland; a technical yardstick where car balance and driver finesse show first.',
      pull_quotes: [
        { text: 'Suzuka never bluffs — it prints your setup mistakes in sector time.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 1989,
        description: 'Senna and Prost’s chicane collision — championship arithmetic at knife-edge.',
      },
      sector_profile: {
        s1: 'Esses through Degner: rhythm and front grip.',
        s2: 'Hairpin under the crossover: traction and patience.',
        s3: '130R and chicane: commitment then late braking theatre.',
      },
    },
    {
      circuitId: 'interlagos',
      hash: 'interlagos',
      name: 'Autódromo José Carlos Pace',
      country: 'Brazil',
      city: 'São Paulo',
      flag_emoji: '🇧🇷',
      first_f1_race_year: 1973,
      lap_length_km: 4.309,
      total_laps_typical: 71,
      lap_record: { driver: 'Valtteri Bottas', time: '1:10.540', year: 2018 },
      character_tags: ['Undulating', 'Mixed weather', 'Overtaking'],
      drs_zones: 2,
      overtaking_difficulty: 2,
      editorial_description:
        'Anti-clockwise bumps, Senna S chaos, and a stadium section that turns every overtake into a concert.',
      motorsport_legacy:
        'Brazil’s living room for F1 drama — titles decided, rain gods invoked, crowds unfiltered.',
      pull_quotes: [
        { text: 'Interlagos is where emotion leaks into the telemetry.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 2008,
        description: 'Massa’s home win heartbreak vs Hamilton’s last-corner title — seconds that rewrote lives.',
      },
      sector_profile: {
        s1: 'Senna S to Curva do Sol: elevation and early lap fights.',
        s2: 'Middle sector: traction out of slow corners and tyre warm-up.',
        s3: 'Subida do Lago to Reta Oposta: tow and DRS games.',
      },
    },
    {
      circuitId: 'bahrain',
      hash: 'bahrain',
      name: 'Bahrain International Circuit',
      country: 'Bahrain',
      city: 'Sakhir',
      flag_emoji: '🇧🇭',
      first_f1_race_year: 2004,
      lap_length_km: 5.412,
      total_laps_typical: 57,
      lap_record: { driver: 'Pedro de la Rosa', time: '1:31.447', year: 2005 },
      character_tags: ['Desert', 'Stop-start', 'Tyre science'],
      drs_zones: 3,
      overtaking_difficulty: 3,
      editorial_description:
        'Desert evenings, long straights into heavy braking, and traction events that chew tyres — a strategist’s sandbox.',
      motorsport_legacy:
        'Often the season opener in recent years; night races turned Sakhir into a floodlit laboratory.',
      pull_quotes: [
        { text: 'Bahrain is honest about tyre life — the lap time curve rarely lies.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 2014,
        description: 'Mercedes duel under the lights — the hybrid era’s first true team tension on track.',
      },
      sector_profile: {
        s1: 'Traction out of slow corners after the start funnel.',
        s2: 'Middle sector esses: rear stability and minimum speed.',
        s3: 'Main straight complex: DRS, slipstream, and big stops.',
      },
    },
    {
      circuitId: 'jeddah',
      hash: 'jeddah',
      name: 'Jeddah Corniche Circuit',
      country: 'Saudi Arabia',
      city: 'Jeddah',
      flag_emoji: '🇸🇦',
      first_f1_race_year: 2021,
      lap_length_km: 6.174,
      total_laps_typical: 50,
      lap_record: { driver: 'Lewis Hamilton', time: '1:27.511', year: 2021 },
      character_tags: ['Street', 'High-speed', 'Walls close'],
      drs_zones: 3,
      overtaking_difficulty: 3,
      editorial_description:
        'The fastest street-adjacent ribbon on the calendar: blind apexes, concrete proximity, and heart-rate telemetry.',
      motorsport_legacy:
        'A post-2021 newcomer that instantly became a calendar talking point for pace and peril.',
      pull_quotes: [
        { text: 'Jeddah doesn’t give you time to compose poetry — only corrections.', attribution: 'Anthology notes' },
      ],
      iconic_moment: {
        year: 2021,
        description: 'Title-deciding weekend tension — Verstappen/Hamilton wheel-to-wheel in the closing act.',
      },
      sector_profile: {
        s1: 'Opening sequence: wall proximity and high-speed trust.',
        s2: 'Corniche kinks: small steering inputs at big numbers.',
        s3: 'Harbour sector: late braking and defensive weaving.',
      },
    },
    seedCircuit({
      circuitId: 'albert_park',
      name: 'Albert Park Circuit',
      country: 'Australia',
      city: 'Melbourne',
      flag_emoji: '🇦🇺',
      first_f1_race_year: 1996,
      lap_length_km: 5.278,
      total_laps_typical: 58,
      drs_zones: 3,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2024,
        description: 'Ferrari front-row lockout and a race that felt like a reset for the scarlet squad.',
      },
    }),
    seedCircuit({
      circuitId: 'americas',
      name: 'Circuit of the Americas',
      country: 'USA',
      city: 'Austin',
      flag_emoji: '🇺🇸',
      first_f1_race_year: 2012,
      lap_length_km: 5.513,
      total_laps_typical: 56,
      drs_zones: 2,
      overtaking_difficulty: 2,
      iconic_moment: {
        year: 2021,
        description:
          'Hamilton’s charge from the back after a title-fight penalty — COTA as courtroom and theatre.',
      },
    }),
    seedCircuit({
      circuitId: 'baku',
      name: 'Baku City Circuit',
      country: 'Azerbaijan',
      city: 'Baku',
      flag_emoji: '🇦🇿',
      first_f1_race_year: 2016,
      lap_length_km: 6.003,
      total_laps_typical: 51,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'The castle-walls race that rewrote the championship with a late-race restart.',
      },
    }),
    seedCircuit({
      circuitId: 'catalunya',
      name: 'Circuit de Barcelona-Catalunya',
      country: 'Spain',
      city: 'Montmeló',
      flag_emoji: '🇪🇸',
      first_f1_race_year: 1991,
      lap_length_km: 4.675,
      total_laps_typical: 66,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Verstappen’s first Barcelona win — proof the Red Bull could hurt Mercedes on merit.',
      },
    }),
    seedCircuit({
      circuitId: 'hungaroring',
      name: 'Hungaroring',
      country: 'Hungary',
      city: 'Budapest',
      flag_emoji: '🇭🇺',
      first_f1_race_year: 1986,
      lap_length_km: 4.381,
      total_laps_typical: 70,
      drs_zones: 1,
      overtaking_difficulty: 4,
      iconic_moment: {
        year: 2021,
        description: 'Ocon’s maiden win in a chaotic wet-dry Hungarian afternoon.',
      },
    }),
    seedCircuit({
      circuitId: 'imola',
      name: 'Autodromo Enzo e Dino Ferrari',
      country: 'Italy',
      city: 'Imola',
      flag_emoji: '🇮🇹',
      first_f1_race_year: 1980,
      lap_length_km: 4.909,
      total_laps_typical: 63,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Hamilton’s recovery drive after a Turn 1 tangle — Imola as pressure cooker.',
      },
    }),
    seedCircuit({
      circuitId: 'istanbul',
      name: 'Istanbul Park',
      country: 'Turkey',
      city: 'Istanbul',
      flag_emoji: '🇹🇷',
      first_f1_race_year: 2005,
      lap_length_km: 5.338,
      total_laps_typical: 58,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Inter wet-tyre mastery — Hamilton’s eighth Turkish win in treacherous conditions.',
      },
    }),
    seedCircuit({
      circuitId: 'losail',
      name: 'Losail International Circuit',
      country: 'Qatar',
      city: 'Lusail',
      flag_emoji: '🇶🇦',
      first_f1_race_year: 2021,
      lap_length_km: 5.419,
      total_laps_typical: 57,
      drs_zones: 1,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Verstappen’s first Qatar win under the floodlights as the title fight tightened.',
      },
    }),
    seedCircuit({
      circuitId: 'madring',
      name: 'Madring Circuit',
      country: 'Spain',
      city: 'Madrid',
      flag_emoji: '🇪🇸',
      first_f1_race_year: 2026,
      lap_length_km: 5.47,
      total_laps_typical: 57,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2026,
        description: 'A new European chapter — Madrid’s first world-championship round.',
      },
    }),
    seedCircuit({
      circuitId: 'marina_bay',
      name: 'Marina Bay Street Circuit',
      country: 'Singapore',
      city: 'Singapore',
      flag_emoji: '🇸🇬',
      first_f1_race_year: 2008,
      lap_length_km: 4.928,
      total_laps_typical: 62,
      drs_zones: 3,
      overtaking_difficulty: 4,
      iconic_moment: {
        year: 2023,
        description: 'A night race that bent strategies under Safety Cars and street-light glare.',
      },
    }),
    seedCircuit({
      circuitId: 'miami',
      name: 'Miami International Autodrome',
      country: 'USA',
      city: 'Miami',
      flag_emoji: '🇺🇸',
      first_f1_race_year: 2022,
      lap_length_km: 5.412,
      total_laps_typical: 57,
      drs_zones: 3,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2022,
        description: 'Verstappen wins the inaugural Miami GP — neon, yachts, and flat-out slipstream.',
      },
    }),
    seedCircuit({
      circuitId: 'portimao',
      name: 'Autódromo Internacional do Algarve',
      country: 'Portugal',
      city: 'Portimão',
      flag_emoji: '🇵🇹',
      first_f1_race_year: 2020,
      lap_length_km: 4.653,
      total_laps_typical: 66,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Hamilton wins in Portugal on a circuit F1 visited once in the hybrid era.',
      },
    }),
    seedCircuit({
      circuitId: 'red_bull_ring',
      name: 'Red Bull Ring',
      country: 'Austria',
      city: 'Spielberg',
      flag_emoji: '🇦🇹',
      first_f1_race_year: 1970,
      lap_length_km: 4.318,
      total_laps_typical: 71,
      drs_zones: 2,
      overtaking_difficulty: 2,
      iconic_moment: {
        year: 2022,
        description: 'A home-nation double-header where tyre wear and track limits told the story.',
      },
    }),
    seedCircuit({
      circuitId: 'ricard',
      name: 'Circuit Paul Ricard',
      country: 'France',
      city: 'Le Castellet',
      flag_emoji: '🇫🇷',
      first_f1_race_year: 1971,
      lap_length_km: 5.842,
      total_laps_typical: 53,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Verstappen’s Paul Ricard win — blue-striped asphalt and French summer heat.',
      },
    }),
    seedCircuit({
      circuitId: 'rodriguez',
      name: 'Autódromo Hermanos Rodríguez',
      country: 'Mexico',
      city: 'Mexico City',
      flag_emoji: '🇲🇽',
      first_f1_race_year: 1963,
      lap_length_km: 4.304,
      total_laps_typical: 71,
      drs_zones: 2,
      overtaking_difficulty: 2,
      iconic_moment: {
        year: 2021,
        description: 'Hamilton’s 100th win in altitude-thin air at the Autódromo.',
      },
    }),
    seedCircuit({
      circuitId: 'shanghai',
      name: 'Shanghai International Circuit',
      country: 'China',
      city: 'Shanghai',
      flag_emoji: '🇨🇳',
      first_f1_race_year: 2004,
      lap_length_km: 5.451,
      total_laps_typical: 56,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2024,
        description: 'F1’s return to China after five years — a full grandstand roar.',
      },
    }),
    seedCircuit({
      circuitId: 'sochi',
      name: 'Sochi Autodrom',
      country: 'Russia',
      city: 'Sochi',
      flag_emoji: '🇷🇺',
      first_f1_race_year: 2014,
      lap_length_km: 5.848,
      total_laps_typical: 53,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Norris’s near-miss heartbreak before the late Safety Car reshuffle.',
      },
    }),
    seedCircuit({
      circuitId: 'vegas',
      name: 'Las Vegas Strip Circuit',
      country: 'USA',
      city: 'Las Vegas',
      flag_emoji: '🇺🇸',
      first_f1_race_year: 2023,
      lap_length_km: 6.201,
      total_laps_typical: 50,
      drs_zones: 3,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2023,
        description: 'The Strip under lights — Verstappen clinches a third title in the desert.',
      },
    }),
    seedCircuit({
      circuitId: 'villeneuve',
      name: 'Circuit Gilles Villeneuve',
      country: 'Canada',
      city: 'Montreal',
      flag_emoji: '🇨🇦',
      first_f1_race_year: 1978,
      lap_length_km: 4.361,
      total_laps_typical: 70,
      drs_zones: 2,
      overtaking_difficulty: 2,
      iconic_moment: {
        year: 2022,
        description: 'Wet-weather chaos and a Ferrari 1–2 when Montreal turned monsoon.',
      },
    }),
    seedCircuit({
      circuitId: 'yas_marina',
      name: 'Yas Marina Circuit',
      country: 'UAE',
      city: 'Abu Dhabi',
      flag_emoji: '🇦🇪',
      first_f1_race_year: 2009,
      lap_length_km: 5.281,
      total_laps_typical: 58,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'The controversial final-lap title decider that split a generation of fans.',
      },
    }),
    seedCircuit({
      circuitId: 'zandvoort',
      name: 'Circuit Zandvoort',
      country: 'Netherlands',
      city: 'Zandvoort',
      flag_emoji: '🇳🇱',
      first_f1_race_year: 1952,
      lap_length_km: 4.259,
      total_laps_typical: 72,
      drs_zones: 2,
      overtaking_difficulty: 3,
      iconic_moment: {
        year: 2021,
        description: 'Orange army euphoria — Verstappen’s first home Dutch Grand Prix win.',
      },
    }),
  ];

  CIRCUITS.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const byHash = new Map(CIRCUITS.map((c) => [c.hash.toLowerCase(), c]));
  const vegasCircuit = byHash.get('vegas');
  if (vegasCircuit) byHash.set('las_vegas', vegasCircuit);

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function raceHistoryCacheKey(circuitId, year) {
    return `${RACE_HISTORY_CACHE_PREFIX}${circuitId}_${year}`;
  }

  function raceHistoryNegativeKey(circuitId, year) {
    return `${RACE_HISTORY_CACHE_PREFIX}neg_${circuitId}_${year}`;
  }

  function raceHistoryTtlMs(year) {
    return year < SEASON_CURRENT ? RACE_HISTORY_TTL_HISTORICAL_MS : RACE_HISTORY_TTL_CURRENT_MS;
  }

  function isCacheableRaceHistory(data) {
    if (!data || typeof data !== 'object' || data.absent === true) return false;
    return Boolean(data.winner || data.pole || data.fl || (Array.isArray(data.podium) && data.podium.length));
  }

  function ergastCircuitIds(circuitId) {
    const id = String(circuitId || '').trim().toLowerCase();
    const out = [id];
    const aliases = CIRCUIT_ASSET_ALIASES[id];
    if (aliases) for (const a of aliases) if (!out.includes(a)) out.push(a);
    return out;
  }

  function pickLatestRace(races) {
    if (!Array.isArray(races) || races.length === 0) return null;
    return races.reduce((best, r) => {
      const round = Number(r?.round || 0);
      if (!round) return best;
      if (!best || round > Number(best.round || 0)) return r;
      return best;
    }, null);
  }

  function parseRaceHistoryEntry(raw) {
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && typeof o.t === 'number' && 'd' in o) {
        return { data: o.d, storedAt: o.t };
      }
      if (o && typeof o === 'object' && ('absent' in o || 'winner' in o)) {
        return { data: o, storedAt: Date.now() };
      }
    } catch {
      // ignore
    }
    return null;
  }

  function readRaceHistoryNegative(circuitId, year) {
    const key = raceHistoryNegativeKey(circuitId, year);
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || typeof o.t !== 'number') return false;
      if (Date.now() - o.t >= RACE_HISTORY_NEGATIVE_MS) {
        sessionStorage.removeItem(key);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function writeRaceHistoryNegative(circuitId, year) {
    try {
      sessionStorage.setItem(raceHistoryNegativeKey(circuitId, year), JSON.stringify({ t: Date.now() }));
    } catch {
      // ignore
    }
  }

  function clearRaceHistoryNegative(circuitId, year) {
    try {
      sessionStorage.removeItem(raceHistoryNegativeKey(circuitId, year));
    } catch {
      // ignore
    }
  }

  function readRaceHistoryCache(circuitId, year) {
    const key = raceHistoryCacheKey(circuitId, year);
    const sess = parseRaceHistoryEntry(sessionStorage.getItem(key));
    if (sess?.data && isCacheableRaceHistory(sess.data)) return sess.data;

    try {
      const raw = localStorage.getItem(key);
      const loc = parseRaceHistoryEntry(raw);
      if (!loc?.data || !isCacheableRaceHistory(loc.data)) {
        if (loc && !isCacheableRaceHistory(loc.data)) localStorage.removeItem(key);
        return null;
      }
      const age = Date.now() - (loc.storedAt || 0);
      if (age >= 0 && age < raceHistoryTtlMs(year)) {
        try {
          sessionStorage.setItem(key, JSON.stringify({ t: loc.storedAt || Date.now(), d: loc.data }));
        } catch {
          // ignore
        }
        return loc.data;
      }
    } catch {
      // ignore
    }
    return null;
  }

  function writeRaceHistoryCache(circuitId, year, data) {
    if (!isCacheableRaceHistory(data)) return;
    const key = raceHistoryCacheKey(circuitId, year);
    const bundle = JSON.stringify({ t: Date.now(), d: data });
    try {
      sessionStorage.setItem(key, bundle);
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(key, bundle);
    } catch {
      // ignore quota
    }
  }

  const f1StaticMem = new Map();

  function circuitHistoryStaticUrl(circuitId, year) {
    const id = String(circuitId || '')
      .trim()
      .toLowerCase();
    if (!id || !Number.isFinite(year)) return null;
    return `/data/f1/circuits/${id}/${year}.json`;
  }

  async function fetchF1StaticHistory(circuitId, year) {
    const url = circuitHistoryStaticUrl(circuitId, year);
    if (!url) return null;
    const memKey = url;
    if (f1StaticMem.has(memKey)) return f1StaticMem.get(memKey);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      const data = await r.json();
      if (!data || typeof data !== 'object') return null;
      f1StaticMem.set(memKey, data);
      return data;
    } catch {
      return null;
    }
  }

  async function fetchErgastApiJson(path) {
    const url = `/api/f1-season?path=${encodeURIComponent(path)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      if (r.status === 404) return { MRData: {} };
      throw new Error('Ergast fetch failed');
    }
    return r.json();
  }

  async function fetchErgastJson(path) {
    return fetchErgastApiJson(path);
  }

  function normalizeCircuitBasename(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .replace(/-/g, '_');
  }

  function buildCircuitBasenames(c) {
    const out = [];
    const seen = new Set();
    const push = (stem) => {
      const n = normalizeCircuitBasename(stem);
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    };
    const id = c?.circuitId ? String(c.circuitId).trim().toLowerCase() : '';
    if (id) {
      push(id);
      const aliases = CIRCUIT_ASSET_ALIASES[id];
      if (aliases) for (const a of aliases) push(a);
    }
    push(String(c.name || '').replace(/\s+/g, '_'));
    return out;
  }

  function countryCode(c) {
    return COUNTRY_CODES[c.country] || String(c.country || '').slice(0, 3).toUpperCase();
  }

  function isImageSrcAllowed(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return false;
    if (s.startsWith('//')) s = `https:${s}`;
    const lower = s.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false;
    if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;
    if (s.startsWith('/')) {
      if (s.includes('..') || s.includes('\\') || s.includes('\0')) return false;
      return s.startsWith('/circuits/');
    }
    if (s.startsWith('../')) {
      if (s.includes('\0') || s.includes('..\\')) return false;
      if (/\.\.\/\.\./.test(s)) return false;
      return s.startsWith('../circuits/');
    }
    if (!lower.startsWith('https://')) return false;
    try {
      return SAFE_IMAGE_HOSTS.has(new URL(s).hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function dedupePreserveOrder(items) {
    const seen = new Set();
    const out = [];
    for (const x of items) {
      const t = String(x ?? '').trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  function setImageWithFallbacks(img, candidates, opts) {
    const options = opts || {};
    if (typeof img.__safeImgSupersede === 'function') img.__safeImgSupersede();

    const shouldApply = typeof options.shouldApply === 'function' ? options.shouldApply : () => true;
    const urls = dedupePreserveOrder(candidates).filter(isImageSrcAllowed);

    if (options.alt !== undefined) img.alt = String(options.alt);
    if (options.referrerPolicy) img.referrerPolicy = options.referrerPolicy;
    if (options.loading) img.loading = options.loading;
    if (options.decoding) img.decoding = options.decoding;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (img.__safeImgSupersede === supersedeSelf) img.__safeImgSupersede = null;
        resolve(ok);
      };
      const supersedeSelf = () => finish(false);
      img.__safeImgSupersede = supersedeSelf;

      if (urls.length === 0) {
        if (shouldApply()) options.onShowPlaceholder?.();
        finish(false);
        return;
      }

      let idx = 0;
      let loadSerial = 0;

      const tryNext = () => {
        if (settled) return;
        if (idx >= urls.length) {
          if (shouldApply()) {
            img.removeAttribute('src');
            options.onShowPlaceholder?.();
          }
          finish(false);
          return;
        }
        const url = urls[idx];
        idx += 1;
        const serial = (loadSerial += 1);

        const cleanup = () => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onErr);
        };

        const onLoad = () => {
          if (settled) return;
          if (serial !== loadSerial) return;
          cleanup();
          if (shouldApply()) {
            img.src = url;
            options.onSuccess?.();
          }
          finish(true);
        };

        const onErr = () => {
          if (settled) return;
          if (serial !== loadSerial) return;
          cleanup();
          tryNext();
        };

        img.addEventListener('load', onLoad);
        img.addEventListener('error', onErr);
        img.src = url;
      };

      tryNext();
    });
  }

  function wikiThumbFromQueryJson(j) {
    const pages = j?.query?.pages || {};
    const first = pages[Object.keys(pages)[0]];
    const src = first?.thumbnail?.source || '';
    if (!src || !isImageSrcAllowed(src)) return '';
    return src;
  }

  function wikiCoverMissKey(title) {
    return `${WIKI_COVER_MISS_PREFIX}${title.toLowerCase()}`;
  }

  function isWikiCoverMiss(title) {
    try {
      return sessionStorage.getItem(wikiCoverMissKey(title)) === '1';
    } catch {
      return false;
    }
  }

  function markWikiCoverMiss(title) {
    try {
      sessionStorage.setItem(wikiCoverMissKey(title), '1');
    } catch {
      // ignore quota / private mode
    }
  }

  function enqueueWiki(task) {
    const run = wikiChain.then(async () => {
      const wait = Math.max(0, wikiNextAt - Date.now());
      if (wait) await new Promise((r) => window.setTimeout(r, wait));
      const result = await task();
      wikiNextAt = Date.now() + WIKI_GAP_MS;
      return result;
    });
    wikiChain = run.catch(() => {});
    return run;
  }

  async function loadCircuitCoverFromWiki(c) {
    return enqueueWiki(async () => {
      const title = `${String(c.name || '').trim()} Formula 1`;
      if (!title || title === 'Formula 1') return '';
      if (isWikiCoverMiss(title)) return '';
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4500);
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=1200&titles=${encodeURIComponent(title)}`;
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) {
          markWikiCoverMiss(title);
          return '';
        }
        const j = await r.json();
        const thumb = wikiThumbFromQueryJson(j);
        if (!thumb) markWikiCoverMiss(title);
        return thumb;
      } catch {
        markWikiCoverMiss(title);
        return '';
      } finally {
        window.clearTimeout(timer);
      }
    });
  }

  function circuitCoverCandidates(c) {
    const urls = [];
    for (const b of buildCircuitBasenames(c)) {
      for (const root of ['/circuits/', '../circuits/']) {
        for (const ext of ['webp', 'jpg', 'png', 'svg']) {
          urls.push(`${root}${b}.${ext}`);
        }
      }
    }
    return urls;
  }

  function circuitSvgCandidates(c) {
    const urls = [];
    for (const b of buildCircuitBasenames(c)) {
      for (const root of ['/circuits/', '../circuits/']) {
        urls.push(`${root}${b}.svg`);
      }
    }
    return urls;
  }

  function renderOvertakingDots(n) {
    const v = Math.min(5, Math.max(1, Number(n) || 3));
    return Array.from({ length: 5 }, (_, i) => {
      const on = i < v ? ' is-on' : '';
      return `<span class="overtakeDot${on}" aria-hidden="true"></span>`;
    }).join('');
  }

  function renderGrid() {
    const grid = $('#tracksGrid');
    const empty = $('#tracksEmpty');
    if (!grid || !empty) return;
    const list = CIRCUITS;
    if (list.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = list
      .map((c, i) => {
        const accent = i % 9 === 0 ? ' trackCard--accent' : '';
        return `
<a class="trackCard${accent}" href="#${escapeHtml(c.hash)}" data-hash="${escapeHtml(c.hash)}">
  <div class="trackCard__media">
    <img class="trackCard__cover" alt="" loading="lazy" decoding="async" />
    <div class="trackCard__fallback" hidden aria-hidden="true">
      <span class="trackCard__fallbackFlag">${escapeHtml(c.flag_emoji)}</span>
    </div>
    <span class="trackCard__shimmer" aria-hidden="true"></span>
  </div>
  <div class="trackCard__veil" aria-hidden="true"></div>
  <img class="trackCard__svg" alt="" loading="lazy" decoding="async" hidden />
  <span class="trackCard__code">${escapeHtml(countryCode(c))}</span>
  <div class="trackCard__foot">
    <h2 class="trackCard__name">${escapeHtml(c.name)}</h2>
    <p class="trackCard__meta">${escapeHtml(c.city)} · ${escapeHtml(c.country)}</p>
  </div>
</a>`;
      })
      .join('');

    ensureCoverObserver();
    list.forEach((c) => {
      const card = grid.querySelector(`a.trackCard[data-hash="${c.hash}"]`);
      if (!(card instanceof HTMLElement)) return;
      card.dataset.circuitReady = '0';
      state.coverObserver?.observe(card);
    });
  }

  function ensureCoverObserver() {
    if (state.coverObserver) return;
    state.coverObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const card = e.target;
          if (!(card instanceof HTMLElement)) continue;
          if (card.dataset.circuitReady === '1') continue;
          card.dataset.circuitReady = '1';
          state.coverObserver?.unobserve(card);
          const hash = card.dataset.hash || '';
          const c = byHash.get(String(hash).toLowerCase());
          if (!c) continue;
          const cover = card.querySelector('img.trackCard__cover');
          const svg = card.querySelector('img.trackCard__svg');
          const fallback = card.querySelector('.trackCard__fallback');
          if (cover instanceof HTMLImageElement) void attachCircuitCover(card, cover, fallback, c);
          if (svg instanceof HTMLImageElement) void attachCircuitSvg(svg, c);
        }
      },
      { rootMargin: '120px 0px', threshold: 0.01 },
    );
  }

  async function attachCircuitCover(card, img, fallbackEl, c) {
    const local = circuitCoverCandidates(c);
    const ok = await setImageWithFallbacks(img, local, {
      alt: c.name,
      loading: 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
      onSuccess: () => {
        if (/\.svg(?:$|\?)/i.test(img.src)) img.classList.add('is-map');
        img.classList.add('is-loaded');
        card.classList.remove('is-fallback');
        if (fallbackEl instanceof HTMLElement) fallbackEl.hidden = true;
      },
      onShowPlaceholder: () => showCoverFallback(card, fallbackEl),
    });
    if (ok) return;
    const wiki = await loadCircuitCoverFromWiki(c);
    if (wiki) {
      const wikiOk = await setImageWithFallbacks(img, [wiki], {
        alt: c.name,
        loading: 'lazy',
        decoding: 'async',
        referrerPolicy: 'no-referrer',
        onSuccess: () => {
          img.classList.add('is-loaded');
          card.classList.remove('is-fallback');
          if (fallbackEl instanceof HTMLElement) fallbackEl.hidden = true;
        },
        onShowPlaceholder: () => showCoverFallback(card, fallbackEl),
      });
      if (wikiOk) return;
    }
    showCoverFallback(card, fallbackEl);
  }

  function showCoverFallback(card, fallbackEl) {
    card.classList.add('is-fallback');
    if (fallbackEl instanceof HTMLElement) fallbackEl.hidden = false;
  }

  async function attachCircuitSvg(img, c) {
    const ok = await setImageWithFallbacks(img, circuitSvgCandidates(c), {
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
      onSuccess: () => {
        img.hidden = false;
      },
    });
    if (!ok) img.remove();
  }

  function setView(mode) {
    const indexEl = $('#viewIndex');
    const detailEl = $('#viewDetail');
    const detailNav = $('#detailNav');
    const main = $('#main');
    if (!indexEl || !detailEl) return;
    if (mode === 'detail') {
      indexEl.hidden = true;
      detailEl.hidden = false;
      if (detailNav instanceof HTMLElement) detailNav.hidden = false;
      main?.classList.add('page--detail');
    } else {
      indexEl.hidden = false;
      detailEl.hidden = true;
      if (detailNav instanceof HTMLElement) detailNav.hidden = true;
      main?.classList.remove('page--detail');
    }
  }

  function renderDetail(c) {
    const art = $('#detailArticle');
    if (!art) return;
    document.title = `${c.name} • Circuit Atlas`;

    const quotes = (c.pull_quotes || [])
      .map(
        (q) => `
<figure class="pullQuote">
  <blockquote class="pullQuote__text">“${escapeHtml(q.text)}”</blockquote>
  ${q.attribution ? `<figcaption class="pullQuote__attr">${escapeHtml(q.attribution)}</figcaption>` : ''}
</figure>`,
      )
      .join('');

    const tags = c.character_tags
      .map((t) => `<span class="tagGhost">${escapeHtml(t)}</span>`)
      .join('');

    art.innerHTML = `
<section class="detailHero io-section" aria-label="${escapeHtml(c.name)} hero" data-io>
  <div class="detailHero__media">
    <img id="detailHeroCover" class="detailHero__cover" alt="" loading="eager" decoding="async" />
    <div class="detailHero__fallback" hidden aria-hidden="true">
      <span class="detailHero__fallbackFlag">${escapeHtml(c.flag_emoji)}</span>
    </div>
    <span class="detailHero__shimmer" aria-hidden="true"></span>
  </div>
  <div class="detailHero__veil" aria-hidden="true"></div>
  <img class="detailHero__svg" alt="" loading="lazy" decoding="async" hidden />
  <div class="detailHero__copy">
    <div class="detailHero__codeRow">
      <span class="detailHero__code">${escapeHtml(countryCode(c))}</span>
      <span class="detailHero__flag" aria-hidden="true">${escapeHtml(c.flag_emoji)}</span>
    </div>
    <h1 class="detailHero__title">${escapeHtml(c.name)}</h1>
    <p class="detailHero__sub">${escapeHtml(c.city)} · ${escapeHtml(c.country)} · F1 since ${escapeHtml(String(c.first_f1_race_year))}</p>
    <div class="detailHero__tags">${tags}</div>
  </div>
</section>

<div class="detailBody">
<section class="sectionBlock io-section dnaPanel" aria-labelledby="dnaTitle" data-io>
  <div class="sectionHead">
    <h2 class="sectionHead__title" id="dnaTitle">Circuit DNA</h2>
    <span class="sectionHead__hint">Track character</span>
  </div>
  <div class="dnaStats">
    <div class="dnaStat">
      <div class="dnaStat__k">DRS zones</div>
      <div class="dnaStat__v">${escapeHtml(String(c.drs_zones))}</div>
    </div>
    <div class="dnaStat">
      <div class="dnaStat__k">Overtaking difficulty</div>
      <div class="overtakeDots" aria-label="Overtaking difficulty ${escapeHtml(String(c.overtaking_difficulty))} of 5">${renderOvertakingDots(c.overtaking_difficulty)}</div>
    </div>
    <div class="dnaStat">
      <div class="dnaStat__k">Lap record</div>
      <div class="dnaStat__v dnaStat__v--record">${escapeHtml(c.lap_record.time)}</div>
      <div class="dnaStat__note">${escapeHtml(c.lap_record.driver)} · ${escapeHtml(String(c.lap_record.year))}</div>
    </div>
  </div>
  <div class="sectorGrid">
    <div class="sectorCol"><div class="sectorCol__k">S1</div><p class="sectorCol__v">${escapeHtml(c.sector_profile.s1)}</p></div>
    <div class="sectorCol"><div class="sectorCol__k">S2</div><p class="sectorCol__v">${escapeHtml(c.sector_profile.s2)}</p></div>
    <div class="sectorCol"><div class="sectorCol__k">S3</div><p class="sectorCol__v">${escapeHtml(c.sector_profile.s3)}</p></div>
  </div>
</section>

<section class="sectionBlock io-section" id="sectionHistory" aria-labelledby="histTitle" data-circuit="${escapeHtml(c.circuitId)}" data-io>
  <div class="sectionHead">
    <h2 class="sectionHead__title" id="histTitle">Race history</h2>
    <span class="sectionHead__hint">${escapeHtml(String(SEASON_MIN))}–${escapeHtml(String(SEASON_CURRENT))}</span>
  </div>
  <div class="histWrap">
    <table class="histTable" aria-describedby="histHintLive">
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Winner</th>
          <th scope="col">Pole</th>
          <th scope="col">Fastest lap</th>
          <th scope="col">Podium</th>
        </tr>
      </thead>
      <tbody id="histBody"></tbody>
    </table>
  </div>
  <p id="histHintLive" class="small muted">Loads when this section enters view · cached per session</p>
</section>

<section class="sectionBlock io-section editorialBlock" aria-labelledby="editTitle" data-io>
  <div class="sectionHead">
    <h2 class="sectionHead__title" id="editTitle">Editorial</h2>
    <span class="sectionHead__hint">Anthology voice</span>
  </div>
  <p class="editorialP">${escapeHtml(c.editorial_description)}</p>
  <p class="editorialP editorialP--legacy">${escapeHtml(c.motorsport_legacy)}</p>
  <div class="pullQuoteWrap">${quotes}</div>
</section>

<section class="sectionBlock io-section" aria-labelledby="momentTitle" data-io>
  <div class="momentCard" aria-labelledby="momentTitle">
    <span class="momentCard__yearBg" aria-hidden="true">${escapeHtml(String(c.iconic_moment.year))}</span>
    <div class="momentCard__kicker">Iconic moment</div>
    <h2 class="momentCard__title" id="momentTitle">${escapeHtml(String(c.iconic_moment.year))}</h2>
    <p class="momentCard__body">${escapeHtml(c.iconic_moment.description)}</p>
  </div>
</section>
</div>`;

    const hero = art.querySelector('.detailHero');
    const cover = $('#detailHeroCover');
    const fallback = art.querySelector('.detailHero__fallback');
    const svg = art.querySelector('.detailHero__svg');
    if (hero instanceof HTMLElement && cover instanceof HTMLImageElement) {
      void attachCircuitCover(hero, cover, fallback, c);
    }
    if (svg instanceof HTMLImageElement) void attachCircuitSvg(svg, c);
    setupSectionIo(art);

    const tbody = $('#histBody');
    if (tbody) {
      const years = [];
      for (let y = SEASON_MIN; y <= SEASON_CURRENT; y += 1) years.push(y);
      tbody.innerHTML = years
        .map(
          (y) =>
            `<tr class="histRow" data-year="${y}"><td class="histYear">${y}</td><td colspan="4" class="cellLoading">Waiting for viewport…</td></tr>`,
        )
        .join('');
    }

    wireHistorySection(c);
    $('#main')?.focus?.();
  }

  function wireHistorySection(c) {
    teardownHistoryObserver();
    state.historyWiredCircuit = c.circuitId;
    state.historyStarted = false;
    const section = $('#sectionHistory');
    if (!section) return;
    state.historyObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (state.historyStarted) return;
        state.historyStarted = true;
        void loadAllHistoryRows(c);
      },
      { rootMargin: '120px 0px', threshold: 0.01 },
    );
    state.historyObserver.observe(section);
  }

  function teardownHistoryObserver() {
    if (state.historyObserver) {
      state.historyObserver.disconnect();
      state.historyObserver = null;
    }
  }

  async function loadAllHistoryRows(c) {
    const tbody = $('#histBody');
    if (!tbody) return;
    const years = [];
    for (let y = SEASON_MIN; y <= SEASON_CURRENT; y += 1) years.push(y);

    years.forEach((y) => {
      const row = tbody.querySelector(`tr[data-year="${y}"]`);
      if (!(row instanceof HTMLTableRowElement)) return;
      row.className = 'histRow histRow--loading';
      row.innerHTML = `<td class="histYear">${y}</td><td colspan="4"><span class="histShimmer" aria-hidden="true"></span></td>`;
    });

    await Promise.all(
      years.map(async (y) => {
        const row = tbody.querySelector(`tr[data-year="${y}"]`);
        if (!(row instanceof HTMLTableRowElement)) return;
        try {
          const data = await loadYearRow(c.circuitId, y);
          row.className = data?.absent ? 'histRow' : data?.winner ? 'histRow histRow--winner' : 'histRow';
          row.innerHTML = formatHistoryRow(y, data);
        } catch {
          row.className = 'histRow';
          row.innerHTML = `<td class="histYear">${y}</td><td colspan="4" class="cellErr">Could not load</td>`;
        }
      }),
    );
  }

  async function loadYearRow(circuitId, year) {
    const cached = readRaceHistoryCache(circuitId, year);
    if (cached) return cached;

    const staticRow = await fetchF1StaticHistory(circuitId, year);
    if (staticRow) {
      if (staticRow.absent === true) return staticRow;
      if (isCacheableRaceHistory(staticRow)) {
        clearRaceHistoryNegative(circuitId, year);
        writeRaceHistoryCache(circuitId, year, staticRow);
        return staticRow;
      }
    }

    if (readRaceHistoryNegative(circuitId, year)) {
      return { absent: true };
    }

    try {
      const data = await fetchYearAggregate(circuitId, year);
      if (data?.absent) return data;
      if (!isCacheableRaceHistory(data)) {
        writeRaceHistoryNegative(circuitId, year);
        return { absent: true };
      }
      clearRaceHistoryNegative(circuitId, year);
      writeRaceHistoryCache(circuitId, year, data);
      return data;
    } catch (err) {
      writeRaceHistoryNegative(circuitId, year);
      throw err;
    }
  }

  async function findRaceForCircuitYear(circuitId, year) {
    for (const id of ergastCircuitIds(circuitId)) {
      const racesJson = await fetchErgastJson(`${year}/circuits/${id}/races.json`);
      const race = pickLatestRace(racesJson?.MRData?.RaceTable?.Races);
      if (race) return race;
    }
    const seasonJson = await fetchErgastJson(`${year}.json`);
    const ids = new Set(ergastCircuitIds(circuitId));
    const matches = (seasonJson?.MRData?.RaceTable?.Races || []).filter((r) =>
      ids.has(String(r?.Circuit?.circuitId || '').toLowerCase()),
    );
    return pickLatestRace(matches);
  }

  async function fetchYearAggregate(circuitId, year) {
    const race = await findRaceForCircuitYear(circuitId, year);
    if (!race) return { absent: true };
    const round = Number(race.round || 0);
    if (!round) return { absent: true };

    const [resultsJson, qualJson] = await Promise.all([
      fetchErgastJson(`${year}/${round}/results.json`),
      fetchErgastJson(`${year}/${round}/qualifying.json`),
    ]);

    const winner = extractRaceWinner(resultsJson);
    const pole = extractPoleSitter(qualJson);
    const fl = extractFastestLap(resultsJson);
    const podium = extractPodium(resultsJson);

    if (!winner && !pole && !(podium && podium.length)) {
      return { absent: true };
    }

    return {
      absent: false,
      round,
      winner,
      pole,
      fl,
      podium,
    };
  }

  function extractRaceWinner(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.Results?.[0];
    if (!res) return null;
    const d = res.Driver || {};
    const code = (d.code || '').toString().toUpperCase();
    return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
  }

  function extractPoleSitter(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.QualifyingResults?.[0];
    if (!res) return null;
    const d = res.Driver || {};
    const code = (d.code || '').toString().toUpperCase();
    return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
  }

  function extractFastestLap(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.Results || [];
    for (const r of res) {
      if (r?.FastestLap?.rank === '1' || r?.FastestLap?.rank === 1) {
        const d = r.Driver || {};
        return {
          name: `${d.givenName || ''} ${d.familyName || ''}`.trim(),
          time: r.FastestLap?.Time?.time || '',
        };
      }
    }
    return null;
  }

  function extractPodium(json) {
    const race = json?.MRData?.RaceTable?.Races?.[0];
    const res = race?.Results || [];
    const top = res.slice(0, 3);
    return top.map((r) => {
      const d = r.Driver || {};
      const code = (d.code || '').toString().toUpperCase();
      return { name: `${d.givenName || ''} ${d.familyName || ''}`.trim(), code };
    });
  }

  function formatHistoryRow(year, data) {
    if (data?.absent) {
      return `<td class="histYear">${year}</td><td colspan="4" class="muted">—</td>`;
    }
    const w = data.winner;
    const p = data.pole;
    const f = data.fl;
    const pod = data.podium || [];
    const podiumStr = pod
      .filter(Boolean)
      .map((x) => (x.code ? `${escapeHtml(x.code)}` : escapeHtml(x.name)))
      .join(', ');
    const flStr = f ? `${escapeHtml(f.name)}${f.time ? ` (${escapeHtml(f.time)})` : ''}` : '—';
    return `<td class="histYear">${year}</td>
<td>${w ? `${escapeHtml(w.code || '')} ${escapeHtml(w.name)}` : '—'}</td>
<td>${p ? `${escapeHtml(p.code || '')} ${escapeHtml(p.name)}` : '—'}</td>
<td>${f ? flStr : '—'}</td>
<td>${podiumStr || '—'}</td>`;
  }

  function setupSectionIo(root = document) {
    const sections = $$(`.io-section`, root);
    if (prefersReducedMotion) {
      sections.forEach((n) => n.classList.add('io-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const t = e.target;
          if (t instanceof HTMLElement) {
            t.classList.add('io-in');
            io.unobserve(t);
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );
    sections.forEach((n) => {
      if (!n.classList.contains('io-in')) io.observe(n);
    });
  }

  function parseHash() {
    const h = (window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    return h;
  }

  function scrollBehavior() {
    return prefersReducedMotion ? 'auto' : 'smooth';
  }

  function scrollToDetailView() {
    const el = $('#viewDetail') || document.querySelector('.detailHero');
    if (!(el instanceof HTMLElement)) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top - 4), behavior: scrollBehavior() });
  }

  function restoreIndexScroll() {
    const y = state.indexScrollY;
    window.scrollTo({ top: y, behavior: scrollBehavior() });
  }

  function onRoute() {
    const slug = parseHash();
    if (!slug) {
      teardownHistoryObserver();
      setView('index');
      document.title = 'Circuit Atlas • Project Anthology';
      $('#main')?.focus?.();
      requestAnimationFrame(() => restoreIndexScroll());
      return;
    }
    const c = byHash.get(slug);
    if (!c) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      setView('index');
      document.title = 'Circuit Atlas • Project Anthology';
      $('#main')?.focus?.();
      requestAnimationFrame(() => restoreIndexScroll());
      return;
    }
    setView('detail');
    renderDetail(c);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToDetailView());
    });
  }

  function init() {
    renderGrid();
    setupSectionIo();
    window.addEventListener('hashchange', onRoute);
    document.body.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const card = t.closest('a.trackCard[href^="#"]');
      if (card instanceof HTMLAnchorElement && card.hash.length > 1) {
        state.indexScrollY = window.scrollY;
      }
      const a = t.closest('a[href="#"]');
      if (!(a instanceof HTMLAnchorElement)) return;
      const inDetail = Boolean(a.closest('#viewDetail'));
      if (inDetail) {
        e.preventDefault();
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        onRoute();
      }
    });
    const detailNav = $('#detailNav');
    if (detailNav instanceof HTMLAnchorElement) {
      detailNav.addEventListener('click', (e) => {
        e.preventDefault();
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        onRoute();
      });
    }
    onRoute();
  }

  init();
})();
