import { COMMON, cardsLine } from '../copy.ts';
import { SVG_NS, append, el, svgIcon, clear, type Child } from '../dom.ts';

const SEAT_SUITS = ['suit-club', 'suit-diamond', 'suit-spade', 'suit-heart'] as const;

let sheetCounter = 0;

export function suitForSeat(seat: number): string {
  return SEAT_SUITS[seat % SEAT_SUITS.length]!;
}

export function seatClass(seat: number): string {
  return `p${(seat % 8) + 1}`;
}

export function icon(id: string, className = ''): SVGSVGElement {
  return svgIcon(id, className);
}

export function badge(seat: number, small = false): HTMLElement {
  return el(
    'span',
    { class: `badge ${seatClass(seat)}${small ? ' badge--sm' : ''}`, 'aria-hidden': 'true' },
    icon(suitForSeat(seat), 'badge__suit'),
  );
}

export function chip(text: string, tone: 'neutral' | 'accent' | 'danger' = 'neutral'): HTMLElement {
  const className = tone === 'neutral' ? 'chip' : `chip chip--${tone}`;
  return el('span', { class: className }, text);
}

export function ribbon(round: number, cards: number, seat: number): HTMLElement {
  return el(
    'span',
    { class: 'ribbon' },
    icon(suitForSeat(seat), 'ribbon__suit'),
    `Ronde ${round}`,
    el('span', { class: 'ribbon__divider', 'aria-hidden': 'true' }),
    cardsLine(cards),
  );
}

export function track(done: number, total: number, className = ''): HTMLElement {
  const percent = total <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  const fill = el('div', { class: 'track__fill', style: `width:${percent}%` });
  return el('div', { class: `track${className.length > 0 ? ` ${className}` : ''}`, 'aria-hidden': 'true' }, fill);
}

export function screenHead(title: string, sub?: Child, action?: Node): HTMLElement {
  const head = el('div', { class: 'screen-head' });
  if (action !== undefined) {
    head.appendChild(el('div', { class: 'screen-head__row' }, el('h1', {}, title), action));
  } else {
    head.appendChild(el('h1', {}, title));
  }
  if (sub !== undefined) {
    head.appendChild(el('p', { class: 'screen-sub' }, sub));
  }
  return head;
}

export function actionDock(children: Child[], options: { inline?: boolean; mobileOnly?: boolean } = {}): HTMLElement {
  const classes = ['action-dock'];
  if (options.inline === true) {
    classes.push('action-dock--inline');
  }
  if (options.mobileOnly === true) {
    classes.push('action-dock--mobile');
  }
  return el('div', { class: classes.join(' ') }, el('div', { class: 'action-dock__inner' }, children));
}

export function emptyCard(title: string, body: string): HTMLElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'empty-card__motif');
  svg.setAttribute('viewBox', '0 0 132 108');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const addRect = (group: Element, x: number, y: number): void => {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', '46');
    rect.setAttribute('height', '66');
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#dce4d7');
    group.appendChild(rect);
  };
  const addGroup = (rotate: number, cx: number, cy: number, draw: (group: Element) => void): void => {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('transform', `rotate(${rotate} ${cx} ${cy})`);
    draw(group);
    svg.appendChild(group);
  };

  addGroup(-12, 32, 54, (group) => addRect(group, 8, 20));
  addGroup(0, 66, 54, (group) => {
    addRect(group, 43, 13);
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#suit-heart');
    use.setAttribute('x', '58');
    use.setAttribute('y', '30');
    use.setAttribute('width', '16');
    use.setAttribute('height', '16');
    use.setAttribute('fill', '#0b5f3c');
    group.appendChild(use);
    const barOne = document.createElementNS(SVG_NS, 'rect');
    barOne.setAttribute('x', '55');
    barOne.setAttribute('y', '55');
    barOne.setAttribute('width', '22');
    barOne.setAttribute('height', '4');
    barOne.setAttribute('rx', '2');
    barOne.setAttribute('fill', '#e6ede1');
    group.appendChild(barOne);
    const barTwo = document.createElementNS(SVG_NS, 'rect');
    barTwo.setAttribute('x', '55');
    barTwo.setAttribute('y', '63');
    barTwo.setAttribute('width', '14');
    barTwo.setAttribute('height', '4');
    barTwo.setAttribute('rx', '2');
    barTwo.setAttribute('fill', '#e6ede1');
    group.appendChild(barTwo);
  });
  addGroup(12, 100, 54, (group) => addRect(group, 78, 20));

  return el(
    'div',
    { class: 'card empty-card' },
    svg,
    el('h2', { class: 'empty-card__title' }, title),
    el('p', { class: 'empty-card__body' }, body),
  );
}

