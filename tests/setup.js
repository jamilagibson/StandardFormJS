import { expect } from 'vitest';
import { configureAxe, toHaveNoViolations } from 'jest-axe';

const axe = configureAxe();
expect.extend(toHaveNoViolations);

globalThis.axe = axe;
