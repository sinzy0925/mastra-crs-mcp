// C:\Users\sinzy\mastra-mcp-01\mastra\src\mastra\agents\scraperAgent.ts
import { google } from "@ai-sdk/google";

import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { MCPClient } from "@mastra/mcp";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- MCP クライアントとツールの設定 ---
const SERVER_HOST = process.env.CRS_SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.CRS_SERVER_PORT || 3001;
const SERVER_MCP_URL = `http://${SERVER_HOST}:${SERVER_PORT}/mcp`;
console.log(`[Agent Definition] Target MCP Server URL: ${SERVER_MCP_URL}`);

// ★★★ パス計算を修正 ★★★
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverScriptPath = path.resolve(
    __dirname, // src/mastra/agents ディレクトリ
    '..',      // src/mastra へ
    '..',      // src へ
    '..',      // mastra ルートへ
    'crs-mcp-server',
    'dist',
    'server.js'
);
const serverRootDir = path.resolve(
     __dirname, '..', '..', '..', 'crs-mcp-server'
);
/*
const mainExePathOverride = process.env.GO_ANYWHERE_MAIN_EXE_PATH;
const serverEnv: Record<string, string> = {};
if (mainExePathOverride) {
    serverEnv.GO_ANYWHERE_MAIN_EXE_PATH = mainExePathOverride;
}
*/

const mcpClient = new MCPClient({
    servers: {
        chromeRecScraperHttp: { // サーバー名
            url: new URL(SERVER_MCP_URL),
            // ★★★ HTTP モードなので command, args, cwd は不要 ★★★
            // env は必要に応じてサーバー側で読み込むので、通常は渡さない
            // env: Object.keys(serverEnv).length > 0 ? serverEnv : undefined,
        }
    },
});

// --- エージェント定義 ---
async function defineAgent() {
    console.log("[Agent Definition] Fetching MCP tools...");
    let mcpTools = {};
    try {
        mcpTools = await mcpClient.getTools();
         console.log(`[Agent Definition] Fetched ${Object.keys(mcpTools).length} MCP tool(s):`, Object.keys(mcpTools));
         if (Object.keys(mcpTools).length === 0) {
             console.warn("[Agent Definition] No MCP tools fetched!");
         }
    } catch (error) {
        console.error("[Agent Definition] !!! Failed to fetch MCP tools!", error);
    }

    const agent = new Agent({
        name: "Web Scraper Agent",
        instructions: `あなたはWebサイトから情報を取得するアシスタントです。'chromeRecScraperHttp_run_scraper' というツールを使って、指定された設定で情報を検索・抽出します。

**ツールの使い方:**
ユーザーが「〇〇(サイト/設定名)で△△(検索語句)を調べて」や「〇〇(サイト/設定名)から△△の情報を取ってきて」のような指示を出したら、以下の手順で 'chromeRecScraperHttp_run_scraper' ツールを使用してください。

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
    *   特定した 'setdir' と (もしあれば) 'search_query' をパラメータとして 'chromeRecScraperHttp_run_scraper' ツールを呼び出します。

**応答の仕方:**
*   **ツール成功時:** ツールから返されたJSONデータの内容を**分析・要約**し、ユーザーに分かりやすい自然な日本語で結果を伝えてください。JSONデータをそのまま見せないでください。'\\n'は、'\n'にしてください。
*   **ツール失敗時:** ツール実行中にエラーが発生したことを明確に伝え、ツールから返されたエラーメッセージを報告してください。

**具体例:**
*   googleの例１）
*   ユーザー: 「googleで明日の大阪の天気を調べて」
*   あなた (思考): setdir='google--search_query', search_query='明日の大阪の天気' でツールを呼ぶ。
*   あなた (応答): Googleで明日の大阪の天気を調べました。結果によると、天気は〇〇で、最高気温は△△℃の予報です。
*   googleの例２）
*   ユーザー: 「googleで明日の大阪の天気を調べて」スポンサー情報があれば詳細に教えて
*   あなた (思考): setdir='google--search_query', search_query='明日の大阪の天気' でツールを呼ぶ。
*   あなた (応答): スポンサー情報は以下の通りです。\n\n明日の大阪の天気は以下の通りです。
*   ユーザー: 「pmdaでパキシルについて検索して、結果をそのまま詳しく教えて（〇〇について要約して）」
*   あなた (思考): setdir='pmda--search_query', search_query='パキシル' でツールを呼ぶ。
*   あなた (応答): JSON形式以外部の部分を全て表示します。全文（要約）は以下の通りです。
*   ユーザー: 「メルカリでiphoneについて検索して、いいね順に教えて」
*   あなた (思考): setdir='merucari--search_query', search_query='iphone' でツールを呼ぶ。
*   あなた (応答): メルカリでiphoneについて検索しました。以下は、いいね順です。
*   ユーザー: 「アマゾンのランキングを教えて」
*   あなた (思考): setdir='amazon'でツールを呼ぶ。
*   あなた (応答): アマゾンのランキングです。
*   ユーザー: 「mcp_docsを調べて、全文について詳しく教えて（要約して）」
*   あなた (思考): setdir='mcp_docs'でツールを呼ぶ。
*   あなた (応答): mcp_docの全文は以下の通りです。（要約は以下の通りです。）
*   ユーザー: 「価格コム（kakaku）でmobile-noteのランキングを教えて」
*   あなた (思考): setdir='kakaku'でツールを呼ぶ。
*   あなた (応答): kakaku.comのmobile-noteのランキングは以下の通りです。
*   ユーザー: 「standfmについて情報を教えて」
*   あなた (思考): setdir='standfm'でツールを呼ぶ。
*   あなた (応答): standfmの情報は以下の通りです。
*   ユーザー: 「建築基準法の〇〇に関連する条文を全部教えて」
*   あなた (思考): setdir='kenchiku-kijunhou'でツールを呼ぶ。
*   あなた (応答): 建築基準法の〇〇に関連する条文は以下が全てです。
*   ユーザー: 「天気教えて」
*   あなた (応答): どの情報源（googleなど）で天気をお調べしますか？ 'setdir' を指定してください。
`,
        model: google("models/gemini-2.5-flash-preview-04-17"), // または 'models/gemini-1.5-pro-latest' など
        tools: { ...mcpTools },
    });
    console.log("Scraper Agent defined.");
    return agent;
}

export const scraperAgent = await defineAgent();

// --- クリーンアップ処理 ---
// (変更なし)
let isCleaningUp = false;
const cleanup = async () => { /* ... */ };
process.on('exit', cleanup);
process.on('SIGINT', async () => { await cleanup(); process.exit(); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(); });