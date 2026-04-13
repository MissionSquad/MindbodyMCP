# 🧘 Mindbody MCP Server

[![npm version](https://badge.fury.io/js/%40missionsquad%2Fmcp-mindbody.svg)](https://www.npmjs.com/package/@missionsquad/mcp-mindbody)
[![CI](https://github.com/vespo92/MindbodyMCP/actions/workflows/ci.yml/badge.svg)](https://github.com/vespo92/MindbodyMCP/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-v1.17.2-blue)](https://github.com/modelcontextprotocol/sdk)

A comprehensive Model Context Protocol (MCP) server that provides AI assistants with complete access to the Mindbody API for fitness and wellness studio management. Perfect for yoga studios, pilates studios, gyms, and wellness centers.

## ✨ Features

- **50+ Tools** covering every aspect of studio operations
- **Complete Class Management** - View schedules, book clients, manage waitlists, substitute teachers
- **Client Management** - Add/update clients, track visits, memberships, and balances
- **Sales & Commerce** - Process payments, sell packages, memberships, and retail products
- **Staff Management** - View schedules, manage appointments, track availability
- **Multi-Location Support** - Manage multiple studio locations seamlessly
- **High Performance** - Built on Node.js with intelligent caching
- **Type-Safe** - Full TypeScript support with comprehensive types
- **Dual Transport Support** - STDIO for local development, SSE for production deployment

## 🚀 Quick Start

### Installation with npx (Node.js)

```bash
# Run directly without installation
npx @missionsquad/mcp-mindbody

# Or install globally
npm install -g @missionsquad/mcp-mindbody
```

### Install from GitHub

```bash
# Using npx
npx github:vespo92/MindbodyMCP

# Or clone and run locally
git clone https://github.com/vespo92/MindbodyMCP.git
cd MindbodyMCP
npm install
npm run build
npm start
```

## 📋 Prerequisites

- Node.js 18+
- Mindbody API credentials (API Key and Site ID; source credentials are optional and only needed for bearer-token issuance)
- Claude Desktop or any MCP-compatible client

## ⚙️ Configuration

### 1. Get Mindbody API Credentials

1. Sign up for a [Mindbody Developer Account](https://developers.mindbodyonline.com)
2. Create a new app to get your API credentials
3. Note your Site ID (use -99 for sandbox testing)

### 2. Set Environment Variables For Local Standalone Use

Create a `.env` file in your project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your credentials
MINDBODY_API_KEY=your_api_key_here
MINDBODY_SITE_ID=-99  # Your site ID
MINDBODY_SOURCE_NAME=your_source_name      # Optional; provide with MINDBODY_SOURCE_PASSWORD
MINDBODY_SOURCE_PASSWORD=your_source_password

# Optional settings
MINDBODY_API_URL=https://api.mindbodyonline.com/public/v6
CACHE_TTL_MINUTES=5
MCP_SERVER_NAME=mcp-mindbody
MCP_SERVER_VERSION=2.0.2
```

### 3. MissionSquad Hidden Secret Injection

When `mcp-mindbody` runs behind MissionSquad `mcp-api`, Mindbody credentials should be configured as hidden server-scoped secrets, not visible tool arguments.

Hidden contract:

- `apiKey` required
- `siteId` required
- `sourceName` optional, but only valid with `sourcePassword`
- `sourcePassword` optional, but only valid with `sourceName`
- `apiUrl` optional

MissionSquad server registration example:

```json
{
  "name": "mcp-mindbody",
  "transportType": "stdio",
  "command": "node",
  "args": ["/opt/mcp-mindbody/dist/index.js"],
  "secretNames": ["apiKey", "siteId", "sourceName", "sourcePassword", "apiUrl"],
  "secretFields": [
    {
      "name": "apiKey",
      "label": "Mindbody API key",
      "description": "Mindbody public API key for the target site.",
      "required": true,
      "inputType": "password"
    },
    {
      "name": "siteId",
      "label": "Mindbody site ID",
      "description": "Mindbody site ID for the execution target.",
      "required": true,
      "inputType": "password"
    },
    {
      "name": "sourceName",
      "label": "Mindbody source username",
      "description": "Optional source credential username. Provide with sourcePassword.",
      "required": false,
      "inputType": "password"
    },
    {
      "name": "sourcePassword",
      "label": "Mindbody source password",
      "description": "Optional source credential password. Provide with sourceName.",
      "required": false,
      "inputType": "password"
    },
    {
      "name": "apiUrl",
      "label": "Mindbody API base URL",
      "description": "Optional override for the Mindbody API base URL.",
      "required": false,
      "inputType": "password"
    }
  ]
}
```

Runtime rules:

- Tool schemas stay auth-free.
- MissionSquad injects hidden values per tool call.
- The server resolves hidden values from FastMCP `context.extraArgs`.
- Hidden values override env fallback on every call.
- The process starts without authenticated upstream access, so a shared MissionSquad server can boot before any user-specific secrets are present.

### 4. Configure Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mindbody": {
      "command": "npx",
      "args": ["@missionsquad/mcp-mindbody"],
      "env": {
        "MINDBODY_API_KEY": "your_api_key",
        "MINDBODY_SITE_ID": "-99",
        "MINDBODY_SOURCE_NAME": "your_source_name",
        "MINDBODY_SOURCE_PASSWORD": "your_source_password"
      }
    }
  }
}
```

Or use the GitHub repository directly:

```json
{
  "mcpServers": {
    "mindbody": {
      "command": "npx",
      "args": ["github:vespo92/MindbodyMCP"],
      "env": {
        "MINDBODY_API_KEY": "your_api_key",
        "MINDBODY_SITE_ID": "-99",
        "MINDBODY_SOURCE_NAME": "your_source_name",
        "MINDBODY_SOURCE_PASSWORD": "your_source_password"
      }
    }
  }
}
```

## 🛠️ Available Tools

The server provides 50+ tools across 7 categories:

### 📅 Class Management
- `getClasses` - View all classes with filters
- `getClassDescriptions` - List class types
- `getClassSchedules` - View recurring schedules
- `addClientToClass` - Book clients into classes
- `removeClientFromClass` - Cancel bookings
- `getWaitlistEntries` - Manage waitlists
- `substituteClassTeacher` - Handle substitutions

### 👥 Client Management
- `getClients` - Search and retrieve clients
- `addClient` - Register new clients
- `updateClient` - Update client information
- `getClientVisits` - View attendance history
- `getClientMemberships` - Check active memberships
- `addClientArrival` - Check-in clients
- `getClientAccountBalances` - View account balances
- `getClientContracts` - View contracts

### 💰 Sales & Commerce
- `getServices` - View available services
- `getPackages` - List class packages
- `getProducts` - Browse retail products
- `getContracts` - View membership options
- `checkoutShoppingCart` - Process purchases
- `purchaseContract` - Sell memberships

### 🏢 Site & Locations
- `getSites` - Get business information
- `getLocations` - List all locations
- `getPrograms` - View programs offered
- `getResources` - Manage resources
- `getSessionTypes` - List session types
- `getStaff` - View all staff members
- `getTeacherSchedule` - Teacher schedules

### 📆 Appointments
- `getStaffAppointments` - View appointments
- `addAppointment` - Book appointments
- `updateAppointment` - Modify appointments
- `getBookableItems` - Find available slots
- `getActiveSessionTimes` - Check availability
- `getScheduleItems` - View schedules

### 🎓 Enrollments
- `getEnrollments` - View courses/workshops
- `addClientToEnrollment` - Register for courses
- `getClientEnrollments` - View client enrollments

## 💬 Example Usage in Claude

Once configured, you can ask Claude:

```
"Show me today's yoga classes"
"Book Sarah Johnson into the 6pm Vinyasa class"
"Who's on the waitlist for tomorrow's Hot Yoga?"
"Add a new client named Jennifer Wilson"
"What's Michael's attendance this month?"
"Process a 10-class package purchase for Amy"
"Find a substitute for Maria's Thursday class"
```

## 🏗️ Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/vespo92/MindbodyMCP.git
cd MindbodyMCP

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
MindbodyMCP/
├── src/
│   ├── index.ts           # Main server entry point
│   ├── api/               # API client and auth
│   ├── tools/             # Tool implementations
│   ├── types/             # TypeScript types
│   ├── cache/             # Caching layer
│   └── utils/             # Utility functions
├── tests/                 # Test files
├── .github/workflows/     # CI/CD pipelines
└── CLAUDE.md             # Detailed documentation
```

## 🌐 SSE Deployment (Production)

The server supports SSE (Server-Sent Events) transport for production deployment, enabling web-based clients and remote access.

### Quick Start with SSE

```bash
# Start with SSE transport
npm run start:sse

# Or with environment variable
MCP_TRANSPORT=sse npm start

# With custom port
npx tsx src/index.ts --transport sse --port 8080
```

### Docker Deployment

```bash
# Using Docker Compose
docker-compose up -d

# Or manually
docker build -t mindbody-mcp .
docker run -d -p 3000:3000 -e MCP_TRANSPORT=sse mindbody-mcp
```

### Production Configuration

Configure via environment variables:
- `MCP_TRANSPORT=sse` - Enable SSE transport
- `MCP_PORT=3000` - Server port
- `MCP_HOST=0.0.0.0` - Server host
- `MCP_CORS_ORIGIN=https://yourdomain.com` - CORS configuration
- `MCP_SSL_CERT=/path/to/cert.pem` - SSL certificate (optional)
- `MCP_SSL_KEY=/path/to/key.pem` - SSL private key (optional)

### Endpoints

- `/health` - Health check endpoint
- `/info` - Server information
- `/sse` - SSE event stream for MCP communication

For detailed deployment instructions, see [SSE Deployment Guide](docs/SSE_DEPLOYMENT.md).

## 🧪 Testing

```bash
# Run all tests
npm test

# Test SSE connection
npm run test:sse

# Test specific tool
npm run test:tool

# Run benchmarks
npm run benchmark

# Type checking
npm run typecheck
```

## 📦 Publishing

The package is available on:
- **npm**: [@missionsquad/mcp-mindbody](https://www.npmjs.com/package/@missionsquad/mcp-mindbody)
- **GitHub Packages**: [vespo92/MindbodyMCP](https://github.com/vespo92/MindbodyMCP/packages)

## 🔒 Security

- API credentials are stored securely via environment variables
- OAuth 2.0 authentication with automatic token refresh
- No credentials are logged or exposed
- Regular security audits via GitHub Actions

## ⚡ Performance

- **Bun Runtime**: 4x faster startup than Node.js
- **Intelligent Caching**: 5-minute cache for dynamic data, 60-minute for static
- **Automatic Retry**: Exponential backoff for failed requests
- **Rate Limiting**: Respects Mindbody's 2000 requests/hour limit

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Mindbody API](https://developers.mindbodyonline.com) for providing comprehensive fitness studio APIs
- [Anthropic MCP SDK](https://github.com/modelcontextprotocol/sdk) for the Model Context Protocol
- [Node.js](https://nodejs.org/) for the JavaScript runtime

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/vespo92/MindbodyMCP/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vespo92/MindbodyMCP/discussions)
- **Email**: vinnie@vespo92.com

## 🚀 Roadmap

- [ ] Webhook support for real-time updates
- [ ] Advanced reporting and analytics tools
- [ ] Multi-site synchronization
- [ ] AI-powered recommendations
- [ ] Mobile app integration
- [ ] GraphQL API layer

---

<div align="center">
  Made with ❤️ for yoga studios and wellness centers worldwide
</div>
