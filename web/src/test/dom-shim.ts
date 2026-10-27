export type TestNode = TestTextNode | TestElement;

export class TestTextNode {
  readonly nodeType = 3;
  readonly data: string;
  parentNode: TestElement | null = null;

  constructor(data: string) {
    this.data = data;
  }

  get textContent(): string {
    return this.data;
  }
}

export class TestElement {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly childNodes: TestNode[] = [];
  parentNode: TestElement | null = null;
  value = '';
  private classValue = '';
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get className(): string {
    return this.classValue;
  }

  set className(value: string) {
    this.classValue = value;
    this.attributes.set('class', value);
  }

  get firstChild(): TestNode | null {
    return this.childNodes[0] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.childNodes.length = 0;
    if (value !== '') {
      this.appendChild(new TestTextNode(value));
    }
  }

  setAttribute(name: string, value: string): void {
    if (name === 'class') {
      this.classValue = value;
    }
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  appendChild<T extends TestNode>(child: T): T {
    if (child.parentNode !== null) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild<T extends TestNode>(child: T): T {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }
    child.parentNode = null;
    return child;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({ type: 'click' });
    }
  }
}

export class TestInputElement extends TestElement {}

interface TestDocument {
  createElement(tagName: string): TestElement;
  createElementNS(_namespace: string, tagName: string): TestElement;
  createTextNode(data: string): TestTextNode;
  body: TestElement;
}

export function installTestDom(): void {
  const document: TestDocument = {
    createElement: (tagName) => (tagName.toLowerCase() === 'input' ? new TestInputElement(tagName) : new TestElement(tagName)),
    createElementNS: (_namespace, tagName) => new TestElement(tagName),
    createTextNode: (data) => new TestTextNode(data),
    body: new TestElement('body'),
  };
  const globals = globalThis as Record<string, unknown>;
  globals.document = document;
  globals.HTMLElement = TestElement;
  globals.HTMLInputElement = TestInputElement;
  globals.Node = TestElement;
}

export function descendants(root: TestElement): TestElement[] {
  const found: TestElement[] = [];
  for (const child of root.childNodes) {
    if (child instanceof TestElement) {
      found.push(child, ...descendants(child));
    }
  }
  return found;
}
