// ./mastra/src/mastra/agents/lawAnalyzerAgent.ts

// --- インポート ---
import { Agent } from "@mastra/core/agent"; // Mastra の Agent クラス
import { MCPClient } from "@mastra/mcp"; // MCPClient クラス
import { z } from "zod"; // 入力スキーマ定義のための Zod ライブラリ
import { google } from "@ai-sdk/google"; // AI モデルとして Google Gemini を使用
// MCP ツール定義に必要な型をインポート
// SDK バージョンによって存在しない場合はコメントアウトやanyへの置き換えが必要
//import { ToolDefinition, ToolInputSchemaProperty } from "@modelcontextprotocol/sdk/types.js";
import { URL } from 'node:url'; // URL クラス

// --- 設定 ---
// この Agent が通信する Law Analyzer MCP Server の接続情報を定義
// 環境変数 CRS_SERVER_HOST, LAW_SERVER_PORT があれば優先的に使用
const LAW_SERVER_HOST: string = process.env.CRS_SERVER_HOST || 'localhost';
const LAW_SERVER_PORT: number = process.env.LAW_SERVER_PORT ? parseInt(process.env.LAW_SERVER_PORT, 10) : 3002; // Law Analyzer Server のデフォルトポート 3002

// Law Analyzer MCP Server の完全な URL を構築
const LAW_SERVER_MCP_URL: string = `http://${LAW_SERVER_HOST}:${LAW_SERVER_PORT}/mcp`;
console.log(`[Law Analyzer Agent Definition] Target Law MCP Server URL: ${LAW_SERVER_MCP_URL}`);

// --- MCP Client の初期化 ---
// この Agent 専用の MCPClient インスタンスを生成します。
// Scraper Agent とは異なるサーバーURLを使用するため、重複初期化エラーは発生しません。
// id を設定すると、MCP クライアントの内部ログなどで識別しやすくなります。
const mcpClientLaw = new MCPClient({
    servers: {
        // ★★★ 注意 ★★★
        // ここでのキー ('LawAnalyzer') は、連携する Law Analyzer Server の McpServer インスタンス名と一致させる必要があります。
        // crs-mcp-law-server/src/server.ts で new McpServer({ name: "LawAnalyzer", ... }) と定義されている場合、このキーは "LawAnalyzer" となります。
        // McpServer 名が異なる場合は、ここをその名前に修正してください。
        LawAnalyzer: { // サーバー設定名（Mastra Agentがツールを識別する際のプレフィックスにもなる）
            url: new URL(LAW_SERVER_MCP_URL), // サーバーのURL
        }
    },
     id: "law-analyzer-client", // このクライアントインスタンスを識別するためのユニークなID
});
console.log("[Law Analyzer Agent Definition] Dedicated MCPClient instance created.");


// run_law_analyzer ツールの期待される入力スキーマ (Agent側でのZod定義)
// このスキーマは server.ts の runLawAnalyzerInputSchema と一致させる必要があります。
// Agent の Instructions でモデルにパラメータを抽出させるためのガイドとして機能します。
const runLawAnalyzerInputSchema = z.object({
    setdir: z.string().describe(
        "Directory name containing law analysis config files within the law analyzer's bin directory (e.g., 'law', 'kenchiku-kijunhou'). This must be provided."
    ),
    law_search_keyword: z.string().describe(
        "Keyword to search for within the law document HTML. This must be provided."
    ),
});


