// C:\Users\sinzy\mastra-mcp-01\mastra\runAgent.ts
import { mcpClient, initializePromise } from './dist/index.js'; // dist からインポート
import { scraperAgentPromise } from './dist/agents/scraperAgent.js'; // dist からインポート
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
const rl = readline.createInterface({ input, output });
async function main() {
    let mcpClientClosed = false;
    try {
        console.log("Waiting for MCP and Agent initialization...");
        // ★★★ index.ts と agent.ts の両方の初期化を待つ ★★★
        await initializePromise;
        const agent = await scraperAgentPromise;
        console.log("Initialization complete.");
        if (!agent) {
            console.error("Scraper agent could not be initialized!");
            return;
        }
        console.log("\n--- Mastra Agent Test ---");
        console.log("Ask the agent (e.g., 'google--search_query で 日本の首相 を検索して')");
        console.log("Type 'quit' to exit.");
        while (true) {
            const userInput = await rl.question("\nYou: ");
            if (userInput.toLowerCase() === 'quit')
                break;
            console.log("Agent thinking...");
            const result = await agent.stream(userInput, { maxSteps: 5 });
            process.stdout.write("Agent: ");
            for await (const chunk of result.textStream) {
                process.stdout.write(chunk);
            }
            process.stdout.write("\n");
        }
    }
    catch (error) {
        console.error("\nAn error occurred:", error);
    }
    finally {
        rl.close();
        try {
            if (mcpClient && !mcpClientClosed) {
                console.log("\nClosing MCPClient connections...");
                await mcpClient.disconnect();
                mcpClientClosed = true;
                console.log("MCPClient connections closed.");
            }
        }
        catch (closeError) {
            console.error("Error closing MCPClient:", closeError);
        }
        console.log("\nExiting agent test.");
        process.exit(0);
    }
}
main();
