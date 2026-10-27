import { SCHEMA_VERSION, type Direction } from './types.ts';

export const APP_NAME = 'Boerenbridge';
export const APP_VERSION = '2.0.0';

export const STATUS = {
  online: {
    text: 'Opgeslagen',
    more: '',
    aria: 'Alle spellen zijn opgeslagen op dit apparaat.',
  },
  offline: {
    text: 'Offline',
    more: ' · opgeslagen',
    aria: 'Offline. Alles is opgeslagen op dit apparaat.',
  },
  storage: {
    text: 'Opslag uit',
    more: ' · niet opgeslagen',
    aria: 'Opslag niet beschikbaar — je spel gaat verloren bij herladen.',
  },
};

export const COMMON = {
  skip: 'Naar de inhoud',
  close: 'Sluiten',
  cancel: 'Annuleren',
  backToGames: 'Naar Spellen',
  save: 'Opslaan',
  delete: 'Verwijderen',
  notFoundTitle: 'Spel niet gevonden',
  notFoundBody: 'Dit spel staat niet op dit apparaat. Kies een spel uit de lijst of begin een nieuw potje.',
  storageWarning: 'Opslag niet beschikbaar — je spel gaat verloren bij herladen.',
};

export const SPELS = {
  title: 'Spellen',
  subtitle: 'Kies een spel om verder te spelen, of begin een nieuw potje.',
  newGame: 'Nieuw spel',
  emptyTitle: 'Nog geen spel op tafel',
  emptyBody: 'Zodra je een potje begint, staat het hier — ook als je de app sluit.',
  activeChip: 'Bezig',
  finishedChip: 'Afgelopen',
  playOn: 'Verder spelen',
  viewScoreboard: 'Scorebord bekijken',
  deleteTitle: 'Spel verwijderen?',
  deleteBody: (players: string) => `Het spel van ${players} wordt van dit apparaat verwijderd. Dit kan niet ongedaan worden.`,
  deleteConfirm: 'Verwijderen',
};

export const NIEUW = {
  title: 'Nieuw spel',
  subtitle: 'Wie zitten er aan tafel, en hoe hoog spelen jullie?',
  players: 'Spelers',
  playersHint: '2 tot 8',
  playersEmptyHint: 'Vul minstens twee namen in. De rest kun je later toevoegen.',
  playerName: (seat: number) => `Naam van speler ${seat}`,
  playerPlaceholder: 'Naam',
  removePlayer: (seat: number) => `Speler ${seat} verwijderen`,
  addPlayer: 'Speler toevoegen',
  directionTitle: 'Richting',
  directionPyramid: 'Piramide',
  directionPyramidHint: 'Omhoog en weer omlaag',
  directionUp: 'Alleen omhoog',
  directionUpHint: 'Stop bij de top',
  maxTitle: 'Maximaal aantal kaarten',
  maxName: 'Kaarten per speler',
  maxHint: (natural: number) => `0 is automatisch: ${natural} kaarten bij ${natural === 1 ? 'deze tafel' : 'deze tafel'}.`,
  maxAuto: 'Auto',
  maxLabel: (value: number) => (value === 0 ? 'Automatisch maximum. Open het toetsenbord.' : `Maximaal ${value} kaarten per speler. Open het toetsenbord.`),
  maxSheetTitle: 'Kaarten per speler',
  maxSheetSub: '0 is automatisch',
  start: 'Spel starten',
  startBlockedFew: 'Vul minstens twee namen in.',
  startBlockedBlank: 'Vul een naam in voor elke speler.',
  previewTitle: 'Jullie spelen',
  previewRounds: 'rondes',
  blindRule: 'De blinde regel geldt elke ronde: de biedingen mogen samen niet precies het aantal kaarten zijn.',
  jumpToTop: (label: string) => label,
};

