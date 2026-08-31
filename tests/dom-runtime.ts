type ElementOptions = DomElementInfo | SvgElementInfo | string | undefined;

function ownerDocument(node: Node): Document {
  return node instanceof Document ? node : node.ownerDocument ?? document;
}

function applyOptions(element: Element, options: ElementOptions): void {
  const info = typeof options === "string" ? { cls: options } : options;
  if (info?.cls !== undefined) {
    element.setAttribute("class", Array.isArray(info.cls) ? info.cls.join(" ") : info.cls);
  }
  if ("text" in (info ?? {}) && (info as DomElementInfo).text !== undefined) {
    const text = (info as DomElementInfo).text;
    if (typeof text === "string") element.textContent = text;
    else if (text !== undefined) element.append(text);
  }
}

Reflect.defineProperty(Node.prototype, "createEl", {
  configurable: true,
  value(this: Node, tag: keyof HTMLElementTagNameMap, options?: DomElementInfo | string) {
    const element = ownerDocument(this).createElement(tag);
    applyOptions(element, options);
    this.appendChild(element);
    return element;
  }
});

Reflect.defineProperty(Node.prototype, "createDiv", {
  configurable: true,
  value(this: Node, options?: DomElementInfo | string) {
    return this.createEl("div", options);
  }
});

Reflect.defineProperty(Node.prototype, "createSpan", {
  configurable: true,
  value(this: Node, options?: DomElementInfo | string) {
    return this.createEl("span", options);
  }
});

Reflect.defineProperty(Node.prototype, "createSvg", {
  configurable: true,
  value(this: Node, tag: keyof SVGElementTagNameMap, options?: SvgElementInfo | string) {
    const element = ownerDocument(this).createElementNS("http://www.w3.org/2000/svg", tag);
    applyOptions(element, options);
    this.appendChild(element);
    return element;
  }
});
