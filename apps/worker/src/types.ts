import type { D1Database, KVNamespace, R2Bucket, Ai } from "@cloudflare/workers-types";
import type { User, Session } from "@baqsha/shared";

export interface AppBindings {
  DB: D1Database;
  CACHE: KVNamespace;
  IMAGES: R2Bucket;
  AI: Ai;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  APP_NAME: string;
}

export interface AppVariables {
  user: User;
  session: Session;
}

export type AppEnv = { Bindings: AppBindings; Variables: AppVariables };
