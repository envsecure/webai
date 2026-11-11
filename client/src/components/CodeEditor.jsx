import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';

const TREE_WIDTH = 240;

/**
 * The `basicSetup` flags we want.
 *
 * `lineWrapping` is deliberately absent so long lines keep their own line and
 * the editor scrolls horizontally, exactly like VS Code.
 */
const BASIC_SETUP = {
  lineNumbers: true,
  highlightActiveLine: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: false,
  completionKeymap: false,
  foldGutter: true,
  searchKeymap: true,
  highlightSelectionMatches: true,
};

const ICONS = {
  code: '▣',
  json: '◈',
  style: '▤',
  markdown: '⌘',
  sql: '⛁',
  other: '●',
};

/** Lower-cased extension of a path ("", ".jsx", ".sql", ...). */
function extensionOf(path) {
  const name = path.split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot).toLowerCase();
}

/**
 * Case-insensitive alphabetical order (like the VS Code explorer), with a
 * case-sensitive tie-break so the order is stable across locales.
 */
function comparePaths(a, b) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left !== right) return left < right ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** The little glyph shown in front of a file in the tree. */
function iconFor(path) {
  switch (extensionOf(path)) {
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return ICONS.code;
    case '.json':
      return ICONS.json;
    case '.css':
    case '.html':
    case '.htm':
      return ICONS.style;
    case '.md':
    case '.markdown':
      return ICONS.markdown;
    case '.sql':
      return ICONS.sql;
    default:
      return ICONS.other;
  }
}

/** The CodeMirror language support for a path, or null when unknown. */
function languageFor(path) {
  switch (extensionOf(path)) {
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return javascript({ jsx: true });
    case '.json':
      return json();
    case '.css':
      return css();
    case '.html':
    case '.htm':
      return html();
    case '.md':
    case '.markdown':
      return markdown();
    case '.sql':
      return sql();
    default:
      return null;
  }
}

/** Size of a string in bytes (UTF-8 when the browser can tell us). */
function byteLength(text) {
  if (!text) return 0;
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}

/**
 * A VS Code style, read-only code viewer: a file tree on the left and a
 * CodeMirror editor on the right.
 *
 * @param {Record<string, string>} files  path -> file contents
 * @param {string|null} activePath        the file that is currently open
 * @param {(path: string) => void} onSelectPath  called when a file is picked
 * @param {boolean} readOnly              when true the editor cannot be edited
 */
export default function CodeEditor({ files, activePath, onSelectPath, readOnly = true }) {
  const entries = useMemo(() => {
    const source = files && typeof files === 'object' ? files : {};
    return Object.keys(source)
      .sort(comparePaths)
      .map((path) => {
        const content = typeof source[path] === 'string' ? source[path] : '';
        const parts = path.split('/');
        const name = parts.pop() || path;
        return {
          path,
          name,
          dir: parts.length ? `${parts.join('/')}/` : '',
          depth: parts.length,
          size: byteLength(content),
          content,
        };
      });
  }, [files]);

  const active = useMemo(
    () => entries.find((entry) => entry.path === activePath) || null,
    [entries, activePath],
  );

  const extensions = useMemo(() => {
    // `oneDark` is the VS Code dark theme; `theme="dark"` on the editor picks
    // the same theme, so both are safe to pass together.
    const list = [oneDark];
    if (readOnly) {
      // `editable` switches the content DOM to read-only, `readOnly` blocks
      // document changes - both are needed for a truly read-only editor.
      list.push(EditorView.editable.of(false));
      list.push(EditorState.readOnly.of(true));
    }
    list.push(indentUnit.of('  '));
    const language = active ? languageFor(active.path) : null;
    if (language) list.push(language);
    return list;
  }, [active, readOnly]);

  const hasFiles = entries.length > 0;

  return (
    <div className="code-editor">
      {hasFiles && (
        <aside className="code-editor__tree" style={{ width: TREE_WIDTH }}>
          <div className="code-editor__tree-head">Explorer</div>
          <div className="code-editor__tree-list">
            {entries.map((entry) => (
              <button
                type="button"
                key={entry.path}
                className={`code-editor__file${
                  entry.path === activePath ? ' code-editor__file--active' : ''
                }`}
                style={{ paddingLeft: 12 + entry.depth * 12 }}
                onClick={() => onSelectPath?.(entry.path)}
                title={entry.path}
                aria-current={entry.path === activePath ? 'true' : undefined}
              >
                <span className="code-editor__file-icon" aria-hidden="true">
                  {iconFor(entry.path)}
                </span>
                <span className="code-editor__file-name">
                  <span className="code-editor__file-dir">{entry.dir}</span>
                  {entry.name}
                </span>
                <span className="code-editor__file-size">{entry.size} B</span>
              </button>
            ))}
          </div>
        </aside>
      )}

      <section className="code-editor__pane">
        {!hasFiles && <div className="code-editor__empty">No files yet</div>}

        {hasFiles && active && (
          <>
            <div className="code-editor__tabbar">
              <span className="code-editor__tab">
                <span className="code-editor__tab-icon" aria-hidden="true">
                  {iconFor(active.path)}
                </span>
                <span className="code-editor__file-name">
                  <span className="code-editor__file-dir">{active.dir}</span>
                  {active.name}
                </span>
              </span>
            </div>

            <div className="code-editor__editor">
              <CodeMirror
                key={active.path}
                value={active.content}
                height="100%"
                theme="dark"
                extensions={extensions}
                basicSetup={BASIC_SETUP}
                readOnly={readOnly}
              />
            </div>
          </>
        )}

        {hasFiles && !active && (
          <div className="code-editor__empty">Select a file to view its contents</div>
        )}
      </section>
    </div>
  );
}
