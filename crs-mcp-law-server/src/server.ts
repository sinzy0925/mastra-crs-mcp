// ./crs-mcp-law-server/src/server.ts

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
const LAW_ANALYZER_EXE_PATH = path.resolve(__dirname, '..', 'bin', 'chrome-law-analyzer.exe');
console.log(`[Law Server Config] Using chrome-law-analyzer.exe path: ${LAW_ANALYZER_EXE_PATH}`);

// EXEの作業ディレクトリも自身の bin ディレクトリ
const LAW_ANALYZER_EXE_DIR = path.dirname(LAW_ANALYZER_EXE_PATH);
console.log(`[Law Server Config] Setting chrome-law-analyzer.exe working directory to: ${LAW_ANALYZER_EXE_DIR}`);

const EXECUTION_TIMEOUT = 600000; // 10分 (ミリ秒)
const HTTP_PORT = process.env.LAW_SERVER_PORT ? parseInt(process.env.LAW_SERVER_PORT, 10) : 3002; // Law Analyzer用ポート (Scraper Serverと異なるポート)


// --- 'run_law_analyzer' ツールの入力スキーマ定義 ---
const runLawAnalyzerInputSchema = z.object({
    setdir: z.string().describe(
        "Directory name containing law analysis config files within the law analyzer's bin directory (e.g., 'law', 'kenchiku-kijunhou'). This must be provided."
    ),
    law_search_keyword: z.string().describe(
        "Keyword to search for within the law document HTML. This must be provided."
    ),
});