// --- エージェント定義用の非同期関数 ---
// Agent インスタンスの定義は非同期処理（ツールの取得など）を含むため、非同期関数内で定義します。
async function defineLawAnalyzerAgent() {
    console.log("[Law Analyzer Agent Definition] Fetching MCP tools...");
    // ツール情報を保持するオブジェクトを初期化
    let mcpTools: Record<string, any> = {}; // 取得ツールの正確な型が不明なため any を使用

    try {
        // 外部から渡された mcpClientLaw インスタンスを使用して、サーバーからツール情報を取得
        const fetchedTools = await mcpClientLaw.getTools();
        // 取得したツール情報が期待通りの形式であると仮定し、必要なツールを抽出
        const toolData: any = fetchedTools; // SDKの正確な型が不明なため any と見なす

        // Law Analyzer Server が公開している 'run_law_analyzer' ツールの、Mastra Agent から見た完全な名前
        // この名前は、MCPClient 初期化時のサーバー設定名 ('LawAnalyzer') と
        // サーバー側で定義されたツール名 ('run_law_analyzer') を組み合わせたものになります。
        const expectedToolName = 'LawAnalyzer_run_law_analyzer';

        // 取得したツールの中に期待するツール名が存在するかチェック
        if (toolData[expectedToolName]) {
             // 期待するツールが存在すれば、mcpTools オブジェクトに格納
             mcpTools[expectedToolName] = toolData[expectedToolName];
             console.log(`[Law Analyzer Agent Definition] Successfully fetched '${expectedToolName}' tool.`);
        } else {
             // 期待するツールが見つからなかった場合、警告ログを出力
             console.warn(`[Law Analyzer Agent Definition] Warning: '${expectedToolName}' tool not found on the server.`);
             // サーバーが公開しているツール名を全て表示して、デバッグに役立てる
             console.warn(`[Law Analyzer Agent Definition] Available tools: ${Object.keys(toolData).join(', ')}`);
        }

        // このエージェントが最終的に利用可能なツールの数をログ出力
        console.log(`[Law Analyzer Agent Definition] Using ${Object.keys(mcpTools).length} tool(s) for this agent.`);

    } catch (error) {
        // ツール取得中にエラーが発生した場合
        console.error("[Law Analyzer Agent Definition] !!! Failed to fetch MCP tools from server!", error);
        console.warn("[Law Analyzer Agent Definition] Agent will operate without tools due to fetch failure.");
        // ツールリストを空にして、エージェントがツールを使わないようにする
         mcpTools = {};
    }

    // --- Agent インスタンスの生成 ---
    // 取得したツールリストと Instructions を設定して Agent インスタンスを作成します。
    const agent = new Agent({
        name: "Law Analyzer Agent", // エージェントの名前
        // Instructions: 法令解析に特化した指示を記述
        // ユーザー入力から setdir と law_search_keyword を抽出し、ツールを呼び出す方法、
        // および結果の表示方法（全文か要約か）を具体的に指示します。
        instructions: `あなたはe-Gov法令HTMLから指定されたキーワードを含む箇所を検索し、情報を提供する専門家です。
ユーザーが特定の法令名とキーワードを組み合わせて質問した場合にのみ、'LawAnalyzer_run_law_analyzer' ツールを使用してその情報を提供します。
法令名とキーワードはユーザー入力から正確に抽出してください。

**ツールの使い方 (LawAnalyzer_run_law_analyzer):**
- このツールは法令HTMLの特定のキーワードを検索するために設計されています。
- ユーザーが「〇〇法で△△について調べて」「××に関する条文を教えて」のような指示を出した場合にのみ使用します。
- ツール呼び出し時には以下の2つの必須パラメータが必要です：
    - \`setdir\` (文字列): 法令の設定ディレクトリ名。ユーザーの指示から特定してください。(例: 'law', 'kenchiku-kijunhou')
    - \`law_search_keyword\` (文字列): 法令内で検索するキーワード。ユーザーの指示から正確に抽出してください。(例: '階段', '定義', '高さ')
- 他のパラメータ（例: search_query）は使用しません。

**ユーザー入力からのパラメータ抽出例:**
- 「建築基準法で階段について調べて、詳しく教えて」 -> LawAnalyzer_run_law_analyzer ツールを呼び出す, setdir='kenchiku-kijunhou', law_search_keyword='階段'
- 「法令(law)で「定義」について教えて」 -> LawAnalyzer_run_law_analyzer ツールを呼び出す, setdir='law', law_search_keyword='定義'
- 「〇〇について調べて」（法令名が不明） -> ツールを使わず、ユーザーに「どの法令について調べますか？ (例: 建築基準法, 法令(law)など) と、探したいキーワードは何ですか？」と確認してください。

**ツール実行結果の提示方法:**
ツール ('LawAnalyzer_run_law_analyzer') からは、関連する条文や別表の場所 ("location") とその内容 ("content") を含むJSONデータの配列が返されます。

- ユーザーが「**詳しく教えて**」「**詳細を教えて**」「**全文**」「**そのまま**」といった指示を結果に求めている場合：
    - 返されたJSONデータの配列の各項目について、"location" と "content" の値をそのまま全て表示してください。JSON形式は使わず、見やすいテキスト形式で整形します。各項目は区別できるように表示してください。日本語が適切に表示されるように注意してください。
    # 全ての配列が出力対象です。もれなく出力してください。

- それ以外の一般的な質問（例: 「調べて」「教えて」「要約して」）の場合：
    - 返されたJSONデータの配列の各項目について、"location" の値はそのまま表示します。
    - "content" の値は、キーワードの前後や文脈が分かるように、**内容の中からlaw_search_keywordを含む部分を抜粋**して表示してください。抜粋する範囲は短く、簡潔にします（例：キーワードを含む文全体やその前後数行）。AIモデルに任せますが、Instructionsで制御できるはずです。
    - 一つの配列に**同じキーワードが複数回表示される場合**は、**複数あることが分かるように、太文字で表示**してください。
    - 抽出された項目が複数ある場合、配列の順番（最初に見つかったものから順に）で出力します。
    # 全ての配列が出力対象です。もれなく出力してください。
    - もしツールが "[] # Keyword '...' not found." という結果を返した場合、「指定されたキーワードは法令内で見つかりませんでした。」のように応答してください。

**その他:**
- ツール実行に失敗した場合、その旨とツールが返したエラーメッセージを正直に伝えてください。
- 法令名とキーワードを特定できない場合は、ツールを使わずにユーザーに確認してください。

`,
    model: google("models/gemini-2.5-flash-preview-04-17"), // Agent が使用する AI モデル
    tools: mcpTools, // 取得したツールリストを Agent に渡す

    // ツール実行結果の具体的な整形（特に「要約」の場合の content 抜粋）は、
    // AIモデルの Instructions に任せるのが Mastra の基本方針です。
    // もし Instructions だけでは難しい、またはより厳密な整形が必要な場合は、
    // toolResultCallback を使用してコードで結果を加工することも可能です。
    // 例:
    // toolResultCallback: async ({ toolCall, result }) => {
    //     if (result.isError || !result.content || result.content.length === 0) {
    //         // エラーや結果なしの場合はそのまま返すか、エラーメッセージを生成
    //         return result;
    //     }
    //     // ここで result.content[0].text などの JSON 文字列をパースし、
    //     // ユーザーの元の入力（toolCall.parameters には元のパラメータ、元のユーザー入力は別の方法で取得が必要）
    //     // に応じて要約/全文表示用のテキストを生成し、新しい CallToolResult を返す。
    //     // 例: return { content: [{ type: "text", text: generatedSummaryOrFullText }] };
    // }
});
console.log("Law Analyzer Agent defined.");


// Agent インスタンスを非同期で取得できるよう Promise を返す代わりに、
// この非同期関数を呼び出し、解決された Agent インスタンスを直接エクスポートします。
return agent;
}

