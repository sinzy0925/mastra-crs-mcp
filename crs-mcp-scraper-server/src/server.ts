// ./crs-mcp-scraper-server/src/server.ts

// --- インポート ---
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import type { Request, Response } from 'express';
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const execFileAsync = promisify(execFile);

// --- 設定 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// このサーバーが呼び出すEXEのパスは、自身の bin ディレクトリ内
const AUTO_SCRAPER_EXE_PATH = path.resolve(__dirname, '..', 'bin', 'chrome-auto-scraper.exe');
console.log(`[Scraper Server Config] Using chrome-auto-scraper.exe path: ${AUTO_SCRAPER_EXE_PATH}`);

// EXEの作業ディレクトリも自身の bin ディレクトリ
const AUTO_SCRAPER_EXE_DIR = path.dirname(AUTO_SCRAPER_EXE_PATH);
console.log(`[Scraper Server Config] Setting chrome-auto-scraper.exe working directory to: ${AUTO_SCRAPER_EXE_DIR}`);

const EXECUTION_TIMEOUT = 600000; // 10分 (ミリ秒)
const HTTP_PORT = process.env.SCRAPER_SERVER_PORT ? parseInt(process.env.SCRAPER_SERVER_PORT, 10) : 3001; // Scraper用ポート

// --- 'run_scraper' ツールの入力スキーマ定義 ---
const runScraperInputSchema = z.object({
    setdir: z.string().describe(
        "Directory name containing config files within the scraper's bin directory (e.g., 'google--search_query')"
    ),
    search_query: z.string().optional().describe(
        "Search query string (optional)"
    ),
});

// --- 'run_scraper' ツールの実行ハンドラ関数 ---
async function runScraperTool(
    params: z.infer<typeof runScraperInputSchema>
): Promise<CallToolResult> {
    console.log(`[Scraper Server Tool][run_scraper] Tool called with params:`, params);

    const args: string[] = ["--setdir", params.setdir];
    if (params.search_query) {
        args.push("--search_query", params.search_query);
    }

    const commandString = `"${AUTO_SCRAPER_EXE_PATH}" ${args.map(arg => `"${arg}"`).join(' ')}`;
    console.log(
        `[Scraper Server Tool][run_scraper] Executing: ${commandString} in directory "${AUTO_SCRAPER_EXE_DIR}"`
    );

    try {
        const { stdout, stderr } = await execFileAsync(AUTO_SCRAPER_EXE_PATH, args, {
            timeout: EXECUTION_TIMEOUT,
            encoding: 'utf-8',
            cwd: AUTO_SCRAPER_EXE_DIR
        });

        const stdoutString = (stdout as string).trim();
        const stderrString = (stderr as string).trim();

        if (stderrString) {
            console.warn(
                `[Scraper Server Tool][run_scraper] chrome-auto-scraper.exe stderr:\n` +
                `--- STDERR ---\n${stderrString}\n------------`
            );
        }

        console.log(
            `[Scraper Server Tool][run_scraper] chrome-auto-scraper.exe stdout (length: ${stdoutString.length}):\n` +
            `--- STDOUT ---\n${stdoutString}\n------------`
        );

        if (!stdoutString) {
            const errorMsg = "Error: Scraper process produced no output.";
            console.error(`[Scraper Server Tool][run_scraper] ${errorMsg}`);
            return {
                isError: true,
                content: [{ type: "text", text: errorMsg }]
            };
        }

        let resultData: any;
        try {
            resultData = JSON.parse(stdoutString);
            console.log("[Scraper Server Tool][run_scraper] Successfully parsed stdout as JSON.");
            return {
                content: [{ type: "text", text: JSON.stringify(resultData, null, 2) }]
            };
        } catch (parseError: any) {
            const errorMsg =
                `Error: Could not parse scraper output as JSON. ` +
                `Raw output (first 500 chars):\n${stdoutString.substring(0, 500)}`;
            console.error(
                `[Scraper Server Tool][run_scraper] JSON parsing error: ${parseError.message}. ${errorMsg}`,
                parseError
            );
            return {
                isError: true,
                content: [{ type: "text", text: errorMsg }]
            };
        }

    } catch (error: any) {
        console.error(`[Scraper Server Tool][run_scraper] Error executing chrome-auto-scraper.exe:`, error);

        let detailedErrorMsg = `Failed to execute scraper process.`;
        if (error.message) detailedErrorMsg += ` Message: ${error.message}`;
        if (error.code !== undefined) detailedErrorMsg += ` Exit code: ${error.code}.`;
        if (error.signal !== undefined) detailedErrorMsg += ` Signal: ${error.signal}.`;
        if (error.stdout) {
            const execStdout = Buffer.isBuffer(error.stdout) ? error.stdout.toString('utf8') : String(error.stdout);
            detailedErrorMsg += `\n--- Process STDOUT (during error) ---\n${execStdout}`;
        }
        if (error.stderr) {
            const execStderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : String(error.stderr);
            detailedErrorMsg += `\n--- Process STDERR (during error) ---\n${execStderr}`;
        }

        return {
            isError: true,
            content: [{ type: "text", text: detailedErrorMsg }]
        };
    }
}

