import { totals } from '../../web/src/model.ts';
import { GameSession } from '../../web/src/session.ts';
import { MemoryStore } from '../../web/src/store.ts';
import type { Game } from '../../web/src/types.ts';

const NOW = '2026-10-27T12:00:00.000Z';

function line(label: string, game: Game): string {
  return `${label}: ${totals(game)
    .map((row) => `${row.name} ${row.total}`)
    .join(' | ')}`;
}

async function playRound(session: GameSession): Promise<void> {
  const game = session.game;
  const cards = game.pending!.cards;
  const round = game.pending!.round;
  const bids = cards >= 2 && round % 3 === 2 ? [0, 1, 0, 0] : [0, 0, 0, 0];
  const tricks = cards >= 2 && round % 3 === 2 ? [cards - 1, 1, 0, 0] : [cards, 0, 0, 0];
  await session.submitBids(bids);
  await session.submitTricks(tricks);
}

const store = new MemoryStore();
const session = await GameSession.create(
  store,
  { names: ['Sanne', 'Mauro', 'Joost', 'Lotte'], direction: 'up_down', maxCards: 5 },
  NOW,
);

for (let index = 0; index < 7; index++) {
  await playRound(session);
}

const before = session.game;
console.log(line('Na 7 rondes', before));
console.log(`Ronde 3 voor correctie: ${JSON.stringify(before.rounds[2]!.scores)}`);

await session.correctRound(3, [0, 0, 0, 0], [0, 3, 0, 0]);
const after = session.game;
console.log(`Ronde 3 na correctie:  ${JSON.stringify(after.rounds[2]!.scores)}`);
console.log(line('Na correctie', after));
console.log(
  `Rondes 4-7 ongewijzigd: ${JSON.stringify(before.rounds.slice(3)) === JSON.stringify(after.rounds.slice(3))}`,
);
console.log(
  `Totaal herberekend uit scores: ${JSON.stringify(
    after.setup.players.map((player) =>
      after.rounds.reduce((sum, round) => sum + (round.scores[player.seat] ?? 0), 0),
    ),
  )}`,
);

await session.undoLastRound();
console.log(line('Na ongedaan maken van ronde 7', session.game));
console.log(`Pending na undo: ${JSON.stringify(session.game.pending)}`);
