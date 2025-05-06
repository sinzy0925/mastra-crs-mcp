// client.ts (または client-example.ts)

// --- インポート ---
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
// CallToolResult と TextContent, ImageContent, AudioContent をインポート
import {
    CallToolResult,
    TextContent,
    ImageContent,
    AudioContent
} from "@modelcontextprotocol/sdk/types.js";

// --- メインとなる非同期関数 ---
async function main() {
    // 接続先の MCP サーバーのエンドポイント URL
    const serverUrl = new URL("http://localhost:3001/mcp");
    console.log(`[Client] Target MCP server URL: ${serverUrl}`);

    // --- クライアントトランスポートの作成 ---
    const transport = new StreamableHTTPClientTransport(serverUrl);
    console.log("[Client] Created StreamableHTTPClientTransport.");

    // client 変数を try ブロックの外で宣言し、初期値を null にする
    let client: Client | null = null;

    try {
        // client インスタンスを作成
        client = new Client({
            name: "my-scraper-client",
            version: "1.0.0"
        });
        console.log("[Client] Created MCP Client instance.");

        // --- サーバーへの接続 ---
        console.log("[Client] Attempting to connect to the server...");
        await client.connect(transport);
        console.log("[Client] Successfully connected to the MCP server!");

        // --- 利用可能なツールリストを取得して表示 (デバッグ用) ---
        try {
            console.log("[Client] Fetching available tools from the server...");
            const toolsListResponse = await client.listTools();
            const toolNames = toolsListResponse.tools.map(tool => tool.name);
            console.log("[Client] Available tools reported by server:", toolNames);
            if (!toolNames.includes("run_scraper")) {
                 console.warn("[Client] Warning: The expected 'run_scraper' tool was not found in the list from the server.");
            }
        } catch (listError) {
             console.error("[Client] Error fetching tool list:", listError);
        }

        // --- 'run_scraper' ツールを呼び出すためのパラメータ ---
        const toolNameToCall = "run_scraper";
        const toolArguments = {
            setdir: "google--search_query",
            search_query: "Model Context Protocol latest updates" // 検索クエリ例
        };
        console.log(`\n[Client] Preparing to call tool '${toolNameToCall}' with arguments:`, JSON.stringify(toolArguments));

        // --- ツール呼び出しの実行と時間計測 ---
        console.log(`[Client] Executing tool call: ${toolNameToCall}...`);
        const startTime = Date.now();

        // 型アサーション 'as CallToolResult' を使用
        const result = await client.callTool({
            name: toolNameToCall,
            arguments: toolArguments,
        }) as CallToolResult;

        const duration = Date.now() - startTime;
        console.log(`[Client] Tool call request completed. Duration: ${duration}ms.`);

        // --- ツール実行結果の処理 ---
        console.log("\n[Client] Processing tool call result...");

        // isError フラグで成功か失敗かを判断
        if (result.isError) {
            // ツール実行がサーバー側でエラーになった場合
            console.error("[Client] Tool execution resulted in an ERROR on the server:");
            if (result.content && result.content.length > 0) {
                result.content.forEach((contentItem, index: number) => {
                    // エラーの場合も contentItem の型をチェック
                    if (contentItem.type === 'text') {
                        console.error(`  Error Content [${index}]: ${contentItem.text}`);
                    } else {
                        console.error(`  Received non-text error content [${index}]:`, contentItem);
                    }
                });
            } else {
                console.error("  Error details were not provided in the 'content' field. Check server logs for more information.");
            }
        } else {
            // ツール実行が成功した場合
            console.log("[Client] Tool execution SUCCEEDED:");
            if (result.content && result.content.length > 0) {
                result.content.forEach((contentItem, index: number) => {
                    console.log(`\n  Result Content [${index}]: Type: '${contentItem.type}'`); // タイプを明確に表示

                    // 型ガードを使って安全にプロパティにアクセス
                    if (contentItem.type === 'text') {
                        // === デバッグログ追加 ===
                        console.log(`    [Debug] Received text content. Length: ${contentItem.text?.length ?? 'undefined/null'}`);
                        // テキストが空やnullでないか確認
                        if (contentItem.text && contentItem.text.trim().length > 0) {
                             console.log(`    [Debug] Raw text received (first 100 chars): '${contentItem.text.substring(0, 100)}...'`);
                            try {
                                // JSONとしてパース試行
                                const jsonData = JSON.parse(contentItem.text); // "null" でのフォールバックは削除、パース失敗はcatchで処理
                                console.log("    [Debug] Successfully parsed text content as JSON.");
                                // 整形してコンソールに出力
                                console.log("    Parsed JSON Data:");
                                console.log(JSON.stringify(jsonData, null, 2)); // インデント付きで表示

                            } catch (parseError) {
                                // JSON パースに失敗した場合
                                console.error("    [Debug] Error parsing text content as JSON:", parseError);
                                console.log("    (Showing raw text content instead)");
                                console.log(`    Raw Text:`);
                                console.log(contentItem.text); // パース失敗時は生のテキストを表示
                            }
                        } else {
                            console.log("    [Debug] Text content is empty, null, or whitespace.");
                            console.log(`    Raw Text: '${contentItem.text}'`); // 空でも一応表示
                        }
                         // === デバッグログ追加終わり ===
                    } else if (contentItem.type === 'image') {
                        // ImageContent 型
                        console.log(`    Image MimeType: ${contentItem.mimeType}`);
                        console.log(`    Image Data (Base64 Preview): ${contentItem.data.substring(0, 50)}... [Length: ${contentItem.data.length}]`);
                    } else if (contentItem.type === 'audio') {
                        // AudioContent 型
                         console.log(`    Audio MimeType: ${contentItem.mimeType}`);
                         console.log(`    Audio Data (Base64 Preview): ${contentItem.data.substring(0, 50)}... [Length: ${contentItem.data.length}]`);
                    // } else if (contentItem.type === 'resource') {
                        // 必要であれば Resource 型の処理を追加
                    } else {
                        // SDK が定義する上記以外のコンテンツタイプの場合
                        console.log(`    Unknown or unexpected content type:`, contentItem);
                    }
                });
            } else {
                console.log("  Tool returned successfully but provided no content (result.content array is empty or null).");
            }
        }

    } catch (error) {
        // 接続エラー、プロトコルエラー、タイムアウトなど、ツール呼び出し以外のエラー
        console.error("\n[Client] An unexpected error occurred during the client operation:", error);
        if (error instanceof Error) {
             console.error(`  Error Message: ${error.message}`);
             // console.error(`  Stack Trace: ${error.stack}`); // 必要ならスタックトレースも
        }
    } finally {
        // --- クライアントの切断処理 ---
        if (client) {
            console.log("\n[Client] Attempting to disconnect from the server (if connected)...");
            try {
                await client.close();
                console.log("[Client] Disconnect process finished (connection closed if it was open).");
            } catch (closeError) {
                console.error("[Client] Error occurred during disconnection attempt:", closeError);
            }
        } else {
             console.log("\n[Client] Client instance was not created, skipping disconnection.");
        }
    }
}

// --- スクリプトのエントリーポイント ---
main().catch(error => {
    console.error("[Client] Fatal error running the client script:", error);
    process.exit(1);
});