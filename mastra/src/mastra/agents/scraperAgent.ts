// ./mastra/src/mastra/agents/scraperAgent.ts

// --- インポート ---
import { google } from "@ai-sdk/google"; // AI モデルとして Google Gemini を使用
import { Agent } from "@mastra/core/agent"; // Mastra の Agent クラス
import { openai } from "@ai-sdk/openai"; // OpenAI モデルを使う場合のためにインポート (未使用なら削除可)
import { MCPClient } from "@mastra/mcp"; // MCPClient クラス
// MCP ツール定義に必要な型をインポート
// SDK バージョンによって存在しない場合はコメントアウトやanyへの置き換えが必要
//import { ToolDefinition, ToolInputSchemaProperty } from "@modelcontextprotocol/sdk/types.js";
import { URL } from 'node:url'; // URL クラス

// --- 設定 ---
// この Agent が通信する Scraper MCP Server の接続情報を定義
// 環境変数 SCRAPER_SERVER_HOST, SCRAPER_SERVER_PORT があれば優先的に使用
const SCRAPER_SERVER_HOST: string = process.env.CRS_SERVER_HOST || 'localhost';
const SCRAPER_SERVER_PORT: number = process.env.SCRAPER_SERVER_PORT ? parseInt(process.env.SCRAPER_SERVER_PORT, 10) : 3001; // Scraper Server のデフォルトポート 3001

// Scraper MCP Server の完全な URL を構築
const SCRAPER_SERVER_MCP_URL: string = `http://${SCRAPER_SERVER_HOST}:${SCRAPER_SERVER_PORT}/mcp`;
console.log(`[Scraper Agent Definition] Target Scraper MCP Server URL: ${SCRAPER_SERVER_MCP_URL}`);

// --- MCP Client の初期化 ---
// この Agent 専用の MCPClient インスタンスを生成します。
// Law Analyzer Agent とは異なるサーバーURLを使用するため、重複初期化エラーは発生しません。
// id を設定すると、MCP クライアントの内部ログなどで識別しやすくなります。
const mcpClientScraper = new MCPClient({
    servers: {
        // ★★★ 注意 ★★★
        // ここでのキー ('chromeRecScraper') は、連携する Scraper Server の McpServer インスタンス名と一致させる必要があります。
        // crs-mcp-scraper-server/src/server.ts で new McpServer({ name: "chromeRecScraper", ... }) と定義されている場合、このキーは "chromeRecScraper" となります。
        // McpServer 名が異なる場合は、ここをその名前に修正してください。
        chromeRecScraper: { // サーバー設定名（Mastra Agentがツールを識別する際のプレフィックスにもなる）
            url: new URL(SCRAPER_SERVER_MCP_URL), // サーバーのURL
        }
    },
    id: "scraper-agent-client", // このクライアントインスタンスを識別するためのユニークなID
});
console.log("[Scraper Agent Definition] Dedicated MCPClient instance created.");

