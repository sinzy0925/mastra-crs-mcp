// C:\Users\sinzy\mastra-crs-mcp\crs-mcp-server\src\server.ts

// --- インポート ---
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import type { Request, Response, NextFunction } from 'express'; // NextFunction をインポート
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http'; // Graceful shutdown のために http をインポート

const execFileAsync = promisify(execFile);

// --- 設定 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MAIN_EXE_PATH = path.resolve(__dirname, '..', 'bin', 'chrome-auto-scraper.exe');
// 環境変数 CHROME_AUTO_SCRAPER_PATH があればそれを使用、なければデフォルト
const MAIN_EXE_PATH = process.env.CHROME_AUTO_SCRAPER_PATH || DEFAULT_MAIN_EXE_PATH;
console.log(`[Server Config] Using chrome-auto-scraper.exe path: ${MAIN_EXE_PATH}`);

// chrome-auto-scraper.exe の作業ディレクトリを実行ファイルと同じディレクトリに設定
const MAIN_EXE_DIR = path.dirname(MAIN_EXE_PATH);
console.log(`[Server Config] Setting chrome-auto-scraper.exe working directory to: ${MAIN_EXE_DIR}`);

const EXECUTION_TIMEOUT = 300000; // 5分 (ミリ秒)
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001; // デフォルトポート 3001

// --- 'run_scraper' ツールの入力スキーマ定義 (Zod を使用) ---
const runScraperInputSchema = z.object({
    setdir: z.string().describe(
        "Directory name containing config files (e.g., 'google--search_query')"
    ),
    search_query: z.string().optional().describe(
        "Search query string (optional)"
    ),
});

// --- 'run_scraper' ツールの実行ハンドラ関数 ---
async function runScraperTool(
    params: z.infer<typeof runScraperInputSchema>
): Promise<CallToolResult> {
    console.log(`[Server Tool][run_scraper] Tool called with params:`, params);

    const args: string[] = ["--setdir", params.setdir];
    if (params.search_query) {
        args.push("--search_query", params.search_query);
    }

    const commandString = `"${MAIN_EXE_PATH}" ${args.map(arg => `"${arg}"`).join(' ')}`;
    console.log(
        `[Server Tool][run_scraper] Executing: ${commandString} in directory "${MAIN_EXE_DIR}"`
    );

    try {
        // chrome-auto-scraper.exe を非同期で実行
        // encoding: 'utf-8' を指定し、stdout/stderr を文字列として受け取る
        const { stdout, stderr } = await execFileAsync(MAIN_EXE_PATH, args, {
            timeout: EXECUTION_TIMEOUT,
            encoding: 'utf-8', // ★★★ UTF-8 を期待してデコード ★★★
            cwd: MAIN_EXE_DIR
        });

        // stdout, stderr が string 型であることを TypeScript に伝える (encoding: 'utf-8' のため)
        const stdoutString = (stdout as string).trim();
        const stderrString = (stderr as string).trim();

        // 標準エラー出力があれば警告としてログ記録
        if (stderrString) {
            console.warn(
                `[Server Tool][run_scraper] chrome-auto-scraper.exe stderr:\n` +
                `--- STDERR ---\n${stderrString}\n------------`
            );
        }

        // 標準出力をログ記録 (長さも表示)
        console.log(
            `[Server Tool][run_scraper] chrome-auto-scraper.exe stdout (length: ${stdoutString.length}):\n` +
            `--- STDOUT ---\n${stdoutString}\n------------`
        );

        // 標準出力が空か、または空白文字のみかチェック
        if (!stdoutString) { // trim() 後のチェックなので、空白のみでもここに入る
            const errorMsg = "Error: Scraper process produced no output.";
            console.error(`[Server Tool][run_scraper] ${errorMsg}`);
            return {
                isError: true,
                content: [{ type: "text", text: errorMsg } satisfies TextContent]
            }; // satisfies は型の互換性チェック
        }

        // 標準出力をJSONとしてパース試行
        let resultData: any;
        try {
            resultData = JSON.parse(stdoutString); // trim() 済みの文字列を使用
            console.log("[Server Tool][run_scraper] Successfully parsed stdout as JSON.");
        } catch (parseError: any) {
            const errorMsg =
                `Error: Could not parse scraper output as JSON. ` +
                `Raw output (first 500 chars):\n${stdoutString.substring(0, 500)}`;
            console.error(
                `[Server Tool][run_scraper] JSON parsing error: ${parseError.message}. ${errorMsg}`,
                parseError // エラーオブジェクト全体もログに出力
            );
            return {
                isError: true,
                content: [{ type: "text", text: errorMsg } satisfies TextContent]
            };
        }

        // 成功応答を返す (JSONを整形した文字列として)
        console.log("[Server Tool][run_scraper] Scraper execution successful.");
        return {
            content: [{ type: "text", text: JSON.stringify(resultData, null, 2) } satisfies TextContent]
        };

    } catch (error: any) {
        // chrome-auto-scraper.exe の実行時エラー (タイムアウト、実行失敗など)
        console.error(`[Server Tool][run_scraper] Error executing chrome-auto-scraper.exe:`, error);

        let detailedErrorMsg = `Failed to execute scraper process.`;
        if (error.message) {
            detailedErrorMsg += ` Message: ${error.message}`;
        }
        // error オブジェクトが持つ可能性のあるプロパティを確認
        if (error.code !== undefined) { // Node.js の child_process エラーは 'code' を持つ
            detailedErrorMsg += ` Exit code: ${error.code}.`;
        }
        if (error.signal !== undefined) { // Node.js の child_process エラーは 'signal' を持つ
            detailedErrorMsg += ` Signal: ${error.signal}.`;
        }
        // stdout/stderr が error オブジェクトに含まれている場合がある (特に実行時エラー)
        if (error.stdout) {
            const execStdout = Buffer.isBuffer(error.stdout) ? error.stdout.toString('utf8') : String(error.stdout);
            detailedErrorMsg += `\n--- Process STDOUT (during error) ---\n${execStdout}`;
        }
        if (error.stderr) {
            const execStderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : String(error.stderr);
            detailedErrorMsg += `\n--- Process STDERR (during error) ---\n${execStderr}`;
        }

        // エラー応答を返す
        return {
            isError: true,
            content: [{ type: "text", text: detailedErrorMsg } satisfies TextContent]
        };
    }
}

