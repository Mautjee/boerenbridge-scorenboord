import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryStore } from '../store.ts';
import { spellenView } from '../views/spellen.ts';
import { descendants, installTestDom, TestElement } from './dom-shim.ts';

installTestDom();

const ctx = { store: new MemoryStore(), reload: async (): Promise<void> => {} };

function renderedFooter(): TestElement {
  const root = spellenView([], ctx) as unknown as TestElement;
  const footer = descendants(root).find((node) => node.tagName === 'FOOTER');
  assert.notEqual(footer, undefined, 'de spellenlijst hoort een footer te hebben');
  return footer!;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

function accessibleName(element: TestElement): string {
  const labelledBy = element.getAttribute('aria-labelledby')?.trim();
  if (labelledBy !== undefined && labelledBy !== '') {
    const referenced = labelledBy
      .split(/\s+/)
      .map((id) => descendants(element.parentNode ?? element).find((node) => node.getAttribute('id') === id))
      .map((node) => node?.textContent.trim() ?? '')
      .filter((text) => text !== '');
    if (referenced.length > 0) {
      return referenced.join(' ');
    }
  }
  const label = element.getAttribute('aria-label')?.trim();
  if (label !== undefined && label !== '') {
    return label;
  }
  const text = element.textContent.trim();
  if (text !== '') {
    return text;
  }
  return element.getAttribute('title')?.trim() ?? '';
}

test('the footer JSON buttons include their visible text in the accessible name', async () => {
  const footer = renderedFooter();
  await settle();
  const buttons = descendants(footer).filter((node) => node.tagName === 'BUTTON');
  assert.deepEqual(
    buttons.map((button) => button.textContent.trim()),
    ['Exporteer JSON', 'Importeer JSON'],
  );
  for (const button of buttons) {
    const visible = button.textContent.trim();
    const name = accessibleName(button);
    assert.ok(
      name.includes(visible),
      `toegankelijke naam "${name}" moet de zichtbare tekst "${visible}" bevatten`,
    );
    assert.notEqual(button.getAttribute('aria-hidden'), 'true');
  }
});

test('the hidden JSON file input has an accessible name', async () => {
  const footer = renderedFooter();
  await settle();
  const input = descendants(footer).find(
    (node) => node.tagName === 'INPUT' && node.getAttribute('type') === 'file',
  );
  assert.notEqual(input, undefined, 'de footer hoort een verborgen bestandsinvoer te hebben');
  assert.ok(accessibleName(input!).length > 0, 'de bestandsinvoer moet een toegankelijke naam hebben');
});