// --- エージェント定義用の非同期関数 ---
// Agent インスタンスの定義は非同期処理（ツールの取得など）を含むため、非同期関数内で定義します。
async function defineScraperAgent() {
    console.log("[Scraper Agent Definition] Fetching MCP tools...");
    // ツール情報を保持するオブジェクトを初期化
    let mcpTools: Record<string, any> = {}; // 取得ツールの正確な型が不明なため any を使用

    try {
        // 外部から渡された mcpClientScraper インスタンスを使用して、サーバーからツール情報を取得
        const fetchedTools = await mcpClientScraper.getTools();
        // 取得したツール情報が期待通りの形式であると仮定し、必要なツールを抽出
        const toolData: any = fetchedTools; // SDKの正確な型が不明なため any と見なす

        // Scraper Server が公開している 'run_scraper' ツールの、Mastra Agent から見た完全な名前
        // この名前は、MCPClient 初期化時のサーバー設定名 ('chromeRecScraper') と
        // サーバー側で定義されたツール名 ('run_scraper') を組み合わせたものになります。
        const expectedToolName = 'chromeRecScraper_run_scraper';

        // 取得したツールの中に期待するツール名が存在するかチェック
        if (toolData[expectedToolName]) {
             // 期待するツールが存在すれば、mcpTools オブジェクトに格納
             mcpTools[expectedToolName] = toolData[expectedToolName];
             console.log(`[Scraper Agent Definition] Successfully fetched '${expectedToolName}' tool.`);
        } else {
             // 期待するツールが見つからなかった場合、警告ログを出力
             console.warn(`[Scraper Agent Definition] Warning: '${expectedToolName}' tool not found on the server.`);
             // サーバーが公開しているツール名を全て表示して、デバッグに役立てる
             console.warn(`[Scraper Agent Definition] Available tools: ${Object.keys(toolData).join(', ')}`);
        }

        // このエージェントが最終的に利用可能なツールの数をログ出力
        console.log(`[Scraper Agent Definition] Using ${Object.keys(mcpTools).length} tool(s) for this agent.`);

    } catch (error) {
        // ツール取得中にエラーが発生した場合
        console.error("[Scraper Agent Definition] !!! Failed to fetch MCP tools from server!", error);
        console.warn("[Scraper Agent Definition] Agent will operate without tools due to fetch failure.");
        // ツールリストを空にして、エージェントがツールを使わないようにする
         mcpTools = {};
    }

    // --- Agent インスタンスの生成 ---
    // 取得したツールリストと Instructions を設定して Agent インスタンスを作成します。
    const agent = new Agent({
        name: "Web Scraper Agent", // エージェントの名前
        instructions: `あなたはWebサイトから情報を取得するアシスタントです。'chromeRecScraper_run_scraper' というツールを使って、指定された設定で情報を検索・抽出します。

**ツールの使い方 (chromeRecScraper_run_scraper):**
ユーザーが「〇〇(サイト/設定名)で△△(検索語句)を調べて」や「〇〇(サイト/設定名)から△△の情報を取ってきて」のような指示を出したら、以下の手順で 'chromeRecScraper_run_scraper' ツールを使用してください。

1.  **設定名 ('setdir') の特定:**
    *   ユーザーの指示から、どの設定（どのサイト）を使うかを示すキーワード（例: 'google', 'pmda', 'google検索', 'PMDAの添付文書','メルカリ','merucari','アマゾン','amazon','mcp_docs','価格コム','kakaku','standfm','kenchiku-kijunhou','建築基準法' など）を特定し、それに対応する **設定ディレクトリ名** を 'setdir' パラメータに設定します。これは **必須** です。
    *   考えられる 'setdir' の値の例: 'google--search_query', 'pmda--search_query', 'merucari--search_query', 'amazon','mcp_docs','kakaku--search_query', 'standfm', 'kenchiku-kijunhou' (今後増える可能性あり)
    *   もしユーザーがどの設定を使うか明確に指定しなかった場合 (例: 「明日の天気を教えて」)、**どの設定を使うべきかユーザーに確認**してください。(例: 「どの情報源（googleなど）で天気をお調べしますか？」) 勝手に判断しないでください。

2.  **検索語句 ('search_query') の特定:**
    *   ユーザーが具体的に調べてほしい事柄（例: '明日の天気', 'パキシル', '最新ニュース', 'iphone', 'お米' , 'gaming-note' ,'mobile-note'  など）を指定した場合、それを 'search_query' パラメータに設定します。これは **任意** です。
    *   パキシルの効果を詳しく教えてと指定された場合は、'search_query'にパキシルとだけ連携すること。
    *   'アマゾン','mcp_docs','standfm','kenchiku-kijunhou'で、〇〇してと指定された場合は、'search_query'を利用しないこと。
    *   もし検索語句が指定されていない場合 (例: 「googleのトップページを見たい」 - このようなケースは現在想定していませんが)、'search_query' パラメータは省略します。

3.  **ツールの実行:**
    *   特定した 'setdir' と (もしあれば) 'search_query' をパラメータとして 'chromeRecScraper_run_scraper' ツールを呼び出します。

**応答の仕方:**
*   **ツール成功時:** ツールから返されたJSONデータの内容を**分析・要約**し、ユーザーに分かりやすい自然な日本語で結果を伝えてください。JSONデータをそのまま見せないでください。'\\n'は、'\n'にしてください。
*   **ツール失敗時:** ツール実行中にエラーが発生したことを明確に伝え、ツールから返されたエラーメッセージを報告してください。

**具体例:**
*   googleの例１）
*   ユーザー: 「googleで明日の大阪の天気を調べて」
*   あなた (思考): setdir='google--search_query', search_query='明日の大阪の天気' でツール 'chromeRecScraper_run_scraper' を呼ぶ。
*   あなた (応答): Googleで明日の大阪の天気を調べました。結果によると、天気は〇〇で、最高気温は△△℃の予報です。
*   googleの例２）
*   ユーザー: 「googleで明日の大阪の天気を調べて」スポンサー情報があれば詳細に教えて
*   あなた (思考): setdir='google--search_query', search_query='明日の大阪の天気' でツール 'chromeRecScraper_run_scraper' を呼ぶ。
*   あなた (応答): スポンサー情報は以下の通りです。\n\n明日の大阪の天気は以下の通りです。
*   ユーザー: 「pmdaでパキシルについて検索して、結果をそのまま詳しく教えて（〇〇について要約して）」
*   あなた (思考): setdir='pmda--search_query', search_query='パキシル' でツール 'chromeRecScraper_run_scraper' を呼ぶ。
*   あなた (応答): JSON形式以外部の部分を全て表示します。全文（要約）は以下の通りです。
*   ユーザー: 「メルカリでiphoneについて検索して、いいね順に教えて」
*   あなた (思考): setdir='merucari--search_query', search_query='iphone' でツール 'chromeRecScraper_run_scraper' を呼ぶ。
*   あなた (応答): メルカリでiphoneについて検索しました。以下は、いいね順です。
*   ユーザー: 「アマゾンのランキングを教えて」
*   あなた (思考): setdir='amazon'でツール 'chromeRecScraper_run_scraper' を呼ぶ。
*   あなた (応答): アマゾンのランキングです。
*   ユーザー: 「mcp_docsを調べて、全文について詳しく教えて（要約して）」
*   あなた (思考): setdir='mcp_docs'でツール 'chromeRecScraper_run_scraper' を呼ぶ。
*   あなた (応答): mcp_docの全文は以下の通りです。（要約は以下の通りです。）
*   ユーザー: 「価格コム（kakaku）でmobile-noteのランキングを教えて」
*   あなた (思考): setdir='kakaku--search_query'でツール 'chromeRecScraper_run_scraper' を呼ぶ。（search_queryなし）
*   あなた (応答): kakaku.comのmobile-noteのランキングは以下の通りです。
*   ユーザー: 「standfmについて情報を教えて」
*   あなた (思考): setdir='standfm'でツール 'chromeRecScraper_run_scraper' を呼ぶ。（search_queryなし）
*   あなた (応答): standfmの情報は以下の通りです。
*   ユーザー: 「建築基準法の〇〇に関連する条文を全部教えて」
*   あなた (思考): setdir='kenchiku-kijunhou'でツール 'chromeRecScraper_run_scraper' を呼ぶ。（search_queryなし）
*   あなた (応答): 建築基準法の〇〇に関連する条文は以下が全てです。
*   ユーザー: 「天気教えて」
*   あなた (応答): どの情報源（googleなど）で天気をお調べしますか？ 'setdir' を指定してください。
`,
        model: google("models/gemini-2.5-flash-preview-04-17"), // Agent が使用する AI モデル
        tools: mcpTools, // 取得したツールリストを Agent に渡す
    });
    console.log("Scraper Agent defined.");

    // Agent インスタンスを非同期で取得できるよう Promise を返す代わりに、
    // この非同期関数を呼び出し、解決された Agent インスタンスを直接エクスポートします。
    return agent;
}