export interface SheetAction {
  label: string;
  primary?: boolean;
  danger?: boolean;
  ariaLabel?: string;
  onClick: (close: () => void) => void;
}

export interface SheetOptions {
  title: string;
  sub?: string;
  content?: Child;
  actions: SheetAction[];
  showClose?: boolean;
  initialFocusSelector?: string;
  onClose?: () => void;
}

export interface OpenSheet {
  close: () => void;
  element: HTMLElement;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openSheet(options: SheetOptions): OpenSheet {
  sheetCounter += 1;
  const titleId = `sheet-title-${sheetCounter}`;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });
  const layer = el('div', { class: 'sheet-layer' });
  const scrim = el('div', { class: 'sheet-scrim' });
  layer.append(scrim, sheet);

  sheet.appendChild(el('div', { class: 'sheet__grabber', 'aria-hidden': 'true' }));
  const head = el(
    'div',
    { class: 'sheet__head' },
    el('div', {}, el('h2', { class: 'sheet__title', id: titleId }, options.title), options.sub !== undefined ? el('p', { class: 'sheet__sub' }, options.sub) : null),
  );
  if (options.showClose !== false) {
    const closeButton = el('button', { class: 'icon-btn', type: 'button', 'aria-label': COMMON.close }, icon('i-close', 'icon-btn__glyph'));
    closeButton.addEventListener('click', () => close());
    head.appendChild(closeButton);
  }
  sheet.appendChild(head);
  if (options.content !== undefined) {
    append(sheet, [options.content]);
  }

  const actions = el('div', { class: 'sheet__actions' });
  for (const action of options.actions) {
    const classes = ['btn'];
    if (action.primary === true) {
      classes.push('btn--primary');
    } else if (action.danger === true) {
      classes.push('btn--danger');
    } else {
      classes.push('btn--secondary');
    }
    const button = el(
      'button',
      {
        class: classes.join(' '),
        type: 'button',
        ...(action.ariaLabel === undefined ? {} : { 'aria-label': action.ariaLabel }),
      },
      action.label,
    );
    button.addEventListener('click', () => action.onClick(close));
    actions.appendChild(button);
  }
  sheet.appendChild(actions);

  const setInert = (value: boolean): void => {
    for (const node of document.querySelectorAll<HTMLElement>('.topbar, #main')) {
      if (value) {
        node.setAttribute('inert', '');
      } else {
        node.removeAttribute('inert');
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusables = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  let closed = false;
  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    layer.remove();
    setInert(false);
    options.onClose?.();
    if (previousFocus !== null && previousFocus.isConnected) {
      previousFocus.focus();
    }
  };

  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  setInert(true);
  document.body.appendChild(layer);

  const initial =
    options.initialFocusSelector === undefined
      ? null
      : sheet.querySelector<HTMLElement>(options.initialFocusSelector);
  if (initial !== null) {
    initial.focus();
  } else {
    const focusables = sheet.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables[0]?.focus();
  }

  return { close, element: layer };
}

export interface ConfirmOptions {
  title: string;
  sub?: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function confirmAction(options: ConfirmOptions): void {
  openSheet({
    title: options.title,
    sub: options.sub,
    content: options.body === undefined ? undefined : el('p', { class: 'field__hint', style: 'margin-bottom:16px' }, options.body),
    actions: [
      {
        label: options.cancelLabel ?? COMMON.cancel,
        onClick: (close) => close(),
      },
      {
        label: options.confirmLabel,
        primary: options.danger !== true,
        danger: options.danger === true,
        onClick: (close) => {
          close();
          options.onConfirm();
        },
      },
    ],
    initialFocusSelector: '.sheet__actions .btn',
  });
}

export interface KeypadOptions {
  title: string;
  sub: string;
  value: number;
  max: number;
  unit: string;
  groupLabel: string;
  onSelect: (value: number) => void;
}

export function openKeypad(options: KeypadOptions): void {
  const current = el('span', { class: 'sheet__current-value num' }, String(options.value));
  const grid = el('div', {
    class: `keypad${options.max <= 5 ? ' keypad--3' : ''}`,
    role: 'group',
    'aria-label': options.groupLabel,
  });
  const keys: HTMLButtonElement[] = [];
  let selected = options.value;

  const paint = (): void => {
    current.textContent = String(selected);
    keys.forEach((key, index) => {
      key.classList.toggle('keypad__key--current', index === selected);
      if (index === selected) {
        key.setAttribute('aria-pressed', 'true');
      } else {
        key.removeAttribute('aria-pressed');
      }
    });
  };

  const select = (value: number): void => {
    selected = value;
    paint();
    options.onSelect(value);
  };

  for (let value = 0; value <= options.max; value++) {
    const key = el('button', { class: 'keypad__key', type: 'button' }, String(value));
    key.addEventListener('click', () => select(value));
    keys.push(key);
    grid.appendChild(key);
  }
  paint();

  const content = el(
    'div',
    {},
    el('div', { class: 'sheet__current' }, current, el('span', { class: 'sheet__current-unit' }, options.unit)),
    grid,
  );

  openSheet({
    title: options.title,
    sub: options.sub,
    content,
    actions: [
      {
        label: 'Wis',
        onClick: () => select(0),
      },
      {
        label: 'Klaar',
        primary: true,
        onClick: (close) => close(),
      },
    ],
    initialFocusSelector: '.keypad__key--current',
  });
}

export function toast(message: string): void {
  const node = el(
    'div',
    { class: 'toast', role: 'status', 'aria-live': 'polite' },
    icon('i-check', 'toast__glyph'),
    message,
  );
  document.body.appendChild(node);
  window.setTimeout(() => {
    node.remove();
  }, 4200);
}

export function removeAll(selector: string): void {
  for (const node of document.querySelectorAll(selector)) {
    node.remove();
  }
}

export { clear };

export interface StepperRowOptions {
  seat: number;
  name: string;
  sub?: string;
  value: number;
  max: number;
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: (value: number) => string;
  onOpen: (current: number) => void;
  onChange: (value: number) => void;
}

export interface StepperRow {
  element: HTMLElement;
  setValue: (value: number) => void;
  setSub: (text: string) => void;
  value: () => number;
}

export function stepperRow(options: StepperRowOptions): StepperRow {
  let current = Math.min(options.max, Math.max(0, options.value));
  const sub = options.sub === undefined ? null : el('span', { class: 'player-bid__sub' }, options.sub);
  const nameBlock =
    sub === null
      ? el('span', { class: 'player-bid__name' }, options.name)
      : el('span', { class: 'player-bid__who' }, el('span', { class: 'player-bid__name' }, options.name), sub);

  const minusButton = el(
    'button',
    { class: 'step-btn', type: 'button', 'aria-label': options.decreaseLabel },
    icon('i-minus', 'step-btn__glyph'),
  );
  const valueButton = el('button', { class: 'value-btn', type: 'button' });
  const plusButton = el(
    'button',
    { class: 'step-btn step-btn--plus', type: 'button', 'aria-label': options.increaseLabel },
    icon('i-plus', 'step-btn__glyph'),
  );

  const paint = (): void => {
    valueButton.textContent = String(current);
    valueButton.className = `value-btn ${current === 0 ? 'value-btn--empty' : 'value-btn--filled'}`;
    valueButton.setAttribute('aria-label', options.valueLabel(current));
    if (current <= 0) {
      minusButton.setAttribute('disabled', '');
    } else {
      minusButton.removeAttribute('disabled');
    }
    if (current >= options.max) {
      plusButton.setAttribute('disabled', '');
    } else {
      plusButton.removeAttribute('disabled');
    }
  };

  const setValue = (value: number): void => {
    current = Math.min(options.max, Math.max(0, value));
    paint();
  };

  minusButton.addEventListener('click', () => {
    if (current <= 0) {
      return;
    }
    setValue(current - 1);
    options.onChange(current);
  });
  plusButton.addEventListener('click', () => {
    if (current >= options.max) {
      return;
    }
    setValue(current + 1);
    options.onChange(current);
  });
  valueButton.addEventListener('click', () => options.onOpen(current));

  paint();
  const element = el(
    'div',
    { class: 'player-bid' },
    badge(options.seat),
    nameBlock,
    el('div', { class: 'stepper' }, minusButton, valueButton, plusButton),
  );

  return {
    element,
    setValue,
    setSub: (text: string) => {
      if (sub !== null) {
        sub.textContent = text;
      }
    },
    value: () => current,
  };
}
