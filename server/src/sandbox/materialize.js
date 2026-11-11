import fs from 'node:fs';
import path from 'node:path';

/**
 * Materialise a generated project onto disk so it can actually run.
 *
 * The generated files are copied verbatim. The extra files (package.json,
 * vite.config.js) are the scaffolding needed to boot the preview.
 */
export function materialize(dir, files) {
  fs.mkdirSync(dir, { recursive: true });

  const written = [];
  for (const [relative, content] of Object.entries(files || {})) {
    const target = path.join(dir, relative);
    if (!target.startsWith(dir)) continue; // path traversal guard
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content ?? '');
    written.push(relative);
  }

  // Remove files that are no longer part of the project.
  const keep = new Set([...written, 'package.json', 'vite.config.js', 'server/data']);
  walk(dir, (file) => {
    const relative = path.relative(dir, file);
    if (keep.has(relative)) return;
    if (relative.startsWith('server/data/')) return;
    if (relative.startsWith('node_modules/')) return;
    if (relative.startsWith('.')) return;
    try {
      fs.rmSync(file);
    } catch {
      /* ignore */
    }
  });

  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'webai-sandbox',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite --host 0.0.0.0',
            api: 'node server/index.js',
          },
          dependencies: {
            react: '^18.3.1',
            'react-dom': '^18.3.1',
            express: '^4.21.2',
            'better-sqlite3': '^11.7.0',
          },
          devDependencies: {
            vite: '^6.0.5',
          },
        },
        null,
        2
      )
    );
  }

  if (!fs.existsSync(path.join(dir, 'vite.config.js'))) {
    fs.writeFileSync(
      path.join(dir, 'vite.config.js'),
      `import { defineConfig } from 'vite';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  root,
  server: { host: '0.0.0.0', port: 5173, strictPort: false, fs: { allow: [root] } },
  resolve: {
    alias: {
      react: path.resolve(root, '../..', '../..', 'node_modules/react'),
      'react-dom': path.resolve(root, '../..', '../..', 'node_modules/react-dom'),
    },
  },
  optimizeDeps: { noDiscovery: true, include: [] },
});
`
    );
  }

  return written;
}

/** Depth-first walk over the files in a directory. */
function walk(dir, visit) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full);
  }
}

/** Find the route modules of a materialised project. */
export function findRoutes(dir) {
  const routesDir = path.join(dir, 'server', 'src', 'routes');
  try {
    return fs
      .readdirSync(routesDir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => ({ file: f, name: f.replace(/\.js$/, '') }));
  } catch {
    return [];
  }
}

export function schemaFile(dir) {
  return path.join(dir, 'server', 'schema.sql');
}

export function databaseFile(dir) {
  return path.join(dir, 'server', 'data', 'app.db');
}
