export interface ElementOptions {
  className?: string;
  text?: string;
}

function ownerDocument(parent: Node): Document {
  return parent.nodeType === Node.DOCUMENT_NODE
    ? parent as Document
    : parent.ownerDocument ?? document;
}

export function appendElement<K extends keyof HTMLElementTagNameMap>(
  parent: Node,
  name: K,
  options: ElementOptions = {}
): HTMLElementTagNameMap[K] {
  const element = ownerDocument(parent).createElement(name);
  if (options.className !== undefined) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  parent.appendChild(element);
  return element;
}

export function appendSvgElement<K extends keyof SVGElementTagNameMap>(
  parent: Node,
  name: K,
  className?: string
): SVGElementTagNameMap[K] {
  const element = ownerDocument(parent).createElementNS("http://www.w3.org/2000/svg", name);
  if (className !== undefined) element.setAttribute("class", className);
  parent.appendChild(element);
  return element;
}
