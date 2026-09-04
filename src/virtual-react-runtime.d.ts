declare module "virtual:react-runtime" {
  const runtime: Readonly<{ source: string; version: string }>;
  export default runtime;
}
