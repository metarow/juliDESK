var _JUPYTERLAB;
(function () {
  "use strict";

  function parseYamlFrontmatter(text) {
    let metadata = {
      kernelspec: {
        name: "python",
        display_name: "Python (Pyodide)",
        language: "python"
      },
      language_info: {
        name: "python"
      }
    };

    let body = text;

    if (text.startsWith("---\n") || text.startsWith("---\r\n")) {
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      if (match) {
        const yamlStr = match[1];
        body = text.slice(match[0].length);

        const nameMatch = yamlStr.match(/name:\s*([^\r\n]+)/);
        const displayMatch = yamlStr.match(/display_name:\s*([^\r\n]+)/);
        const langMatch = yamlStr.match(/language:\s*([^\r\n]+)/);

        if (nameMatch) {
          metadata.kernelspec.name = nameMatch[1].trim().replace(/^['"]|['"]$/g, "");
        }
        if (displayMatch) {
          metadata.kernelspec.display_name = displayMatch[1].trim().replace(/^['"]|['"]$/g, "");
        }
        if (langMatch) {
          metadata.kernelspec.language = langMatch[1].trim().replace(/^['"]|['"]$/g, "");
          metadata.language_info.name = metadata.kernelspec.language;
        }
      }
    }

    return { metadata, body };
  }

  function markdownToNotebook(text) {
    const { metadata, body } = parseYamlFrontmatter(text || "");
    const lines = body.split(/\r?\n/);
    const cells = [];
    let currentSource = [];
    let inCodeBlock = false;
    let codeFenceLength = 3;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      if (!inCodeBlock) {
        const fenceMatch = trimmed.match(/^(```+|~~~+)(\w*)/);
        if (fenceMatch) {
          if (currentSource.length > 0) {
            const srcText = currentSource.join("\n").trim();
            if (srcText !== "") {
              cells.push({
                cell_type: "markdown",
                metadata: {},
                source: srcText
              });
            }
            currentSource = [];
          }

          inCodeBlock = true;
          codeFenceLength = fenceMatch[1].length;
          continue;
        }
      } else {
        const fenceEndMatch = trimmed.match(/^(```+|~~~+)\s*$/);
        if (fenceEndMatch && fenceEndMatch[1].length >= codeFenceLength) {
          inCodeBlock = false;
          const srcText = currentSource.join("\n");
          cells.push({
            cell_type: "code",
            execution_count: null,
            metadata: {},
            outputs: [],
            source: srcText
          });
          currentSource = [];
          continue;
        }
      }

      currentSource.push(line);
    }

    if (currentSource.length > 0) {
      const srcText = currentSource.join("\n").trim();
      if (srcText !== "" || cells.length === 0) {
        cells.push({
          cell_type: inCodeBlock ? "code" : "markdown",
          metadata: {},
          ...(inCodeBlock ? { execution_count: null, outputs: [] } : {}),
          source: srcText
        });
      }
    }

    if (cells.length === 0) {
      cells.push({
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: ""
      });
    }

    return {
      cells: cells,
      metadata: metadata,
      nbformat: 4,
      nbformat_minor: 5
    };
  }

  function notebookToMarkdown(nb) {
    let md = "";
    const kernel = nb.metadata?.kernelspec || {
      name: "python",
      display_name: "Python (Pyodide)",
      language: "python"
    };

    md += "---\n";
    md += "jupyter:\n";
    md += "  kernelspec:\n";
    md += `    display_name: "${kernel.display_name || "Python (Pyodide)"}"\n`;
    md += `    language: "${kernel.language || "python"}"\n`;
    md += `    name: "${kernel.name || "python"}"\n`;
    md += "---\n\n";

    if (Array.isArray(nb.cells)) {
      for (let i = 0; i < nb.cells.length; i++) {
        const cell = nb.cells[i];
        let source = Array.isArray(cell.source) ? cell.source.join("") : (cell.source || "");

        if (cell.cell_type === "code") {
          const lang = kernel.language || "python";
          md += "```" + lang + "\n";
          md += source;
          if (source.length > 0 && !source.endsWith("\n")) {
            md += "\n";
          }
          md += "```\n\n";
        } else {
          md += source.trim();
          if (source.trim().length > 0) {
            md += "\n\n";
          }
        }
      }
    }

    return md;
  }

  const plugin = {
    id: "julidesk-markdown:plugin",
    autoStart: true,
    activate: function (app) {
      console.log("[juliDESK] Initializing Native Markdown-First Notebook support...");

      const contents = app.serviceManager?.contents;
      if (contents) {
        const origGet = contents.get.bind(contents);
        const origSave = contents.save.bind(contents);
        const origNewUntitled = contents.newUntitled?.bind(contents);

        // Hook contents.get: translate markdown to notebook json when opened in notebook widget
        contents.get = async function (path, options) {
          const isMd = typeof path === "string" && (path.endsWith(".md") || path.endsWith(".markdown"));
          if (isMd && options && (options.type === "notebook" || options.content !== false)) {
            const rawModel = await origGet(path, { ...options, type: "file", format: "text" });
            if (rawModel && typeof rawModel.content === "string") {
              try {
                if (!rawModel.content.trim().startsWith("{")) {
                  rawModel.content = markdownToNotebook(rawModel.content);
                  rawModel.type = "notebook";
                  rawModel.format = "json";
                  rawModel.mimetype = "application/x-ipynb+json";
                }
              } catch (err) {
                console.error("[juliDESK] Error converting Markdown to Notebook:", err);
              }
            }
            return rawModel;
          }
          return origGet(path, options);
        };

        // Hook contents.save: translate notebook json to pure markdown when saved
        contents.save = async function (path, options) {
          const isMd = typeof path === "string" && (path.endsWith(".md") || path.endsWith(".markdown"));
          if (isMd && options && options.content && typeof options.content === "object" && options.content.cells) {
            try {
              const mdText = notebookToMarkdown(options.content);
              const saveOptions = {
                ...options,
                content: mdText,
                format: "text",
                type: "file",
                mimetype: "text/markdown"
              };
              return await origSave(path, saveOptions);
            } catch (err) {
              console.error("[juliDESK] Error converting Notebook to Markdown on save:", err);
            }
          }
          return origSave(path, options);
        };

        // Hook contents.newUntitled: create .md files for new notebooks
        if (origNewUntitled) {
          contents.newUntitled = async function (options) {
            if (options && options.type === "notebook") {
              options.ext = ".md";
              options.type = "file";
            }
            return origNewUntitled(options);
          };
        }
      }

      // Configure default filetype handlers
      if (app.docRegistry) {
        try {
          app.docRegistry.setDefaultWidgetFactory("markdown", "Notebook");
        } catch (e) {
          console.debug("[juliDESK] Default widget factory set to Notebook for markdown.");
        }
      }

      console.log("[juliDESK] Native Markdown-First Notebook support active.");
    }
  };

  const container = {
    get: function (module) {
      return Promise.resolve(function () {
        return { default: plugin, __esModule: true };
      });
    },
    init: function (shareScope) {
      return Promise.resolve();
    }
  };

  (_JUPYTERLAB = void 0 === _JUPYTERLAB ? {} : _JUPYTERLAB)["julidesk-markdown"] = container;
})();
