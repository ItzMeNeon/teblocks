type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
interface Locals extends Runtime {}
}

interface Env {
  API_BASE_URL: string;
}