// --- MCPサーバーのセットアップ関数 ---
function setupMcpServer(): McpServer {
    console.log("[Scraper Server Init] Initializing chromeRecScraper MCP Server...");
    const server = new McpServer({
        name: "chromeRecScraper", // このサーバーはスクレイパーを扱う
        version: "1.0.0"
    });
    console.log("[Scraper Server Init] Server instance created.");

    // run_scraper ツールのみを登録
    console.log("[Scraper Server Tool] Defining 'run_scraper' tool...");
    server.tool(
        "run_scraper",
        "Executes a pre-configured Playwright web scraping task. Use this tool when the user asks to scrape or search using a specific configuration name (like 'google--search_query' or 'pmda--search_query'). You MUST provide the 'setdir' parameter (the configuration name). You can optionally provide 'search_query'.",
        runScraperInputSchema.shape,
        runScraperTool
    );
    console.log("[Scraper Server Tool] 'run_scraper' tool defined successfully.");

    return server;
}

// --- Express アプリケーションのセットアップとHTTPサーバー起動 ---
async function startHttpServer() {
    const app = express();
    app.use(express.json());

    console.log(`[Scraper HTTP Server] Setting up /mcp endpoint on port ${HTTP_PORT}...`);

    app.post('/mcp', async (req: Request, res: Response) => {
        console.log('[Scraper HTTP Server] Received POST /mcp request');
        console.debug(`[Scraper HTTP Server] Request Headers: ${JSON.stringify(req.headers, null, 2)}`);
        console.debug(`[Scraper HTTP Server] Request Body: ${JSON.stringify(req.body, null, 2)}`);

        let transport: StreamableHTTPServerTransport | null = null;
        let mcpServerInstance: McpServer | null = null;

        try {
            mcpServerInstance = setupMcpServer();
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined
            });

            res.on('close', () => {
                console.log('[Scraper HTTP Server] Request connection closed by client. Cleaning up transport and MCP server instance.');
                if (transport) {
                    transport.close();
                }
                if (mcpServerInstance) {
                    mcpServerInstance.close();
                }
            });

            await mcpServerInstance.connect(transport);
            console.log('[Scraper HTTP Server] McpServer connected to transport.');

            await transport.handleRequest(req, res, req.body);
            console.log('[Scraper HTTP Server] Handled POST /mcp request via transport.');

        } catch (error) {
            console.error('[Scraper HTTP Server] Error handling POST /mcp request:', error);
            if (!res.headersSent) {
                const requestId = req.body?.id ?? null;
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error during MCP processing'
                    },
                    id: requestId
                });
            } else {
                console.error("[Scraper HTTP Server] Headers already sent, could not send 500 error response.");
            }
            if (transport) {
                transport.close();
            }
            if (mcpServerInstance) {
                mcpServerInstance.close();
            }
        }
    });

    app.get('/mcp', (req: Request, res: Response) => {
        console.log('[Scraper HTTP Server] Received GET /mcp request (Method Not Allowed)');
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'POST' });
        res.end(JSON.stringify({
            jsonrpc: "2.0", error: { code: -32601, message: "Method Not Allowed. Use POST for MCP requests." }, id: null
        }));
    });

     app.delete('/mcp', (req: Request, res: Response) => {
        console.log('[Scraper HTTP Server] Received DELETE /mcp request (Method Not Allowed)');
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'POST' });
        res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method Not Allowed. DELETE is not applicable." },
            id: null
        }));
    });


    // --- HTTPサーバー起動 ---
    const httpServer = http.createServer(app);

    httpServer.listen(HTTP_PORT, () => {
        console.log("======================================================");
        console.log(` chromeRecScraper MCP Server is running (HTTP) `);
        console.log(` Listening for POST requests on http://localhost:${HTTP_PORT}/mcp `);
        console.log(` -> Associated chrome-auto-scraper.exe path: ${AUTO_SCRAPER_EXE_PATH}`);
        console.log(` -> Working directory for scraper:           ${AUTO_SCRAPER_EXE_DIR}`);
        console.log("======================================================");
        console.log("Waiting for client connections...");
    });

    // --- Graceful Shutdown 設定 ---
    const shutdown = (signal: string) => {
        console.log(`\n[Scraper Server System] ${signal} received. Initiating graceful shutdown...`);

        httpServer.close((err?: Error) => {
            if (err) {
                console.error("[Scraper Server System] Error during HTTP server shutdown:", err);
                process.exit(1);
            } else {
                console.log("[Scraper Server System] HTTP server closed successfully.");
                console.log("[Scraper Server System] Exiting process.");
                process.exit(0);
            }
        });

        const shutdownTimeout = 15000;
        setTimeout(() => {
            console.error(
                `[Scraper Server System] Could not close remaining connections gracefully within ${shutdownTimeout / 1000}s. ` +
                `Forcefully shutting down.`
            );
            process.exit(1);
        }, shutdownTimeout);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// --- サーバー起動 ---
startHttpServer().catch(error => {
    console.error("[Scraper Server System] Failed to start the HTTP server:", error);
    process.exit(1);
});