export const BIEDINGEN = {
  title: 'Biedingen',
  subtitle: 'Hoeveel slagen belooft iedereen deze ronde?',
  round: (round: number) => `Ronde ${round}`,
  roundOf: (round: number, total: number) => `Ronde ${round} van ${total}`,
  blindRuleHint: 'De biedingen mogen niet samen precies',
  hintIdle: (sum: number, cards: number) =>
    `Samen bieden jullie ${sum} slagen. De biedingen mogen niet samen precies ${cards} zijn.`,
  hintBlocked: (sum: number, message: string) =>
    `Samen bieden jullie ${sum} slagen. Dat mag niet: ${lowerFirst(message)} Pas één bod aan.`,
  submit: 'Biedingen vastleggen',
  keypadHint: 'Tik op een getal om het direct in te voeren.',
  summaryTitle: 'Deze ronde',
  cardsPerPlayer: 'Kaarten per speler',
  bidsTogether: 'Biedingen samen',
  roundsLeft: 'Nog te spelen',
  roundsLeftValue: (n: number) => `${n} ${n === 1 ? 'ronde' : 'rondes'}`,
  decrease: (name: string) => `Bod van ${name} verlagen`,
  increase: (name: string) => `Bod van ${name} verhogen`,
  value: (name: string, value: number) => `Bod van ${name}: ${value}. Open het toetsenbord.`,
  keypadTitle: (name: string) => `Bod voor ${name}`,
  keypadGroup: 'Kies een bod',
  keypadUnit: 'slagen',
  clear: 'Wis',
  done: 'Klaar',
};

export const SLAGEN = {
  title: 'Slagen',
  subtitle: 'Hoeveel slagen heeft iedereen echt gehaald?',
  round: (round: number) => `Ronde ${round}`,
  roundOf: (round: number, total: number) => `Ronde ${round} van ${total}`,
  submit: 'Ronde afronden',
  totalLabel: 'Slagen ingevuld',
  cardsPerPlayer: (cards: number) => `${cards} kaarten p.p.`,
  target: (cards: number) => `/ ${cards} ${cards === 1 ? 'slag' : 'slagen'}`,
  summaryTitle: 'Biedingen',
  hintIdle: (remaining: number) => `Verdeel alle ${remaining} slagen over de spelers.`,
  hintRemaining: (n: number) => `Nog ${n} ${n === 1 ? 'slag' : 'slagen'} te verdelen.`,
  hintOver: (total: number, cards: number, diff: number) =>
    `Je hebt ${total} van ${cards} slagen ingevuld. Haal er ${diff} ${diff === 1 ? 'slag' : 'slagen'} af.`,
  hintReady: 'Klopt. Rond de ronde af als iedereen het eens is.',
  bidSub: (bid: number) => `bood ${bid}`,
  bidSubWithTricks: (bid: number, tricks: number) => `bood ${bid} · ${tricks} ${tricks === 1 ? 'slag' : 'slagen'}`,
  decrease: (name: string) => `Slagen van ${name} verlagen`,
  increase: (name: string) => `Slagen van ${name} verhogen`,
  value: (name: string, value: number) => `Slagen van ${name}: ${value}. Open het toetsenbord.`,
  keypadTitle: (name: string) => `Slagen voor ${name}`,
  keypadGroup: 'Kies het aantal slagen',
  keypadUnit: 'slagen',
  done: 'Klaar',
  resultTitle: (round: number) => `Ronde ${round} afgerond`,
  resultBody: (next: number | null) =>
    next === null
      ? 'De scores zijn bijgewerkt. Het spel is afgelopen.'
      : `De scores zijn bijgewerkt. Ronde ${next} staat klaar.`,
  resultScore: (bid: number, tricks: number) => `bood ${bid} · ${tricks} ${tricks === 1 ? 'slag' : 'slagen'}`,
  undo: 'Ongedaan maken',
  toScoreboard: 'Scorebord',
  finishedToast: 'Ronde ongedaan gemaakt.',
};

