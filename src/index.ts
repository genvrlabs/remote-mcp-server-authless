import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// Import local JSON files
import schemasCache from './schemas-cache.json';
import curatedModels from './curated-models.json';

// Extract curated model keys from the imported data
const curatedModelKeys = curatedModels.curatedModels.map((model: any) => `${model.category}/${model.subcategory}`);

console.log(`Loaded ${curatedModelKeys.length} GenVR models`);
console.log(`Loaded ${Object.keys(schemasCache).length} schemas`);

// GenVR API base URL
const GENVR_API_BASE = "https://api.genvrresearch.com/api/v1";

// Helper function for making GenVR API requests
async function makeGenVRRequest<T>(endpoint: string, body: any, userId: string, accessToken: string): Promise<T | null> {
	const url = `${GENVR_API_BASE}${endpoint}`;
	const requestBody = JSON.stringify({
		...body,
		uid: userId,
	});

	try {
		const response = await fetch(url, {
			method: body ? "POST" : "GET",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`,
			},
			body: requestBody,
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return (await response.json()) as T;
	} catch (error) {
		console.error("Error making GenVR request:", error);
		return null;
	}
}

// Poll for task completion
async function waitForCompletion(taskId: string, category: string, subcategory: string, userId: string, accessToken: string, maxAttempts = 60) {
	for (let i = 0; i < maxAttempts; i++) {
		const statusData = await makeGenVRRequest("/status", {
			id: taskId,
			category,
			subcategory,
		}, userId, accessToken);
		
		if (!statusData) {
			throw new Error("Failed to get status");
		}
		
		const status = (statusData as any).data?.status || (statusData as any).status;
		if (status === "completed") {
			// Fetch the final response
			const responseData = await makeGenVRRequest("/response", {
				id: taskId,
				category,
				subcategory,
			}, userId, accessToken);
			return responseData;
		} else if (status === "failed") {
			const error = (statusData as any).data?.error || (statusData as any).error;
			throw new Error(`Task failed: ${error || "Unknown error"}`);
		}
		
		// Wait before polling again (exponential backoff)
		const delay = Math.min(2000 * Math.pow(1.5, i), 10000);
		await new Promise(resolve => setTimeout(resolve, delay));
	}
	throw new Error("Task timed out");
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "GenVR MCP Server",
		version: "1.0.0",
	}) as any;

	async init() {

		// Simple addition tool
		this.server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }: { a: number; b: number }) => ({
			content: [{ type: "text", text: String(a + b) }],
		}));

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }: { operation: "add" | "subtract" | "multiply" | "divide"; a: number; b: number }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			},
		);

		// Register GenVR tools using genvr-mcp-server-lite data
		console.log(`Registering ${curatedModelKeys.length} GenVR tools...`);
		for (const modelKey of curatedModelKeys) {
			const [category, subcategory] = modelKey.split('/');
			const toolName = `generate_${category}_${subcategory}`;
			
			// Get schema from cache (same as genvr-mcp-server-lite)
			const schemaKey = `${category}/${subcategory}`;
			const schema = (schemasCache as any)[schemaKey];
			
			let description = `GenVR AI model. Category: ${category}, Model: ${subcategory}.`;

			// Use actual schema from cache, convert to Zod schema
			let inputSchema: any = {};
			
			if (schema && schema.properties) {
				console.log(`Using schema for ${toolName}:`, Object.keys(schema.properties));
				// Convert JSON schema to Zod schema
				for (const [key, prop] of Object.entries(schema.properties)) {
					const property = prop as any;
					if (property.type === 'string') {
						inputSchema[key] = z.string().describe(property.description || '');
					} else if (property.type === 'number') {
						inputSchema[key] = z.number().describe(property.description || '');
					} else if (property.type === 'boolean') {
						inputSchema[key] = z.boolean().describe(property.description || '');
					} else if (property.type === 'array') {
						inputSchema[key] = z.array(z.any()).describe(property.description || '');
					} else {
						inputSchema[key] = z.any().describe(property.description || '');
					}
				}
			} else {
				console.log(`No schema found for ${toolName}, using fallback schema`);
				// Fallback to basic schema if no schema found
				inputSchema = {
					prompt: z.string().describe("The input prompt or description for the AI model"),
					userId: z.string().describe("GenVR User ID"),
					accessToken: z.string().describe("GenVR Access Token")
				};
			}

			this.server.tool(
				toolName,
				inputSchema,
				async (args: any) => {
					try {
						// Call the generate endpoint with all provided arguments
						const requestBody = {
							category,
							subcategory,
							...args
						};
						
						const generateData = await makeGenVRRequest("/generate", requestBody, args.userId, args.accessToken);
						const taskId = (generateData as any)?.data?.id;
						
						if (!taskId) {
							throw new Error("No task ID returned from generate endpoint");
						}

						// Wait for completion and get the result
						const result = await waitForCompletion(taskId, category, subcategory, args.userId, args.accessToken);

						return {
							content: [
								{
									type: "text" as const,
									text: JSON.stringify(result, null, 2)
								}
							],
							structuredContent: result as { [x: string]: unknown }
						};
					} catch (error: any) {
						return {
							content: [
								{
									type: "text" as const,
									text: `Tool execution failed: ${error.message}`
								}
							],
							isError: true
						};
					}
				}
			);
		}
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
