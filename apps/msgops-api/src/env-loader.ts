import dotenv from 'dotenv';

// Side-effect-only module. Must be imported BEFORE any code that reads process.env
// at module-top-level (e.g., auth.module.ts reads AUTH_PROVIDER to decide whether to
// register AuthController). Importing AppModule before this would freeze module-level
// env reads to whatever the shell exported, ignoring values from .env.
dotenv.config();
