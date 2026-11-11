import { truncate } from './context.js';

/**
 * The virtual filesystem the agent writes into.
 *
 * A build is a plain map of path -> contents. Paths are normalised and
 * restricted to the project tree: no absolute paths, no parent traversal.
 */
export class ProjectWorkspace {
  constructor(files = {}) {
    this.files = new Map(Object.entries(files || {}));
    this.revisions = 0;
  }

  static normalize(path) {
    const clean = String(path || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');
    if (!clean) throw new Error('path is required');
    if (clean.split('/').includes('..')) throw new Error(`path escapes the project: ${path}`);
    return clean;
  }

  has(path) {
    return this.files.has(ProjectWorkspace.normalize(path));
  }

  get(path) {
    return this.files.get(ProjectWorkspace.normalize(path)) ?? null;
  }

  set(path, content) {
    const key = ProjectWorkspace.normalize(path);
    this.files.set(key, String(content ?? ''));
    this.revisions += 1;
    return key;
  }

  delete(path) {
    const key = ProjectWorkspace.normalize(path);
    const existed = this.files.delete(key);
    if (existed) this.revisions += 1;
    return existed;
  }

  list() {
    return [...this.files.keys()].sort();
  }

  size(key) {
    return (this.files.get(key) || '').length;
  }

  toObject() {
    return Object.fromEntries(this.files.entries());
  }

  /** Compact index injected into the context so the agent knows what exists. */
  index() {
    return this.list()
      .map((p) => `- ${p} (${Math.ceil(this.size(p) / 100) * 100} bytes)`)
      .join('\n');
  }
}

/* ------------------------------- tool schemas ------------------------------ */

const filePathSchema = {
  type: 'string',
  description:
    'Path relative to the project root, e.g. "client/src/App.jsx" or "server/schema.sql".',
};

export function buildToolSchemas({ includeDelegate = true, includeDelegateTarget = null } = {}) {
  const tools = [
    {
      name: 'write_file',
      description:
        'Create or overwrite a file in the project. Use this for every source file you want to deliver.',
      parameters: {
        type: 'object',
        properties: {
          path: filePathSchema,
          content: { type: 'string', description: 'The complete file contents.' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
    {
      name: 'read_file',
      description: 'Read a file you previously wrote, to check or patch it.',
      parameters: {
        type: 'object',
        properties: { path: filePathSchema },
        required: ['path'],
        additionalProperties: false,
      },
    },
    {
      name: 'list_files',
      description: 'List every file currently in the project.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'delete_file',
      description: 'Remove a file from the project.',
      parameters: {
        type: 'object',
        properties: { path: filePathSchema },
        required: ['path'],
        additionalProperties: false,
      },
    },
    {
      name: 'finalize',
      description:
        'Finish the build. Call this once the project is complete. The summary becomes the project description.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'One or two sentences describing what was built.' },
        },
        required: ['summary'],
        additionalProperties: false,
      },
    },
  ];

  if (includeDelegate) {
    const targetSchema = includeDelegateTarget
      ? { type: 'string', enum: includeDelegateTarget }
      : { type: 'string' };
    tools.push({
      name: 'delegate',
      description:
        'Hand a focused task to a specialist subagent. The subagent has its own context and budget and returns a report. Use it for work that would otherwise flood your own context.',
      parameters: {
        type: 'object',
        properties: {
          subagent: targetSchema,
          task: { type: 'string', description: 'What the subagent should do, including any context it needs.' },
        },
        required: ['subagent', 'task'],
        additionalProperties: false,
      },
    });
  }

  return tools;
}

/* ------------------------------- tool execution ---------------------------- */

export async function executeTool(name, args, { workspace, onEvent } = {}) {
  const emit = (event) => {
    if (typeof onEvent === 'function') onEvent(event);
  };

  try {
    switch (name) {
      case 'write_file': {
        const key = workspace.set(args.path, args.content);
        emit({
          type: 'tool_call',
          tool: 'write_file',
          path: key,
          bytes: workspace.size(key),
        });
        return {
          ok: true,
          result:
            `Wrote ${key} (${workspace.size(key)} bytes).\n` +
            `Project now contains:\n${workspace.index()}`,
        };
      }
      case 'read_file': {
        const content = workspace.get(args.path);
        if (content == null) {
          return { ok: false, result: `No such file: ${args.path}` };
        }
        emit({ type: 'tool_call', tool: 'read_file', path: args.path });
        return { ok: true, result: content };
      }
      case 'list_files': {
        const files = workspace.list();
        emit({ type: 'tool_call', tool: 'list_files', count: files.length });
        return { ok: true, result: files.length ? files.join('\n') : '(the project is empty)' };
      }
      case 'delete_file': {
        const existed = workspace.delete(args.path);
        emit({ type: 'tool_call', tool: 'delete_file', path: args.path });
        return { ok: true, result: existed ? `Deleted ${args.path}.` : `No such file: ${args.path}` };
      }
      default:
        return { ok: false, result: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, result: `Tool error: ${err.message}` };
  }
}

export function summariseToolResult(result) {
  if (!result?.ok) return truncate(result?.result ?? 'error', 400);
  return result.result;
}
