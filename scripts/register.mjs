// Cho phép script dùng alias '@/...' giống app. Dùng chung resolve hook với
// test - chép lại là sẽ có ngày hai bản khác nhau.
import { register } from 'node:module';

register('../test/alias-hook.mjs', import.meta.url);
