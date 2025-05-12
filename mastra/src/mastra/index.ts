// ./mastra/src/mastra/index.ts

import { Mastra } from "@mastra/core";
import dotenv from 'dotenv';
// 既存の scraperAgent とその cleanup 関数をインポート
import { scraperAgent, cleanupScraperAgent } from './agents/scraperAgent.js';
// 新しい lawAnalyzerAgent とその cleanup 関数をインポート
import { lawAnalyzerAgent, cleanupLawAgent } from './agents/lawAnalyzerAgent.js';

dotenv.config();

// 各エージェントはそれぞれのファイル内で初期化（ツール取得含む）されているため、
// ここで Promise.all で初期化完了を待つ必要はなくなりました。
// インポートした Agent インスタンスをそのまま使用します。

export const mastra = new Mastra({
    agents: {
        // エージェントを登録
        scraperAgent,
        lawAnalyzerAgent
    },
    // memory: 必要に応じて他の設定もここに追加
});

console.log("Mastra instance created and exported in src/mastra/index.ts.");
const registeredAgents = {
    scraperAgent: scraperAgent.name, // Agentインスタンスから名前を取得
    lawAnalyzerAgent: lawAnalyzerAgent.name // Agentインスタンスから名前を取得
};
console.log("Registered agents:", Object.keys(registeredAgents));

// プロセス終了時のクリーンアップ処理を登録
process.on('beforeExit', async (code) => {
     console.log(`[Mastra Index] Process is about to exit with code: ${code}. Running cleanup.`);
     // 各Agentのクリーンアップ関数を呼び出す
     await cleanupLawAgent(); // Law Analyzer Agent のクリーンアップ
     await cleanupScraperAgent(); // Scraper Agent のクリーンアップ

     console.log("[Mastra Index] Cleanup finished.");
});

// SIGINT/SIGTERM ハンドリングも各Agentのクリーンアップを呼び出す
process.on('SIGINT', async () => {
    console.log("\n[Mastra Index] SIGINT received. Initiating cleanup and exit.");
    await cleanupLawAgent();
    await cleanupScraperAgent();
    process.exit(0);
});
process.on('SIGTERM', async () => {
     console.log("\n[Mastra Index] SIGTERM received. Initiating cleanup and exit.");
     await cleanupLawAgent();
     await cleanupScraperAgent();
     process.exit(0);
});