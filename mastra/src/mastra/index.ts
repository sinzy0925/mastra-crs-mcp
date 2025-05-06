// C:\Users\sinzy\mastra-mcp-01\mastra\src\mastra\index.ts
import { Mastra } from "@mastra/core";
import dotenv from 'dotenv';
import { scraperAgent } from './agents/scraperAgent.js'; // 同じ階層の agents を見る

dotenv.config();

export const mastra = new Mastra({
    agents: {
         scraperAgent
    },
    // memory: ...
});

console.log("Mastra instance created and exported in src/mastra/index.ts.");
// console.log("Registered agents:", Object.keys(mastra.agents)); // agents プロパティがない可能性