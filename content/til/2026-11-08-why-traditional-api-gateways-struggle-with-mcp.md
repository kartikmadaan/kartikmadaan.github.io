---
title: "Why Traditional API Gateways Struggle with MCP (and What an Agent Gateway Actually Does)"
date: 2026-11-08
draft: false
summary: "REST gateways assume stateless request/response traffic. MCP runs stateful, bi-directional JSON-RPC sessions where a single client aggregates tools from multiple backend servers."
tags: ["mcp", "agents", "distributed-systems"]
---

Putting Kong, Envoy, or AWS API Gateway in front of a fleet of Model Context Protocol (MCP) servers works right up until your second request. Traditional API gateways were built for stateless, request-response HTTP traffic. MCP is a stateful, bi-directional JSON-RPC 2.0 protocol where capabilities are negotiated per session and either side can initiate a call.

I'll keep it concise and to the point. Here are the three places a standard HTTP proxy breaks on MCP traffic, and what an actual agent gateway does instead.

## 1. Session-Pinned Routing vs. Round-Robin Load Balancing

In a standard REST architecture, request `N` and request `N+1` can hit two completely different backend pods without breaking anything.

MCP starts with an explicit initialization handshake (`initialize` followed by `notifications/initialized`). During that handshake, the client and server negotiate protocol versions, declare supported capabilities (like sampling, roots, or resource subscriptions), and establish an in-memory `Mcp-Session-Id`. Under the Streamable HTTP transport, the server can also upgrade a `POST` or `GET` into a long-lived Server-Sent Events (SSE) stream to push server-initiated requests back to the client.

If a traditional L7 gateway round-robins a subsequent `tools/call` POST to a pod that never saw the `initialize` handshake, the call fails immediately with an unknown session error. And if an upstream server sends a mid-execution prompt (`sampling/createMessage`) or progress notification back over an SSE stream, a stateless proxy has no way to correlate that callback with the originating client request.

An agent gateway maintains a session table keyed by `Mcp-Session-Id`, pins downstream connections to the specific upstream instance that owns the session state, and terminates or multiplexes SSE streams without dropping server-to-client RPCs.

## 2. Tool Catalog Federation and Namespace Collisions

In REST, a gateway routes by URL path (`/v1/users` goes to the user service, `/v1/billing` goes to the billing service).

In MCP, every server exposes the exact same JSON-RPC methods: `tools/list`, `tools/call`, `resources/read`, and `prompts/get`. The routing target is buried inside the JSON payload:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "github__create_issue",
    "arguments": {
      "repo": "org/service",
      "title": "Replication lag alert"
    }
  }
}
```

An agent connecting to one gateway endpoint expects a single, unified `tools/list` response instead of managing twenty separate server connections. An agent gateway acts as a federating router:

1. **Fan-out discovery:** When the client calls `tools/list`, the gateway queries the registered upstream MCP servers, merges their JSON Schemas, and prefixes each tool name (`github__create_issue`, `jira__create_issue`) so two servers defining `create_issue` do not collide.
2. **Payload-aware routing:** When `tools/call` arrives, the gateway parses the JSON-RPC body, strips the namespace prefix, looks up the owning upstream server, and forwards the rewritten frame over that server's active session.

## 3. Per-Tool Authorization Instead of Endpoint Auth

A traditional gateway validates a JWT at the edge and forwards the same bearer token to the upstream microservice. Doing that with an AI agent is a security incident waiting to happen.

First, an agent aggregating tools across GitHub, Postgres, and an internal ticketing system cannot present one bearer token that all three upstreams trust. Second, passing raw API keys into the agent runtime means a single prompt injection can exfiltrate the credential. Third, HTTP verb + path rules (`POST /mcp` = allow) are useless when both a harmless `get_issue` lookup and a destructive `delete_repository` call hit the exact same `POST /mcp` endpoint with `"method": "tools/call"`.

An agent gateway shifts the enforcement boundary inside the JSON-RPC frame:

1. **Caller identity verification:** The gateway authenticates the agent's short-lived token at the edge.
2. **Tool- and argument-level policy:** Before forwarding `tools/call`, the policy engine evaluates `(caller_identity, tool_name, arguments)`. A developer's agent might be allowed to call `postgres__query` with a `SELECT` statement, while a `DROP TABLE` or an unapproved tool is rejected in under a couple of milliseconds before the upstream server ever sees a packet.
3. **Secretless credential brokering:** The agent never holds upstream API keys. Once the policy check passes, the gateway fetches the target service credential from a vault and injects it into the upstream request headers or environment on the fly. If access is revoked mid-session, the very next `tools/call` is blocked at the gateway without waiting for a client token to expire.