export const SCOREBORD = {
  title: 'Scorebord',
  undo: 'Ongedaan maken',
  undoLabel: 'Laatste ronde ongedaan maken',
  emptySub: 'Nog geen rondes gespeeld.',
  progressSub: (played: number, total: number, leader: string | null) =>
    leader === null
      ? `Na ${played} van ${total} rondes. Gelijkspel aan kop.`
      : `Na ${played} van ${total} rondes. ${leader} staat aan kop.`,
  finishedSub: (total: number, winner: string | null, best: number) =>
    winner === null
      ? `${total} van ${total} rondes. Gelijkspel: ${best} punten.`
      : `${total} van ${total} rondes. ${winner} wint met ${best} punten.`,
  standings: 'Tussenstand',
  standingsAfter: (round: number) => `Na ronde ${round}`,
  finalStandings: 'Eindstand',
  leaderMark: 'Aan kop',
  winnerMark: 'Winnaar',
  emptyNoticeTitle: 'De tafel is leeg',
  emptyNoticeBody: 'De tussenstand verschijnt zodra de eerste ronde binnen is.',
  perRound: 'Per ronde',
  roundsMeta: (n: number) => `${n} ${n === 1 ? 'ronde' : 'rondes'}`,
  scrollHint: 'Veeg zijwaarts voor alle rondes.',
  player: 'Speler',
  total: 'Totaal',
  matrixCaption: 'Scores per speler per ronde',
  rounds: 'Rondes',
  latestRounds: 'Laatste vier',
  roundTitle: (round: number, cards: number) => `Ronde ${round} · ${cards} ${cards === 1 ? 'kaart' : 'kaarten'}`,
  roundSub: (bestNames: string[], best: number) => {
    if (best <= 0) {
      return 'Geen bonus deze ronde.';
    }
    if (bestNames.length === 1) {
      return `${bestNames[0]} +${best}, beste van de ronde`;
    }
    if (bestNames.length >= 3) {
      return `${bestNames.length} spelers +${best}`;
    }
    return `${bestNames.join(' en ')} +${best}`;
  },
  correct: 'Corrigeer',
  correctLabel: (round: number) => `Ronde ${round} corrigeren`,
  correctTitle: (round: number) => `Ronde ${round} corrigeren?`,
  correctSub: (round: number) => `De scores van ronde ${round} worden opnieuw berekend.`,
  correctBody: (round: number) => `De rondes daarna blijven staan. Alleen ronde ${round} verandert.`,
  correctConfirm: 'Corrigeren',
  finishedTitle: 'Spel afgelopen',
  winnerChip: (name: string) => `Winnaar: ${name}`,
  tieChip: 'Gelijkspel',
  finishedBody: (winner: string, best: number, second: string, diff: number) =>
    `${winner} eindigde met ${best} punten, ${diff} voor ${second}. De uitslag is klaar om te delen.`,
  finishedBodyTie: (best: number) => `De top eindigde gelijk met ${best} punten. De uitslag is klaar om te delen.`,
  firstRound: 'Eerste ronde',
  nextRound: 'Volgende ronde',
  viewResult: 'Bekijk uitslag',
};

export const CORRECTIE = {
  title: (round: number) => `Ronde ${round} corrigeren`,
  subtitle: 'Pas de biedingen en slagen aan. De rondes daarna blijven staan.',
  bids: 'Biedingen',
  tricks: 'Slagen',
  submit: 'Correctie opslaan',
  back: 'Terug naar scorebord',
  blindHint: (message: string) => `Let op: ${lowerFirst(message)}`,
  roundTitle: (round: number, cards: number) => `Ronde ${round} · ${cards} ${cards === 1 ? 'kaart' : 'kaarten'} p.p.`,
};

export const AFGELOPEN = {
  title: 'Afgelopen',
  sub: (rounds: number, date: string) => `${rounds} ${rounds === 1 ? 'ronde' : 'rondes'} · ${date}`,
  winnerBand: 'Winnaar',
  tieBand: 'Gelijkspel',
  roundsPlayed: (n: number) => `${n} ${n === 1 ? 'ronde' : 'rondes'} gespeeld`,
  points: 'punten',
  note: (diff: number, second: string) => `${diff} punten voor nummer twee ${second}. Knap gespeeld, allemaal.`,
  noteTie: (best: number) => `De top eindigde gelijk met ${best} punten. Knap gespeeld, allemaal.`,
  finalStandings: 'Eindstand',
  afterRounds: (n: number) => `Na ${n} ${n === 1 ? 'ronde' : 'rondes'}`,
  share: 'Deel scorebord',
  shareCopied: 'Link gekopieerd. Iedereen kan het scorebord nu bekijken.',
  shareDone: 'Scorebord gedeeld.',
  shareFailed: 'Kopiëren lukte niet. Deel de link uit de adresbalk.',
  shareNotPublished: 'Delen lukte niet. Publiceer het scorebord opnieuw met verbinding.',
  newGame: 'Nieuw spel',
  shareHint: 'Delen geeft een pagina die iedereen kan bekijken zonder de app.',
  shareTitle: 'Boerenbridge-scorebord',
  shareText: 'Bekijk het scorebord.',
};