// --- MCPサーバーのセットアップ関数 ---
function setupMcpServer(): McpServer {
    console.log("[Server Init] Initializing chromeRecScraper MCP Server...");
    const server = new McpServer({
        name: "chromeRecScraper",
        version: "1.0.0"
    });
    console.log("[Server Init] Server instance created.");

    console.log("[Server Tool] Defining 'run_scraper' tool...");
    server.tool(
        "run_scraper",
        "Executes a pre-configured Playwright web scraping task. Use this tool when the user asks to scrape or search using a specific configuration name (like 'google--search_query' or 'pmda--search_query'). You MUST provide the 'setdir' parameter (the configuration name). You can optionally provide 'search_query'.",
        runScraperInputSchema.shape, // Zod スキーマの形状を渡す
        runScraperTool             // 実行ハンドラ関数を渡す
    );
    console.log("[Server Tool] 'run_scraper' tool defined successfully.");
    return server;
}


// --- Express アプリケーションのセットアップとHTTPサーバー起動 ---
async function startHttpServer() {
    const app = express();

    // オプション: 全てのレスポンスでUTF-8をデフォルトにするミドルウェア
    // 注意: StreamableHTTPServerTransportがContent-Typeを上書きする可能性あり
    /*
    app.use((req: Request, res: Response, next: NextFunction) => {
        // 特定のパス以外でContent-Typeを設定するなどの工夫も可能
        if (!req.path.startsWith('/mcp')) { // 例えば /mcp 以外に適用など
             res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        next();
    });
    */

    // リクエストボディの JSON をパースするミドルウェアを有効化
    app.use(express.json());

    console.log('[HTTP Server] Setting up /mcp endpoints...');

    // POST /mcp : クライアントからのMCPリクエストを受け付けるエンドポイント
    app.post('/mcp', async (req: Request, res: Response) => {
        console.log('[HTTP Server] Received POST /mcp request.');
        // リクエストヘッダーとボディをデバッグログに出力
        console.debug(`[HTTP Server] Request Headers: ${JSON.stringify(req.headers, null, 2)}`);
        console.debug(`[HTTP Server] Request Body: ${JSON.stringify(req.body, null, 2)}`);


        let transport: StreamableHTTPServerTransport | null = null;
        let mcpServerInstance: McpServer | null = null; // 変数名を mcpServerInstance に変更

        try {
            // Stateless モード: リクエストごとに新しいサーバーとトランスポートを作成
            mcpServerInstance = setupMcpServer();
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined // セッション管理なし
            });

            // クライアントが接続を切断した場合のクリーンアップ処理を登録
            res.on('close', () => {
                console.log('[HTTP Server] Request connection closed by client. Cleaning up transport and MCP server instance.');
                if (transport) {
                    transport.close();
                }
                if (mcpServerInstance) {
                    mcpServerInstance.close();
                }
            });

            // 作成した McpServer を Transport に接続
            await mcpServerInstance.connect(transport);
            console.log('[HTTP Server] McpServer connected to transport.');

            // Transport にリクエスト本体 (req.body) を渡して処理させる
            // transport.handleRequest がレスポンス (res) の送信まで行う
            await transport.handleRequest(req, res, req.body);
            console.log('[HTTP Server] Handled POST /mcp request via transport.');

        } catch (error) {
            console.error('[HTTP Server] Error handling POST /mcp request:', error);
            if (!res.headersSent) {
                const requestId = req.body?.id ?? null;
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603, // JSON-RPC Internal error
                        message: 'Internal server error during MCP processing.'
                    },
                    id: requestId
                });
            } else {
                console.error("[HTTP Server] Headers already sent, could not send 500 error response.");
            }
            // エラー時も可能な限りクリーンアップ
            if (transport) {
                transport.close();
            }
            if (mcpServerInstance) {
                mcpServerInstance.close();
            }
        }
    });

    // GET /mcp : Statelessモードでは Server-Sent Events の接続点が通常不要
    app.get('/mcp', async (req: Request, res: Response) => {
        console.log('[HTTP Server] Received GET /mcp request (Method Not Allowed in stateless mode)');
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'POST' });
        res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method Not Allowed. Use POST for MCP requests." },
            id: null
        }));
    });

    // DELETE /mcp : Statelessモードでは不要
    app.delete('/mcp', async (req: Request, res: Response) => {
        console.log('[HTTP Server] Received DELETE /mcp request (Method Not Allowed in stateless mode)');
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'POST' });
        res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method Not Allowed. DELETE is not applicable." },
            id: null
        }));
    });

    // --- HTTPサーバー起動 ---
    const httpServer = http.createServer(app); // Express アプリを http サーバーに渡す

    httpServer.listen(HTTP_PORT, () => {
        console.log("======================================================");
        console.log(` chromeRecScraper MCP Server is running (Stateless HTTP) `);
        console.log(` Listening for POST requests on http://localhost:${HTTP_PORT}/mcp `);
        console.log(` -> Associated chrome-auto-scraper.exe path: ${MAIN_EXE_PATH}`);
        console.log(` -> Working directory for scraper:           ${MAIN_EXE_DIR}`);
        console.log("======================================================");
        console.log("Waiting for client connections...");
    });

    // --- Graceful Shutdown 設定 ---
    const shutdown = (signal: string) => {
        console.log(`\n[System] ${signal} received. Initiating graceful shutdown...`);

        httpServer.close((err?: Error) => { // エラー引数をオプションに
            if (err) {
                console.error("[System] Error during HTTP server shutdown:", err);
                process.exit(1); // エラー終了
            } else {
                console.log("[System] HTTP server closed successfully.");
                // 他のクリーンアップは res.on('close') で対応
                console.log("[System] Exiting process.");
                process.exit(0); // 正常終了
            }
        });

        // 既存の接続が終了するのを待つためのタイムアウト
        const shutdownTimeout = 10000; // 10秒
        setTimeout(() => {
            console.error(
                `[System] Could not close remaining connections gracefully within ${shutdownTimeout / 1000}s. ` +
                `Forcefully shutting down.`
            );
            process.exit(1); // 強制終了
        }, shutdownTimeout);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// --- サーバー起動 ---
startHttpServer().catch(error => {
    console.error("[System] Failed to start the HTTP server:", error);
    process.exit(1);
});