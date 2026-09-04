export interface LanguageExample {
  code: string;
  expected: string;
  language: string;
}

export const LANGUAGE_EXAMPLES: readonly LanguageExample[] = [
  example("javascript", 'console.log("javascript-ok");', "javascript-ok"),
  example("typescript", 'const message: string = "typescript-ok";\nconsole.log(message);', "typescript-ok"),
  example("python", 'print("python-ok")', "python-ok"),
  example("sql", "select 'sql-ok';", "sql-ok"),
  example("html", '<button class="demo-button">HTML button</button>', "Static button preview"),
  example("css", '.preview-button { background: #3574f0; color: white; transform: translateY(-2px); }', "Styled component preview"),
  example("web", `<button id="counter">Clicked 0 times</button>
<style>
  #counter { padding: 10px 16px; border: 0; border-radius: 8px; background: #3574f0; color: white; }
</style>
<script>
  let count = 0;
  const button = document.querySelector("#counter");
  button.addEventListener("click", () => {
    button.textContent = \`Clicked \${++count} times\`;
    console.log(button.textContent);
  });
</script>`, "Interactive button preview"),
  example("web-ts", `<button id="counter">Clicked 0 times</button>
<script type="text/typescript">
  let count: number = 0;
  const button = document.querySelector<HTMLButtonElement>("#counter")!;
  button.addEventListener("click", () => {
    button.textContent = \`Clicked \${++count} times\`;
    console.log(button.textContent);
  });
</script>`, "Interactive TypeScript button preview"),
  example("kotlin", 'fun main() { println("kotlin-ok") }', "kotlin-ok"),
  example("java", 'class Main { public static void main(String[] args) { System.out.println("java-ok"); } }', "java-ok"),
  example("c", '#include <stdio.h>\nint main(void) { puts("c-ok"); return 0; }', "c-ok"),
  example("cpp", '#include <iostream>\nint main() { std::cout << "cpp-ok\\n"; }', "cpp-ok"),
  example("go", 'package main\nimport "fmt"\nfunc main() { fmt.Println("go-ok") }', "go-ok"),
  example("rust", 'fn main() { println!("rust-ok"); }', "rust-ok"),
  example("csharp", 'using System;\nclass Program { static void Main() { Console.WriteLine("csharp-ok"); } }', "csharp-ok"),
  example("swift", 'print("swift-ok")', "swift-ok"),
  example("ruby", 'puts "ruby-ok"', "ruby-ok"),
  example("php", '<?php echo "php-ok\\n";', "php-ok"),
  example("r", 'cat("r-ok\\n")', "r-ok"),
  example("scala", '@main def main() = println("scala-ok")', "scala-ok"),
  example("dart", 'void main() { print("dart-ok"); }', "dart-ok"),
  example("lua", 'print("lua-ok")', "lua-ok"),
  example("shell", 'echo "shell-ok"', "shell-ok")
];

function example(language: string, code: string, expected: string): LanguageExample {
  return { code, expected, language };
}