export const KEYPAD = {
  columns3: 3,
  columns4: 4,
};

export const PWA = {
  updateAvailable: 'Nieuwe versie beschikbaar',
  reload: 'Herladen',
  updateAria: 'Er is een nieuwe versie van de app. Herladen om die te gebruiken.',
  precacheFailed: 'Offline niet beschikbaar — herlaad met internet.',
  precacheFailedAria: 'Niet alle onderdelen van de app zijn opgeslagen. Herlaad met internet.',
  storageUnknown: 'opslag onbekend',
  storageUsage: (used: string, quota: string) => `${used} van ${quota} gebruikt`,
  footer: (estimate: string) => `versie ${APP_VERSION} · opslag v${SCHEMA_VERSION} · ${estimate}`,
  export: 'Exporteer JSON',
  import: 'Importeer JSON',
  exportAria: 'Alle spellen als JSON-bestand bewaren',
  importAria: 'Spellen uit een JSON-bestand terughalen',
  exportDone: 'JSON-bestand gedownload.',
  exportFailed: 'Exporteren lukte niet.',
  importDone: (count: number) => `${count} ${count === 1 ? 'spel' : 'spellen'} teruggezet.`,
  importKept: (saved: number, skipped: number) =>
    saved === 0
      ? `${skipped} ${skipped === 1 ? 'spel' : 'spellen'} overgeslagen: de versie op dit toestel is nieuwer.`
      : `${saved} teruggezet, ${skipped} overgeslagen: de versie op dit toestel is nieuwer.`,
  importFailed: 'Importeren lukte niet.',
  backupInvalid: 'Dit is geen geldig Boerenbridge-back-upbestand.',
  backupVersion: (found: number) => `Deze back-up heeft opslagversie ${found}; deze app leest alleen versie ${SCHEMA_VERSION}.`,
  backupEmpty: 'Dit bestand bevat geen spellen.',
  exportFileName: (date: string) => `boerenbridge-${date}.json`,
};

export const API = {
  publishFailed: 'Publiceren lukte niet.',
  fetchFailed: 'Dit spel kon niet worden opgehaald.',
  wrongSchema: 'Dit spel is opgeslagen met een andere versie van de app.',
  offline: 'Geen verbinding — probeer het opnieuw als je online bent.',
};

export function namesLine(names: string[]): string {
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return names[0]!;
  }
  return `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]!}`;
}

export function roundsCount(n: number): string {
  return `${n} ${n === 1 ? 'ronde' : 'rondes'}`;
}

export function cardsLine(cards: number): string {
  return `${cards} ${cards === 1 ? 'kaart' : 'kaarten'} p.p.`;
}

export function sequenceLine(rounds: number[], direction: Direction): string {
  if (rounds.length === 0) {
    return '';
  }
  if (rounds.length === 1) {
    return `${rounds[0]} ${rounds[0] === 1 ? 'kaart' : 'kaarten'} per speler`;
  }
  if (rounds.length === 2 || direction === 'up_only') {
    return `${rounds[0]} → ${rounds[rounds.length - 1]} kaarten per speler`;
  }
  return `${rounds[0]} → ${Math.max(...rounds)} → ${rounds[rounds.length - 1]} kaarten per speler`;
}

const TODAY = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' });
const TODAY_WITH_TIME = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const LONG_DATE = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const CLOCK = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatCardDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  if (isSameDay(date, now)) {
    return `Vandaag, ${CLOCK.format(date)}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return TODAY.format(date);
  }
  return TODAY_WITH_TIME.format(date);
}

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return LONG_DATE.format(date);
}

export function formatScore(score: number): string {
  if (score < 0) {
    return `−${Math.abs(score)}`;
  }
  return String(score);
}

export function formatDelta(score: number): string {
  if (score > 0) {
    return `+${score}`;
  }
  return formatScore(score);
}

export function lowerFirst(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}