// defineScraperAgent 関数を呼び出し、その結果（解決された Agent インスタンス）をエクスポート
// この行の await により、エージェントの定義とツール取得が完了するまで待機します。
export const scraperAgent = await defineScraperAgent();
console.log("Scraper Agent defined and exported.");


// --- Agent 専用のクリーンアップ関数 ---
// この関数は、Agent が内部で使用するリソース（主に MCPClient）を解放するために定義します。
// index.ts から呼び出されることを想定しています。
let isCleaningUpScraperAgent = false;
export const cleanupScraperAgent = async () => {
    // クリーンアップが既に進行中の場合は二重実行を防ぐ
    if (isCleaningUpScraperAgent) {
        console.log("[Scraper Agent] Cleanup already in progress, returning.");
        return;
    }
    isCleaningUpScraperAgent = true;
    console.log("\n[Scraper Agent] Initiating cleanup...");

    try {
        // Agent が使用する MCPClient インスタンスが存在するか確認
        if (mcpClientScraper) {
             console.log("[Scraper Agent] Disconnecting dedicated MCPClient...");
             // MCPClient の disconnect メソッドを呼び出して接続を終了します。
             // SDK の実装によっては、これがリソース解放も兼ねています。
             // close メソッドが存在しないことは確認済みのため、disconnect のみで終了とします。
             await mcpClientScraper.disconnect();
             console.log("[Scraper Agent] Dedicated MCPClient disconnected.");
        } else {
             // MCPClient インスタンスがなぜか存在しない場合
             console.log("[Scraper Agent] Dedicated MCPClient instance was not created, skipping disconnection.");
        }
    } catch (error) {
        // クリーンアップ中にエラーが発生した場合
        console.error("[Scraper Agent] Error during dedicated MCPClient disconnection:", error);
    } finally {
        // クリーンアップ処理が完了したことを示すフラグをリセット
        console.log("[Scraper Agent] Cleanup finished.");
        isCleaningUpScraperAgent = false;
    }
};

// SIGINT/SIGTERM ハンドリングは index.ts に集約するため、ここでは個別に設定しません。
// プロセス全体の終了処理は index.ts の責任となります。