// --- 'run_law_analyzer' ツールの実行ハンドラ関数 ---
async function runLawAnalyzerTool(
    params: z.infer<typeof runLawAnalyzerInputSchema>
): Promise<CallToolResult> {
    console.log(`[Law Server Tool][run_law_analyzer] Tool called with params:`, params);

    const args: string[] = [
        "--setdir", params.setdir,
        "--law-search-keyword", params.law_search_keyword
    ];

    const commandString = `"${LAW_ANALYZER_EXE_PATH}" ${args.map(arg => `"${arg}"`).join(' ')}`;
    console.log(
        `[Law Server Tool][run_law_analyzer] Executing: ${commandString} in directory "${LAW_ANALYZER_EXE_DIR}"`
    );

    try {
        const { stdout, stderr } = await execFileAsync(LAW_ANALYZER_EXE_PATH, args, {
            timeout: EXECUTION_TIMEOUT,
            encoding: 'utf-8',
            cwd: LAW_ANALYZER_EXE_DIR
        });

        const stdoutString = (stdout as string).trim();
        const stderrString = (stderr as string).trim();

        if (stderrString) {
            console.warn(
                `[Law Server Tool][run_law_analyzer] chrome-law-analyzer.exe stderr:\n` +
                `--- STDERR ---\n${stderrString}\n------------`
            );
        }

        console.log(
            `[Law Server Tool][run_law_analyzer] chrome-law-analyzer.exe stdout (length: ${stdoutString.length}):\n` +
            `--- STDOUT ---\n${stdoutString}\n------------`
        );

        if (!stdoutString) {
             const errorMsg = "Error: Law analyzer process produced no output.";
             console.error(`[Law Server Tool][run_law_analyzer] ${errorMsg}`);
             return {
                 isError: true,
                 content: [{ type: "text", text: errorMsg }]
             };
        }

        // chrome-law-analyzer.py はキーワードが見つからない場合に "[] # Keyword '...' not found." を返す
         if (stdoutString.startsWith("[] # Keyword ")) {
             console.log("[Law Server Tool][run_law_analyzer] Law analyzer process returned empty result (keyword not found).");
              return {
                 content: [{ type: "text", text: stdoutString }] // コメント付き文字列をそのまま返す
              };
         }

        let resultData: any;
        try {
            resultData = JSON.parse(stdoutString);
            console.log("[Law Server Tool][run_law_analyzer] Successfully parsed stdout as JSON.");
            return {
                content: [{ type: "text", text: JSON.stringify(resultData, null, 2) }]
            };

        } catch (parseError: any) {
            const errorMsg =
                `Error: Could not parse law analyzer output as JSON. ` +
                `Raw output (first 500 chars):\n${stdoutString.substring(0, 500)}`;
            console.error(
                `[Law Server Tool][run_law_analyzer] JSON parsing error: ${parseError.message}. ${errorMsg}`,
                parseError
            );
            return {
                isError: true,
                content: [{ type: "text", text: errorMsg }]
            };
        }

    } catch (error: any) {
        console.error(`[Law Server Tool][run_law_analyzer] Error executing chrome-law-analyzer.exe:`, error);

        let detailedErrorMsg = `Failed to execute law analyzer process.`;
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
    console.log("[Law Server Init] Initializing Law Analyzer MCP Server...");
    const server = new McpServer({
        name: "LawAnalyzer", // このサーバーは法令解析ツールを扱う（Scraper Serverと異なる名前にする推奨）
        version: "1.0.0"
    });
    console.log("[Law Server Init] Server instance created.");

    // run_law_analyzer ツールのみを登録
    console.log("[Law Server Tool] Defining 'run_law_analyzer' tool...");
     server.tool(
        "run_law_analyzer",
        "Analyzes a specific e-Gov law HTML page to find occurrences of a keyword and extract relevant sections. Use this tool when the user explicitly asks to find information about a specific term within a known law (e.g., '建築基準法で階段について調べて'). You MUST provide the 'setdir' parameter (the law configuration name) and the 'law_search_keyword'.",
        runLawAnalyzerInputSchema.shape,
        runLawAnalyzerTool
    );
    console.log("[Law Server Tool] 'run_law_analyzer' tool defined successfully.");

    return server;
}


// --- Express アプリケーションのセットアップとHTTPサーバー起動 ---
async function startHttpServer() {
    const app = express();
    app.use(express.json());

    console.log(`[Law HTTP Server] Setting up /mcp endpoint on port ${HTTP_PORT}...`);

    app.post('/mcp', async (req: Request, res: Response) => {
        console.log('[Law HTTP Server] Received POST /mcp request');
        console.debug(`[Law HTTP Server] Request Headers: ${JSON.stringify(req.headers, null, 2)}`);
        console.debug(`[Law HTTP Server] Request Body: ${JSON.stringify(req.body, null, 2)}`);

        let transport: StreamableHTTPServerTransport | null = null;
        let mcpServerInstance: McpServer | null = null;

        try {
            mcpServerInstance = setupMcpServer();
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined
            });

            res.on('close', () => {
                console.log('[Law HTTP Server] Request connection closed by client. Cleaning up transport and MCP server instance.');
                if (transport) {
                    transport.close();
                }
                if (mcpServerInstance) {
                    mcpServerInstance.close(); // SDKがcloseを持っているか確認
                }
            });

            await mcpServerInstance.connect(transport);
            console.log('[Law HTTP Server] McpServer connected to transport.');

            await transport.handleRequest(req, res, req.body);
            console.log('[Law HTTP Server] Handled POST /mcp request via transport.');

        } catch (error) {
            console.error('[Law HTTP Server] Error handling POST /mcp request:', error);
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
                console.error("[Law HTTP Server] Headers already sent, could not send 500 error response.");
            }
            if (transport) {
                transport.close();
            }
            if (mcpServerInstance) {
                mcpServerInstance.close(); // SDKがcloseを持っているか確認
            }
        }
    });

    app.get('/mcp', (req: Request, res: Response) => {
        console.log('[Law HTTP Server] Received GET /mcp request (Method Not Allowed)');
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'POST' });
        res.end(JSON.stringify({
            jsonrpc: "2.0", error: { code: -32601, message: "Method Not Allowed. Use POST for MCP requests." }, id: null
        }));
    });

    app.delete('/mcp', (req: Request, res: Response) => {
        console.log('[Law HTTP Server] Received DELETE /mcp request (Method Not Allowed)');
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
        console.log(` Law Analyzer MCP Server is running (HTTP) `);
        console.log(` Listening for POST requests on http://localhost:${HTTP_PORT}/mcp `);
        console.log(` -> Associated chrome-law-analyzer.exe path: ${LAW_ANALYZER_EXE_PATH}`);
        console.log(` -> Working directory for analyzer:           ${LAW_ANALYZER_EXE_DIR}`);
        console.log("======================================================");
        console.log("Waiting for client connections...");
    });

    // --- Graceful Shutdown 設定 ---
    const shutdown = (signal: string) => {
        console.log(`\n[Law Server System] ${signal} received. Initiating graceful shutdown...`);

        httpServer.close((err?: Error) => {
            if (err) {
                console.error("[Law Server System] Error during HTTP server shutdown:", err);
                process.exit(1);
            } else {
                console.log("[Law Server System] HTTP server closed successfully.");
                console.log("[Law Server System] Exiting process.");
                process.exit(0);
            }
        });

        const shutdownTimeout = 15000;
        setTimeout(() => {
            console.error(
                `[Law Server System] Could not close remaining connections gracefully within ${shutdownTimeout / 1000}s. ` +
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
    console.error("[Law Server System] Failed to start the HTTP server:", error);
    process.exit(1);
});