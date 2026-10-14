import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Les tests de rendu resvg (premier test de engine.test.ts : initialisation native + analyse des
    // polices système) dépassent le délai par défaut de 5 s quand la machine n'a qu'un cœur et que
    // vitest exécute plusieurs fichiers en parallèle. Isolé, ce test passe en quelques secondes.
    testTimeout: 30_000,
  },
});
