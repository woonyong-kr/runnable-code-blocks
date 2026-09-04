export class App {
  readonly kind = "test-app";
}

export async function requestUrl(_request: unknown): Promise<never> {
  throw new Error("requestUrl must be mocked by the test that uses it.");
}

export class MarkdownRenderChild {
  constructor(public containerEl: HTMLElement) {}
  onunload(): void {}
}

export class Plugin {
  app = new App();
  readonly processors = new Map<string, (source: string, element: HTMLElement, context: { addChild(child: MarkdownRenderChild): void }) => void>();
  readonly settingTabs: unknown[] = [];
  savedData: unknown = null;
  testData: unknown = null;
  addSettingTab(tab: unknown): void {
    this.settingTabs.push(tab);
  }
  async loadData(): Promise<unknown> {
    return this.testData;
  }
  registerMarkdownCodeBlockProcessor(
    language: string,
    processor: (source: string, element: HTMLElement, context: { addChild(child: MarkdownRenderChild): void }) => void
  ): void {
    this.processors.set(language, processor);
  }
  async saveData(value: unknown): Promise<void> {
    this.savedData = value;
  }
}

export class PluginSettingTab {
  containerEl = document.createElement("div");
  constructor(public app: App, public plugin: Plugin) {}
}

class TextComponent {
  onChange(): this {
    return this;
  }
  setPlaceholder(): this {
    return this;
  }
  setValue(): this {
    return this;
  }
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}
  addText(callback: (text: TextComponent) => unknown): this {
    callback(new TextComponent());
    return this;
  }
  setDesc(): this {
    return this;
  }
  setName(): this {
    return this;
  }
}
