// C:\Users\sinzy\mastra-crs-mcp\crs-mcp-server\src\server.ts

// --- インポート ---
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js"; // types.jsからインポート
import express from 'express';
import type { Request, Response } from 'express'; // Express の型をインポート
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

// --- 設定 ---
const DEFAULT_MAIN_EXE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'chrome-auto-scraper.exe');
const MAIN_EXE_PATH = DEFAULT_MAIN_EXE_PATH;
console.log(`[Server Config] Using chrome-auto-scraper.exe path: ${MAIN_EXE_PATH}`);
const MAIN_EXE_DIR = path.dirname(MAIN_EXE_PATH);
console.log(`[Server Config] Setting chrome-auto-scraper.exe working directory to: ${MAIN_EXE_DIR}`);
const EXECUTION_TIMEOUT = 300000; // 2 minutes
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001; // Default port 3001

// --- 'run_scraper' ツールの定義 (関数) ---
const runScraperInputSchema = z.object({
  setdir: z.string().describe("Directory name containing config files (e.g., 'google--search_query')"),
  search_query: z.string().optional().describe("Search query string (optional)"),
});

// ツール実行ハンドラ関数
async function runScraperTool(params: z.infer<typeof runScraperInputSchema>): Promise<CallToolResult> {
    console.log(`[Server Tool] 'run_scraper' called with params:`, params);
    const args: string[] = ["--setdir", params.setdir];
    if (params.search_query) {
      args.push("--search_query", params.search_query);
    }
    console.log(`[Server Tool] Executing: "${MAIN_EXE_PATH}" ${args.map(arg => `"${arg}"`).join(" ")} in directory "${MAIN_EXE_DIR}"`);

    try {
      // chrome-auto-scraper.exe を実行
      const { stdout, stderr } = await execFileAsync(MAIN_EXE_PATH, args, {
        timeout: EXECUTION_TIMEOUT, encoding: 'utf-8', cwd: MAIN_EXE_DIR
      });

      // 標準エラー出力を警告としてログ記録
      if (stderr) {
        console.warn(`[Server Tool] chrome-auto-scraper.exe stderr:\n--- STDERR ---\n${stderr}\n------------`);
      }
      // 標準出力をログ記録
      console.log(`[Server Tool] chrome-auto-scraper.exe stdout:\n--- STDOUT ---\n${stdout}\n------------`);

      // 標準出力が空かチェック
      if (!stdout || stdout.trim() === "") {
          console.error("[Server Tool] Error: Scraper process produced no output.");
          return {
              isError: true,
              content: [{ type: "text", text: "Error: Scraper process produced no output." } satisfies TextContent]
          } satisfies CallToolResult;
      }

      // JSON パース試行
      let resultData: any;
      try {
          resultData = JSON.parse(stdout.trim());
      } catch (parseError) {
          console.error("[Server Tool] Error: Could not parse output as JSON:", parseError);
          return {
              isError: true,
              content: [{ type: "text", text: `Error: Could not parse output as JSON. Raw:\n${stdout}` } satisfies TextContent]
          } satisfies CallToolResult;
      }

      // 成功応答
      console.log("[Server Tool] Scraper execution successful.");
      return {
          content: [{ type: "text", text: JSON.stringify(resultData, null, 2) } satisfies TextContent]
      } satisfies CallToolResult;

    } catch (error: any) {
      // chrome-auto-scraper.exe 実行時エラー
      console.error(`[Server Tool] Error executing chrome-auto-scraper.exe:`, error);
      let msg = `Failed to execute scraper process: ${error.message || 'Unknown error'}`;
      if (error.stdout) msg += `\n--- STDOUT ---\n${error.stdout}`;
      if (error.stderr) msg += `\n--- STDERR ---\n${error.stderr}`;
      if (error.code !== undefined) msg += `\nExit code: ${error.code}`;
      if (error.signal) msg += `\nSignal: ${error.signal}`;
      // エラー応答
      return {
          isError: true,
          content: [{ type: "text", text: msg } satisfies TextContent]
      } satisfies CallToolResult;
    }
}

// --- MCPサーバーのセットアップ関数 ---
function setupMcpServer(): McpServer {
    console.log("[Server Init] Initializing chromeRecScraper MCP Server...");
    const server = new McpServer({ name: "chromeRecScraper", version: "1.0.0" });
    console.log("[Server Init] Server instance created.");

    console.log("[Server Tool] Defining 'run_scraper' tool...");
    server.tool(
        "run_scraper",
        // より具体的に、LLMがどういう時に使うべきかわかるように記述
        "Executes a pre-configured Playwright web scraping task. Use this tool when the user asks to scrape or search using a specific configuration name (like 'google--search_query' or 'pmda--search_query'). You MUST provide the 'setdir' parameter (the configuration name). You can optionally provide 'search_query'.",
        runScraperInputSchema.shape,
        runScraperTool
    );
    console.log("[Server Tool] 'run_scraper' tool defined successfully.");
    return server;
}


