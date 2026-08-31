export class App {
  readonly kind = "test-app";
}

export class MarkdownRenderChild {
  constructor(public containerEl: HTMLElement) {}
  onunload(): void {}
}

export class Plugin {
  app = new App();
  addSettingTab(): void {}
  async loadData(): Promise<unknown> {
    return null;
  }
  registerMarkdownCodeBlockProcessor(): void {}
  async saveData(): Promise<void> {}
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
