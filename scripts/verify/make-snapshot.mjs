import { createGame, submitBids, submitTricks } from '../../web/src/model.ts';

const now = '2026-10-27T15:30:00.000Z';
let game = createGame({ names: ['Sanne', 'Mauro', 'Joost'], direction: 'up_only', maxCards: 2 }, now);
game = submitTricks(submitBids(game, [0, 0, 0]), [1, 0, 0]);
game = submitTricks(submitBids(game, [0, 1, 0]), [1, 1, 0]);
game = { ...game, updatedAt: '2026-10-27T15:40:00.000Z' };
process.stdout.write(`${JSON.stringify(game, null, 2)}\n`);
