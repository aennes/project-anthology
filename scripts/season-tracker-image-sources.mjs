/**
 * Curated Wikimedia / Wikipedia lookup keys for Season Tracker team logos and driver portraits.
 */

/** @type {Array<{ slug: string, wikiTitles: string[], commonsSearch: string, alt: string }>} */
export const TEAM_LOGO_SOURCES = [
  {
    slug: 'ferrari',
    wikiTitles: ['Scuderia Ferrari'],
    commonsSearch: 'Scuderia Ferrari logo',
    alt: 'Scuderia Ferrari logo',
  },
  {
    slug: 'mercedes',
    wikiTitles: ['Mercedes-Benz in Formula One', 'Mercedes F1 Team'],
    commonsSearch: 'Mercedes AMG Petronas Formula One logo',
    alt: 'Mercedes-AMG Petronas Formula One Team logo',
  },
  {
    slug: 'mclaren',
    wikiTitles: ['McLaren', 'McLaren F1 Team'],
    commonsSearch: 'McLaren Formula One Team logo',
    alt: 'McLaren Formula 1 Team logo',
  },
  {
    slug: 'redbull',
    wikiTitles: ['Red Bull Racing'],
    commonsSearch: 'Red Bull Racing logo',
    alt: 'Red Bull Racing logo',
  },
  {
    slug: 'alpine',
    wikiTitles: ['Alpine F1 Team'],
    commonsSearch: 'Alpine F1 Team logo',
    alt: 'Alpine F1 Team logo',
  },
  {
    slug: 'williams',
    wikiTitles: ['Williams Racing'],
    commonsSearch: 'Williams Racing Formula One logo',
    alt: 'Williams Racing logo',
  },
  {
    slug: 'haas',
    wikiTitles: ['Haas F1 Team'],
    commonsSearch: 'Haas F1 Team logo',
    alt: 'Haas F1 Team logo',
  },
  {
    slug: 'sauber',
    wikiTitles: ['Sauber Motorsport', 'Kick Sauber'],
    commonsSearch: 'Sauber Motorsport Formula One logo',
    alt: 'Kick Sauber logo',
  },
  {
    slug: 'visa_cash_racing_bulls',
    wikiTitles: ['Racing Bulls', 'Scuderia AlphaTauri'],
    commonsSearch: 'Racing Bulls Formula One logo',
    alt: 'Racing Bulls Formula One Team logo',
  },
  {
    slug: 'aston_martin',
    wikiTitles: ['Aston Martin in Formula One', 'Aston Martin F1 Team'],
    commonsSearch: 'Aston Martin F1 Team logo',
    alt: 'Aston Martin F1 Team logo',
  },
];

/**
 * Driver three-letter codes with display names for alt text and Commons search.
 */
export const DRIVER_HEADSHOT_SOURCES = [
  { code: 'VER', name: 'Max Verstappen' },
  { code: 'PER', name: 'Sergio Pérez' },
  { code: 'HAM', name: 'Lewis Hamilton' },
  { code: 'RUS', name: 'George Russell' },
  { code: 'LEC', name: 'Charles Leclerc' },
  { code: 'SAI', name: 'Carlos Sainz' },
  { code: 'NOR', name: 'Lando Norris' },
  { code: 'PIA', name: 'Oscar Piastri' },
  { code: 'ALO', name: 'Fernando Alonso' },
  { code: 'STR', name: 'Lance Stroll' },
  { code: 'OCO', name: 'Esteban Ocon' },
  { code: 'GAS', name: 'Pierre Gasly' },
  { code: 'ALB', name: 'Alexander Albon' },
  { code: 'SAR', name: 'Logan Sargeant' },
  { code: 'BOT', name: 'Valtteri Bottas' },
  { code: 'ZHO', name: 'Zhou Guanyu' },
  { code: 'MAG', name: 'Kevin Magnussen' },
  { code: 'HUL', name: 'Nico Hülkenberg' },
  { code: 'TSU', name: 'Yuki Tsunoda' },
  { code: 'RIC', name: 'Daniel Ricciardo' },
  { code: 'LAW', name: 'Liam Lawson' },
  { code: 'COL', name: 'Franco Colapinto' },
  { code: 'BEA', name: 'Oliver Bearman' },
  { code: 'ANT', name: 'Kimi Antonelli' },
  { code: 'BOR', name: 'Gabriel Bortoleto' },
  { code: 'HAD', name: 'Isack Hadjar' },
  { code: 'DOO', name: 'Jack Doohan' },
  { code: 'VET', name: 'Sebastian Vettel' },
  { code: 'RAI', name: 'Kimi Räikkönen' },
  { code: 'GIO', name: 'Antonio Giovinazzi' },
  { code: 'MSC', name: 'Mick Schumacher' },
  { code: 'LAT', name: 'Nicholas Latifi' },
  { code: 'DEV', name: 'Nyck de Vries' },
  { code: 'BUT', name: 'Jenson Button' },
  { code: 'ROS', name: 'Nico Rosberg' },
  { code: 'MAS', name: 'Felipe Massa' },
];
