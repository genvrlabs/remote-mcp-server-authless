# 🚀 GenVR MCP Server - 300+ AI Models for ChatGPT & Claude

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/genvrlabs/remote-mcp-server-authless)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

> **The ultimate MCP server providing access to 300+ AI models including image generation, video creation, audio synthesis, and more through ChatGPT and Claude Desktop.**

## ✨ What is this?

This is a **Model Context Protocol (MCP) server** that exposes **300+ AI models** from GenVR Research through a simple, standardized interface. Use it with:

- 🤖 **ChatGPT** (via AgentKit)
- 🧠 **Claude Desktop** 
- 🔧 **Any MCP-compatible client**

### 🎯 Key Features

- **300+ AI Models** across multiple categories
- **Zero Authentication** - credentials passed in tool parameters
- **Cloudflare Workers** deployment for global performance
- **Full Schema Support** - automatic parameter validation
- **Real-time Generation** - async task polling with status updates

## 🎨 Available AI Model Categories

| Category | Description | Example Models |
|----------|-------------|----------------|
| 🖼️ **Image Generation** | Create stunning images from text prompts | Flux Spro, Hunyuan 3, ImagineArt |
| 🎬 **Video Generation** | Generate videos from text or images | Runway Gen-3, Pika Labs, Stable Video |
| 🎵 **Audio Generation** | Create music, speech, and sound effects | MusicLM, Bark, AudioCraft |
| 📝 **Text Generation** | Advanced language models | GPT-4, Claude, Llama 3 |
| 🔄 **Image-to-Image** | Transform and edit existing images | ControlNet, IP-Adapter, Inpainting |
| 🎭 **Character Animation** | Animate characters and avatars | Character-LLM, AnimateDiff |
| 🌍 **3D Generation** | Create 3D models and environments | Tripo3D, Luma AI, Gaussian Splatting |

## 🚀 Quick Start

### Option 1: One-Click Deploy (Recommended)

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/genvrlabs/remote-mcp-server-authless)

This will deploy your MCP server to: `https://your-server.your-account.workers.dev/sse`

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/genvrlabs/remote-mcp-server-authless.git
cd remote-mcp-server-authless

# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

## 🔧 ChatGPT Integration

### Step 1: Configure ChatGPT AgentKit

1. Open ChatGPT and go to **Settings** → **AgentKit**
2. Click **"Add MCP Server"**
3. Enter your server URL: `https://your-server.your-account.workers.dev/sse`

### Step 2: Start Creating!

Simply ask ChatGPT to use any of the 300+ AI models:

```
"Generate an image of a cyberpunk city at night with neon lights using the Flux Spro model"
```

```
"Create a video of ocean waves with dramatic lighting using Runway Gen-3"
```

```
"Generate a jazz piano piece using MusicLM"
```

## 🧠 Claude Desktop Integration

### Step 1: Install mcp-remote

```bash
npm install -g mcp-remote
```

### Step 2: Configure Claude Desktop

Open Claude Desktop → **Settings** → **Developer** → **Edit Config** and add:

```json
{
  "mcpServers": {
    "genvr-ai": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-server.your-account.workers.dev/sse"
      ]
    }
  }
}
```

### Step 3: Restart Claude

Restart Claude Desktop and you'll see 300+ GenVR tools available!

## 📋 Usage Examples

### Image Generation
```javascript
// Available tools: generate_imagegen_flux_spro_dev, generate_imagegen_hunyuan3_image, etc.
{
  "prompt": "A futuristic cityscape at sunset",
  "userId": "your-genvr-user-id",
  "accessToken": "your-genvr-access-token"
}
```

### Video Creation
```javascript
// Available tools: generate_videogen_runway_gen3, generate_videogen_pika_labs, etc.
{
  "prompt": "A cat playing with a ball of yarn",
  "duration": 5,
  "userId": "your-genvr-user-id", 
  "accessToken": "your-genvr-access-token"
}
```

### Audio Generation
```javascript
// Available tools: generate_audiogen_musiclm, generate_audiogen_bark, etc.
{
  "text": "Generate a relaxing piano melody",
  "duration": 30,
  "userId": "your-genvr-user-id",
  "accessToken": "your-genvr-access-token"
}
```

## 🔑 Getting GenVR Credentials

1. Visit [GenVR Research](https://app.genvrresearch.com/)
2. Sign up for an account
3. Get your **User ID** and **Access Token** from the dashboard
4. Use these credentials in your MCP tool calls

## 🛠️ Development

### Project Structure

```
src/
├── index.ts              # Main MCP server implementation
├── curated-models.json   # 300+ AI model definitions
├── schemas-cache.json    # Parameter schemas for all models
└── index.d.ts           # TypeScript definitions
```

### Adding Custom Tools

To add your own tools, modify `src/index.ts`:

```typescript
this.server.tool("my_custom_tool", 
  { 
    input: z.string().describe("Your input parameter") 
  }, 
  async ({ input }) => {
    // Your tool logic here
    return { content: [{ type: "text", text: "Result" }] };
  }
);
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run deploy       # Deploy to Cloudflare Workers
npm run format       # Format code with Biome
npm run lint:fix     # Fix linting issues
npm run type-check   # Run TypeScript type checking
```

## 🌐 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/sse` | Server-Sent Events endpoint for MCP clients |
| `/mcp` | Standard MCP protocol endpoint |

## 🔧 Configuration

### Environment Variables

No environment variables required! The server is designed to be stateless and credential-free.

### Customization

- **Model Selection**: Edit `src/curated-models.json` to include/exclude specific models
- **Schema Updates**: Update `src/schemas-cache.json` for parameter changes
- **Custom Tools**: Add your own tools in the `init()` method

## 🚨 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Tool execution failed" | Check your GenVR credentials are valid |
| "No task ID returned" | Verify the model name and parameters |
| "Task timed out" | Some models take longer - increase timeout in code |
| MCP connection fails | Ensure the server URL is correct and accessible |

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=true npm run dev
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run type-check`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [GenVR Research](https://genvrresearch.com/) for providing the AI models
- [Cloudflare Workers](https://workers.cloudflare.com/) for the hosting platform
- [Model Context Protocol](https://modelcontextprotocol.io/) for the standard
- [Anthropic](https://anthropic.com/) for Claude Desktop integration

## 📞 Support

- 📧 **Email**: support@genvrresearch.com
- 💬 **Discord**: [GenVR Community](https://discord.gg/genvr)
- 📖 **Documentation**: [GenVR API Docs](https://api.genvrresearch.com/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/genvrlabs/remote-mcp-server-authless/issues)

---

<div align="center">
  <strong>Made with ❤️ by the GenVR Team</strong>
  <br>
  <a href="https://genvrresearch.com">Website</a> • 
  <a href="https://github.com/genvrlabs">GitHub</a> • 
  <a href="https://discord.gg/genvr">Discord</a>
</div> 