// --- Express アプリケーションのセットアップと起動 ---
async function startHttpServer() {
    const app = express();
    // リクエストボディの JSON をパースするミドルウェアを有効化
    app.use(express.json());

    console.log('[HTTP Server] Setting up /mcp endpoints...');

    // POST /mcp : クライアントからのリクエストを受け付け、処理する
    app.post('/mcp', async (req: Request, res: Response) => {
        console.log('[HTTP Server] Received POST /mcp request');
        let transport: StreamableHTTPServerTransport | null = null;
        let server: McpServer | null = null;
        try {
            // リクエストごとに新しいサーバーとトランスポートを作成 (Stateless)
            server = setupMcpServer();
            transport = new StreamableHTTPServerTransport({
                 sessionIdGenerator: undefined // セッション管理なし
            });

            // リクエストがクライアント側から閉じられた場合のクリーンアップ
            res.on('close', () => {
                console.log('[HTTP Server] Request connection closed by client. Cleaning up transport and server.');
                transport?.close(); // Transport を閉じる (関連リソース解放)
                server?.close();    // McpServer を閉じる (内部状態リセットなど)
            });

            // 作成した McpServer を Transport に接続
            await server.connect(transport);

            // Transport にリクエストを処理させる (req.body を渡す)
            // transport.handleRequest は内部でレスポンス (res) を処理する
            await transport.handleRequest(req, res, req.body);
            console.log('[HTTP Server] Handled POST /mcp request via transport.');

        } catch (error) {
            console.error('[HTTP Server] Error handling POST /mcp request:', error);
            // エラーが発生しても、ヘッダーが送信されていなければ 500 エラーを返す
            if (!res.headersSent) {
                res.status(500).json({
                     jsonrpc: '2.0',
                     error: { code: -32603, message: 'Internal server error during MCP processing' },
                     id: req.body?.id ?? null // リクエストIDがあればそれを返す
                });
            } else {
                // ヘッダー送信済みの場合、レスポンスは変更できない
                console.error("[HTTP Server] Headers already sent, could not send error response.");
            }
            // エラー時も Transport と Server のクリーンアップを試みる
            transport?.close();
            server?.close();
        }
    });

    // GET /mcp : Statelessモードでは通常不要 (SSE ストリーム用だがセッションがない)
    app.get('/mcp', async (req: Request, res: Response) => {
        console.log('[HTTP Server] Received GET /mcp request (ignoring in stateless mode)');
        res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({
            jsonrpc: "2.0", error: { code: -32601, message: "Method not allowed for stateless /mcp GET endpoint" }, id: null
        }));
    });

    // DELETE /mcp : Statelessモードでは不要
    app.delete('/mcp', async (req: Request, res: Response) => {
        console.log('[HTTP Server] Received DELETE /mcp request (ignoring in stateless mode)');
        res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({
            jsonrpc: "2.0", error: { code: -32601, message: "Method not allowed for stateless /mcp DELETE endpoint" }, id: null
        }));
    });

    // HTTPサーバーを指定したポートで起動
    const httpServer = app.listen(HTTP_PORT, () => { // listen の戻り値を取得
        console.log("======================================================");
        console.log(` chromeRecScraper MCP Server is running (HTTP) `);
        console.log(` Listening on http://localhost:${HTTP_PORT}/mcp `);
        console.log(` chrome-auto-scraper.exe path: ${MAIN_EXE_PATH}`);
        console.log(` Working dir:   ${MAIN_EXE_DIR}`);
        console.log("======================================================");
    });

    // --- Graceful Shutdown の設定 (より推奨される方法) ---
    const shutdown = (signal: string) => {
        console.log(`\n${signal} received. Shutting down HTTP server...`);
        httpServer.close(() => {
            console.log("HTTP server closed.");
            // 必要であれば MCP Server のクリーンアップもここで行う (Statelessなら不要かも)
            // server?.close().finally(() => process.exit(0));
            process.exit(0);
        });
        // すぐに終了しない場合、タイムアウトを設定することも可能
        setTimeout(() => {
            console.error("Could not close connections in time, forcefully shutting down");
            process.exit(1);
        }, 10000); // 例: 10秒
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// HTTPサーバー起動関数の実行
startHttpServer();