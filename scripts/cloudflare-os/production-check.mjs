import { hostingReport } from './hosting-policy.mjs';

console.error(JSON.stringify(hostingReport(), null, 2));
// No "force" flag: the verified production implementation must replace this check.
process.exitCode = 1;
