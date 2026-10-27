import { NIEUW, roundsCount, sequenceLine } from '../copy.ts';
import { el } from '../dom.ts';
import { requestPersistenceOnce } from '../pwa.ts';
import { GameSession } from '../session.ts';
import { roundSequence, totalRounds } from '../rules.ts';
import type { Direction } from '../types.ts';
import { actionDock, badge, icon, openKeypad, screenHead } from './components.ts';
import type { ViewContext } from './types.ts';

export function nieuwSpelView(ctx: ViewContext): HTMLElement {
  const names: string[] = ['', ''];
  let direction: Direction = 'up_down';
  let maxCards = 0;
  let touched = false;

  const root = el('div', {});
  const previewLine = el('p', { class: 'meta preview-line' });
  root.appendChild(screenHead(NIEUW.title, NIEUW.subtitle));
  root.querySelector('.screen-head')?.appendChild(previewLine);

  const split = el('div', { class: 'split' });
  const main = el('div', {});
  split.appendChild(main);

  const form = el('form', { class: 'stack--4', action: '#' });

  const playersSection = el('section', { 'aria-labelledby': 'spelers' });
  const playersHead = el(
    'div',
    { class: 'section__head' },
    el('h2', { id: 'spelers' }, NIEUW.players),
    el('span', { class: 'meta' }, NIEUW.playersHint),
  );
  const playersHint = el('p', { class: 'field__hint', id: 'start-reason' }, NIEUW.playersEmptyHint);
  const playersCard = el('div', { class: 'card stack' });
  playersSection.append(playersHead, playersHint, playersCard);

  const directionSection = el(
    'section',
    { class: 'card', 'aria-labelledby': 'richting' },
    el('div', { class: 'section__head' }, el('h2', { id: 'richting' }, NIEUW.directionTitle)),
  );
  const segmented = el('div', { class: 'segmented' });
  const pyramidButton = el(
    'button',
    { class: 'segmented__option', type: 'button', 'aria-pressed': 'true' },
    el('span', { class: 'segmented__name' }, NIEUW.directionPyramid),
    el('span', { class: 'segmented__hint' }, NIEUW.directionPyramidHint),
  );
  const upButton = el(
    'button',
    { class: 'segmented__option', type: 'button', 'aria-pressed': 'false' },
    el('span', { class: 'segmented__name' }, NIEUW.directionUp),
    el('span', { class: 'segmented__hint' }, NIEUW.directionUpHint),
  );
  segmented.append(pyramidButton, upButton);
  directionSection.appendChild(segmented);

  const maxSection = el(
    'section',
    { class: 'card', 'aria-labelledby': 'maximum' },
    el('div', { class: 'section__head' }, el('h2', { id: 'maximum' }, NIEUW.maxTitle)),
  );
  const maxName = el('span', { class: 'option-row__name' }, NIEUW.maxName);
  const maxHint = el('span', { class: 'option-row__hint' });
  const maxValue = el('button', {
    class: 'value-btn value-btn--empty',
    type: 'button',
    'aria-label': NIEUW.maxLabel(0),
  }, NIEUW.maxAuto);
  const minusButton = el(
    'button',
    { class: 'step-btn', type: 'button', 'aria-label': 'Maximum verlagen' },
    icon('i-minus', 'step-btn__glyph'),
  );
  const plusButton = el(
    'button',
    { class: 'step-btn step-btn--plus', type: 'button', 'aria-label': 'Maximum verhogen' },
    icon('i-plus', 'step-btn__glyph'),
  );
  const maxStepper = el('div', { class: 'stepper' }, minusButton, maxValue, plusButton);
  maxSection.appendChild(
    el(
      'div',
      { class: 'option-row' },
      el('div', { class: 'option-row__copy' }, maxName, maxHint),
      maxStepper,
    ),
  );

  form.append(playersSection, directionSection, maxSection);
  main.appendChild(form);

  const aside = el('aside', { class: 'split__aside', 'aria-label': 'Voorbeeld van het spel' });
  const previewCard = el('div', { class: 'card' });
  const previewRounds = el('span', { class: 'preview-rounds' });
  previewCard.appendChild(
    el(
      'div',
      { class: 'preview-summary' },
      el('h2', {}, NIEUW.previewTitle),
      previewRounds,
    ),
  );
  const stair = el('div', { class: 'stair', 'aria-hidden': 'true' });
  const previewSequence = el('p', { class: 'preview-sequence' });
  previewCard.append(stair, previewSequence);
  aside.appendChild(previewCard);
  aside.appendChild(
    el(
      'div',
      { class: 'hint' },
      icon('suit-club', 'hint__icon'),
      el('span', {}, NIEUW.blindRule),
    ),
  );

  const startButton = el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, NIEUW.start);
  aside.appendChild(actionDock([startButton]));
  split.appendChild(aside);
  root.appendChild(split);

  function naturalMax(): number {
    return Math.max(1, Math.floor(52 / Math.max(names.length, 2)));
  }

  function rounds(): number[] {
    return roundSequence(names.length, direction, maxCards);
  }

  function updatePreview(): void {
    const sequence = rounds();
    const total = totalRounds(names.length, direction, maxCards);
    previewLine.textContent = `${roundsCount(total)} · ${sequenceLine(sequence, direction)}`;
    previewRounds.replaceChildren(el('span', { class: 'num' }, String(total)), el('span', { class: 'preview-rounds__unit' }, NIEUW.previewRounds));
    previewSequence.textContent = sequenceLine(sequence, direction);
    stair.replaceChildren();
    stair.classList.toggle('stair--dense', total > 25);
    const peak = sequence.length === 0 ? 1 : Math.max(...sequence);
    for (const cards of sequence) {
      const height = Math.max(6, Math.round((cards / peak) * 44));
      stair.appendChild(
        el('div', { class: `stair__bar${cards === peak ? ' stair__bar--peak' : ''}`, style: `height:${height}px` }),
      );
    }
    const limit = naturalMax();
    if (maxCards > limit) {
      maxCards = limit;
    }
    maxValue.textContent = maxCards === 0 ? NIEUW.maxAuto : String(maxCards);
    maxValue.className = `value-btn ${maxCards === 0 ? 'value-btn--empty' : 'value-btn--filled'}`;
    maxValue.setAttribute('aria-label', NIEUW.maxLabel(maxCards));
    maxHint.textContent = NIEUW.maxHint(limit);
    minusButton.disabled = maxCards <= 0;
    plusButton.disabled = maxCards >= limit;
  }

  function reasonForStart(): string | null {
    const filled = names.filter((name) => name.trim().length > 0);
    if (filled.length < 2) {
      return NIEUW.startBlockedFew;
    }
    if (names.some((name) => name.trim().length === 0)) {
      return NIEUW.startBlockedBlank;
    }
    return null;
  }

  function updateValidation(): void {
    const reason = reasonForStart();
    const showError = touched && reason !== null;
    playersHint.textContent = showError ? reason : NIEUW.playersEmptyHint;
    playersHint.className = showError ? 'field-error' : 'field__hint';
    if (showError) {
      playersHint.setAttribute('role', 'alert');
    } else {
      playersHint.removeAttribute('role');
    }
    startButton.disabled = reason !== null;
    startButton.setAttribute('aria-describedby', 'start-reason');
  }

  function rebuildRows(focusIndex?: number): void {
    playersCard.replaceChildren();
    names.forEach((name, index) => {
      const input = el('input', {
        class: 'name-input',
        type: 'text',
        value: name,
        placeholder: NIEUW.playerPlaceholder,
        maxlength: 40,
        autocomplete: 'off',
        'aria-label': NIEUW.playerName(index + 1),
      });
      input.addEventListener('input', () => {
        names[index] = input.value;
        touched = true;
        updateValidation();
      });
      const remove = el(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          'aria-label': NIEUW.removePlayer(index + 1),
        },
        icon('i-close', 'icon-btn__glyph'),
      );
      if (names.length <= 2) {
        remove.setAttribute('disabled', '');
      }
      remove.addEventListener('click', () => {
        if (names.length <= 2) {
          return;
        }
        names.splice(index, 1);
        touched = true;
        rebuildRows();
        updatePreview();
        updateValidation();
      });
      playersCard.appendChild(
        el(
          'div',
          { class: 'player-row' },
          el('span', { class: 'player-row__seat' }, String(index + 1)),
          badge(index),
          input,
          remove,
        ),
      );
    });

    const add = el(
      'button',
      { class: 'add-row', type: 'button' },
      icon('i-plus', 'step-btn__glyph'),
      NIEUW.addPlayer,
    );
    if (names.length >= 8) {
      add.setAttribute('disabled', '');
    }
    add.addEventListener('click', () => {
      if (names.length >= 8) {
        return;
      }
      names.push('');
      rebuildRows(names.length - 1);
      updatePreview();
      updateValidation();
    });
    playersCard.appendChild(add);

    if (focusIndex !== undefined) {
      const inputs = playersCard.querySelectorAll<HTMLInputElement>('.name-input');
      inputs[focusIndex]?.focus();
    }
  }

  function setDirection(next: Direction): void {
    direction = next;
    pyramidButton.setAttribute('aria-pressed', String(next === 'up_down'));
    upButton.setAttribute('aria-pressed', String(next === 'up_only'));
    updatePreview();
  }

  pyramidButton.addEventListener('click', () => setDirection('up_down'));
  upButton.addEventListener('click', () => setDirection('up_only'));

  minusButton.addEventListener('click', () => {
    if (maxCards <= 0) {
      return;
    }
    maxCards = maxCards === 1 ? 0 : maxCards - 1;
    updatePreview();
  });
  plusButton.addEventListener('click', () => {
    const limit = naturalMax();
    if (maxCards >= limit) {
      return;
    }
    maxCards += 1;
    updatePreview();
  });
  maxValue.addEventListener('click', () => {
    openKeypad({
      title: NIEUW.maxSheetTitle,
      sub: NIEUW.maxSheetSub,
      value: maxCards,
      max: naturalMax(),
      unit: 'kaarten',
      groupLabel: 'Kies het maximum',
      onSelect: (value) => {
        maxCards = value;
        updatePreview();
      },
    });
  });

  function start(): void {
    touched = true;
    const reason = reasonForStart();
    if (reason !== null) {
      updateValidation();
      return;
    }
    void (async () => {
      const session = await GameSession.create(ctx.store, {
        names: names.map((name) => name.trim()),
        direction,
        maxCards,
      });
      requestPersistenceOnce();
      window.location.hash = `#/spel/${session.game.id}`;
    })();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    start();
  });
  startButton.addEventListener('click', (event) => {
    event.preventDefault();
    start();
  });

  minusButton.disabled = true;
  rebuildRows();
  updatePreview();
  updateValidation();
  return root;
}