// defineLawAnalyzerAgent 関数を呼び出し、その結果（解決された Agent インスタンス）をエクスポート
// この行の await により、エージェントの定義とツール取得が完了するまで待機します。
export const lawAnalyzerAgent = await defineLawAnalyzerAgent();
console.log("Law Analyzer Agent defined and exported.");


// --- Agent 専用のクリーンアップ関数 ---
// この関数は、Agent が内部で使用するリソース（主に MCPClient）を解放するために定義します。
// index.ts から呼び出されることを想定しています。
let isCleaningUpLawAgent = false;
export const cleanupLawAgent = async () => {
    // クリーンアップが既に進行中の場合は二重実行を防ぐ
    if (isCleaningUpLawAgent) {
        console.log("[Law Analyzer Agent] Cleanup already in progress, returning.");
        return;
    }
    isCleaningUpLawAgent = true;
    console.log("\n[Law Analyzer Agent] Initiating cleanup...");

    try {
        // Agent が使用する MCPClient インスタンスが存在するか確認
        if (mcpClientLaw) {
             console.log("[Law Analyzer Agent] Disconnecting dedicated MCPClient...");
             // MCPClient の disconnect メソッドを呼び出して接続を終了します。
             // SDK の実装によっては、これがリソース解放も兼ねています。
             // close メソッドが存在しないことは確認済みのため、disconnect のみで終了とします。
             await mcpClientLaw.disconnect();
             console.log("[Law Analyzer Agent] Dedicated MCPClient disconnected.");
        } else {
             // MCPClient インスタンスがなぜか存在しない場合
             console.log("[Law Analyzer Agent] Dedicated MCPClient instance was not created, skipping disconnection.");
        }
    } catch (error) {
        // クリーンアップ中にエラーが発生した場合
        console.error("[Law Analyzer Agent] Error during dedicated MCPClient disconnection:", error);
    } finally {
        // クリーンアップ処理が完了したことを示すフラグをリセット
        console.log("[Law Analyzer Agent] Cleanup finished.");
        isCleaningUpLawAgent = false;
    }
};

// SIGINT/SIGTERM ハンドリングは index.ts に集約するため、ここでは個別に設定しません。
// プロセス全体の終了処理は index.ts の責任となります。