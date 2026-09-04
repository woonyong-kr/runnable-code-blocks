export const OUTPUT_LIMITS = {
  characters: 64_000,
  entries: 200,
  marker: "… output truncated …"
} as const;

export class BoundedOutput {
  readonly #characterLimit: number;
  readonly #entryLimit: number;
  #entries = 0;
  #text = "";
  #truncated = false;

  constructor(options: { characterLimit?: number; entryLimit?: number } = {}) {
    this.#characterLimit = options.characterLimit ?? OUTPUT_LIMITS.characters;
    this.#entryLimit = options.entryLimit ?? OUTPUT_LIMITS.entries;
  }

  append(value: string): void {
    if (this.#truncated) return;
    const separator = this.#text === "" ? "" : "\n";
    const available = this.#characterLimit - this.#text.length - separator.length;
    if (this.#entries >= this.#entryLimit || available <= 0) {
      this.#truncate();
      return;
    }
    this.#entries += 1;
    if (value.length > available) {
      this.#text += `${separator}${value.slice(0, Math.max(0, available))}`;
      this.#truncate();
      return;
    }
    this.#text += `${separator}${value}`;
  }

  toString(): string {
    return this.#text;
  }

  #truncate(): void {
    if (this.#truncated) return;
    this.#truncated = true;
    const marker = `${this.#text === "" ? "" : "\n"}${OUTPUT_LIMITS.marker}`;
    const keep = Math.max(0, this.#characterLimit - marker.length);
    this.#text = `${this.#text.slice(0, keep)}${marker}`;
  }
}
