// Lets scripts use the '@/...' alias like the app. Shares the resolve hook
// with tests - a copy would one day drift apart.
import { register } from 'node:module';

register('../test/alias-hook.mjs', import.meta.url);
