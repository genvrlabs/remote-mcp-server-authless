#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Environment variables for authentication
const GENVR_USER_ID = process.env.GENVR_USER_ID;
const GENVR_ACCESS_TOKEN = process.env.GENVR_ACCESS_TOKEN;
const GENVR_API_BASE = process.env.GENVR_API_BASE || "https://api.genvrresearch.com/api/v1";
const DEBUG = process.env.DEBUG === "true";
if (!GENVR_USER_ID || !GENVR_ACCESS_TOKEN) {
    console.error("Error: GENVR_USER_ID and GENVR_ACCESS_TOKEN environment variables are required");
    process.exit(1);
}
// Helper function to make API calls
async function callGenVRAPI(endpoint, body) {
    const url = `${GENVR_API_BASE}${endpoint}`;
    const requestBody = body ? JSON.stringify({
        ...body,
        uid: GENVR_USER_ID,
    }) : undefined;
    if (DEBUG) {
        console.error(`DEBUG: API call to ${url}`);
        console.error(`DEBUG: Request body:`, requestBody);
        console.error(`DEBUG: Headers:`, {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GENVR_ACCESS_TOKEN}`,
        });
    }
    const response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GENVR_ACCESS_TOKEN}`,
        },
        body: requestBody,
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`DEBUG: API error response: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`GenVR API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const result = await response.json();
    console.error(`DEBUG: API success response:`, JSON.stringify(result, null, 2));
    return result;
}
// Poll for task completion
async function waitForCompletion(taskId, category, subcategory, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const statusData = await callGenVRAPI("/status", {
            id: taskId,
            category,
            subcategory,
        });
        const status = statusData.data?.status || statusData.status;
        if (status === "completed") {
            // Fetch the final response
            const responseData = await callGenVRAPI("/response", {
                id: taskId,
                category,
                subcategory,
            });
            return responseData;
        }
        else if (status === "failed") {
            const error = statusData.data?.error || statusData.error;
            throw new Error(`Task failed: ${error || "Unknown error"}`);
        }
        // Wait before polling again (exponential backoff)
        const delay = Math.min(2000 * Math.pow(1.5, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error("Task timed out");
}
// Cache for available models
let availableModels = [];
let toolsCache = [];
// Load cached schemas
let schemasCache = {};
try {
    const cacheFile = join(__dirname, 'schemas-cache.json');
    const cacheData = readFileSync(cacheFile, 'utf-8');
    schemasCache = JSON.parse(cacheData);
    console.error(`Loaded ${Object.keys(schemasCache).length} schemas from cache`);
}
catch (error) {
    console.error("No schemas cache found, will use minimal schema");
}
// Fetch available models from GenVR API
async function fetchAvailableModels() {
    try {
        const response = await fetch("https://api.genvrresearch.com/api/get-models", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
            console.error("Failed to fetch models from GenVR API");
            return [];
        }
        const data = await response.json();
        if (!data.success || !data.data) {
            console.error("Invalid response from GenVR API");
            return [];
        }
        // Parse response: { audiogen: [...], imagegen: [...], ... }
        const models = [];
        Object.entries(data.data).forEach(([category, subcategories]) => {
            if (Array.isArray(subcategories)) {
                subcategories.forEach((subcategory) => {
                    models.push({
                        category,
                        subcategory,
                        name: `${category}/${subcategory}`
                    });
                });
            }
        });
        return models;
    }
    catch (error) {
        console.error("Error fetching models:", error);
        return [];
    }
}
// Fetch schema for a specific model
async function fetchModelSchema(category, subcategory) {
    try {
        const response = await fetch("https://app.genvrresearch.com/api/get/schema", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category, subcategory }),
        });
        if (!response.ok) {
            console.error(`Failed to fetch schema for ${category}/${subcategory}`);
            return null;
        }
        const data = await response.json();
        if (!data.success || !data.data?.inputJson) {
            console.error(`Invalid schema response for ${category}/${subcategory}`);
            return null;
        }
        return data.data.inputJson;
    }
    catch (error) {
        console.error(`Error fetching schema for ${category}/${subcategory}:`, error);
        return null;
    }
}
// Generate tools dynamically from available models using cached schemas
async function generateTools() {
    if (availableModels.length === 0) {
        availableModels = await fetchAvailableModels();
    }
    console.error(`Generating ${availableModels.length} tools...`);
    const tools = [];
    // Create tools with actual schemas from cache
    for (const model of availableModels) {
        const schemaKey = `${model.category}/${model.subcategory}`;
        const cachedSchema = schemasCache[schemaKey];
        let inputSchema = {
            type: "object",
            properties: {},
            required: []
        };
        // If we have a cached schema, use it
        if (cachedSchema && cachedSchema.schema && cachedSchema.schema.properties) {
            const properties = {};
            const required = [];
            Object.entries(cachedSchema.schema.properties).forEach(([key, prop]) => {
                // Skip hidden fields and GenVR internal fields
                if (prop.display === 'hidden')
                    return;
                if (key === 'category_genvr' || key === 'subcategory_genvr' || key === 'uid' || key === 'token')
                    return;
                const propDef = {
                    type: prop.type || 'string',
                    description: prop.description || `Parameter: ${key}`
                };
                // Add enum if present
                if (prop.enum && Array.isArray(prop.enum)) {
                    propDef.enum = prop.enum;
                }
                // Add default if present
                if (prop.default !== undefined) {
                    propDef.default = prop.default;
                }
                // Add constraints
                if (prop.minimum !== undefined)
                    propDef.minimum = prop.minimum;
                if (prop.maximum !== undefined)
                    propDef.maximum = prop.maximum;
                if (prop.maxItems !== undefined)
                    propDef.maxItems = prop.maxItems;
                // Handle array types
                if (prop.type === 'array' && prop.items) {
                    propDef.items = prop.items;
                }
                properties[key] = propDef;
                // Add to required if specified in schema
                if (cachedSchema.schema.required?.includes(key)) {
                    required.push(key);
                }
            });
            inputSchema = {
                type: "object",
                properties,
                required
            };
        }
        tools.push({
            name: `generate_${model.category}_${model.subcategory}`,
            description: `Generate content using ${model.name}. Category: ${model.category}, Model: ${model.subcategory}. ${model.description || cachedSchema?.description || ''}`,
            inputSchema
        });
    }
    console.error(`Generated ${tools.length} tools successfully`);
    return tools;
}
// Create and configure the server
const server = new Server({
    name: "genvr-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (toolsCache.length === 0) {
        toolsCache = await generateTools();
    }
    return { tools: toolsCache };
});
// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        if (!args || typeof args !== 'object') {
            throw new Error("No arguments provided");
        }
        const toolArgs = args;
        console.error("DEBUG: Tool called:", name);
        console.error("DEBUG: Raw args received:", JSON.stringify(toolArgs, null, 2));
        console.error("DEBUG: toolArgs.parameters exists?", !!toolArgs.parameters);
        console.error("DEBUG: toolArgs keys:", Object.keys(toolArgs));
        let category;
        let subcategory;
        let parameters;
        // Map tool names to GenVR API calls
        if (name.startsWith("generate_")) {
            // Extract category and subcategory from tool name (e.g., "generate_imagegen_flux_dev" -> "imagegen", "flux_dev")
            const parts = name.replace("generate_", "").split("_");
            console.error("DEBUG: Tool name parts:", parts);
            category = parts[0];
            subcategory = parts.slice(1).join("_"); // Handle models with underscores
            // Handle short category names (e.g., "image" -> "imagegen")
            if (category === "image")
                category = "imagegen";
            if (category === "video")
                category = "videogen";
            if (category === "audio")
                category = "audiogen";
            console.error("DEBUG: Extracted category:", category, "subcategory:", subcategory);
            // Check if args are nested in a "parameters" object and flatten them
            if (toolArgs.parameters && typeof toolArgs.parameters === 'object') {
                parameters = { ...toolArgs.parameters };
                console.error("DEBUG: Flattened parameters from nested object:", JSON.stringify(parameters, null, 2));
            }
            else {
                parameters = { ...toolArgs };
                console.error("DEBUG: Using toolArgs directly as parameters:", JSON.stringify(parameters, null, 2));
            }
            // Check if 'model' parameter exists and should override subcategory
            if (parameters.model && typeof parameters.model === 'string' && !subcategory) {
                console.error("DEBUG: Using 'model' parameter as subcategory:", parameters.model);
                subcategory = parameters.model;
                delete parameters.model; // Remove it from parameters since it's now the subcategory
            }
            // Remove only GenVR internal category fields (uid and token are handled by callGenVRAPI)
            delete parameters.category_genvr;
            delete parameters.subcategory_genvr;
            console.error("DEBUG: Final parameters after cleanup:", JSON.stringify(parameters, null, 2));
        }
        else {
            throw new Error(`Unknown tool: ${name}`);
        }
        // Call the generate endpoint - flatten parameters into the body
        // Double-check: if parameters still has a nested 'parameters' property, flatten it
        let flatParams = { ...parameters };
        if (flatParams.parameters && typeof flatParams.parameters === 'object') {
            console.error("DEBUG: WARNING - parameters still nested, flattening again!");
            flatParams = { ...flatParams.parameters };
        }
        const requestBody = {
            category,
            subcategory,
            ...flatParams, // Flatten parameters
        };
        console.error("DEBUG: Calling /generate with body:", JSON.stringify(requestBody, null, 2));
        const generateData = await callGenVRAPI("/generate", requestBody);
        const taskId = generateData?.data?.id;
        if (!taskId) {
            throw new Error("No task ID returned from generate endpoint");
        }
        // Wait for completion and get the result
        const result = await waitForCompletion(taskId, category, subcategory);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});
// Start the server
async function main() {
    console.error("=".repeat(60));
    console.error("🚀 GenVR MCP Server Starting...");
    console.error("=".repeat(60));
    console.error(`User ID: ${GENVR_USER_ID}`);
    console.error(`API Base: ${GENVR_API_BASE}`);
    console.error(`Token: ${GENVR_ACCESS_TOKEN ? '***' + GENVR_ACCESS_TOKEN.slice(-4) : 'NOT SET'}`);
    console.error("=".repeat(60));
    // Pre-load available models
    console.error("Loading available models...");
    availableModels = await fetchAvailableModels();
    console.error(`Loaded ${availableModels.length} models from GenVR API`);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("=".repeat(60));
    console.error("✅ GenVR MCP Server running on stdio");
    console.error("=".repeat(60));
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
