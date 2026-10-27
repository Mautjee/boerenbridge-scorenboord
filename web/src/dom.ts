export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Child = Node | string | number | null | undefined | false | Child[];

export interface Attrs {
  class?: string;
  id?: string;
  href?: string;
  type?: string;
  value?: string;
  name?: string;
  role?: string;
  title?: string;
  style?: string;
  alt?: string;
  action?: string;
  scope?: string;
  colspan?: number | string;
  disabled?: boolean;
  hidden?: boolean;
  tabindex?: number | string;
  autocomplete?: string;
  inputmode?: string;
  placeholder?: string;
  maxlength?: number | string;
  [key: `aria-${string}`]: string | boolean | undefined;
  [key: `data-${string}`]: string | undefined;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) {
      continue;
    }
    if (key === 'class') {
      node.className = String(value);
      continue;
    }
    if (key === 'value' && node instanceof HTMLInputElement) {
      node.value = String(value);
      continue;
    }
    if (key === 'disabled' && value === true) {
      node.setAttribute('disabled', '');
      continue;
    }
    if (value === true) {
      node.setAttribute(key, '');
      continue;
    }
    node.setAttribute(key, String(value));
  }
  append(node, children);
  return node;
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    if (Array.isArray(child)) {
      append(parent, child);
      continue;
    }
    if (typeof child === 'object') {
      parent.appendChild(child);
      continue;
    }
    parent.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(node: Node): void {
  while (node.firstChild !== null) {
    node.removeChild(node.firstChild);
  }
}

export function svgIcon(id: string, className = ''): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  if (className.length > 0) {
    svg.setAttribute('class', className);
  }
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  return svg;
}

export function setChildren(node: Element, ...children: Child[]): void {
  clear(node);
  append(node, children);
}

export function mustFind<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`Element niet gevonden: ${selector}`);
  }
  return found;
}
