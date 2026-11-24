# Integrations

## Several providers for one capability: strategy + gateway

When one capability has several providers used at the same time (messaging
apps, payment providers…):

```
<capability>/
├── <capability>.gateway.ts   # public API, routes each call by key (strategy context)
├── <provider>-strategy.ts    # abstract contract, one implementation per provider
├── <capability>.types.ts     # provider-neutral types (IncomingMessage, OutgoingMessage…)
└── <provider>/               # client (SDK wrapper) + strategy, per provider
```

- Each strategy declares the key it handles (`readonly channel = 'DISCORD'`).
  The gateway receives the list of enabled strategies and builds its map
  itself: no hand-written key → implementation mapping that could be wrong.
  It refuses two strategies for the same key.
- Strategy methods do not take the routing key: they already are one.
- Gateway methods are `async`, so an unknown/disabled key rejects the promise
  instead of throwing synchronously.
- Enabling a provider = providing its strategy and adding it to the factory's
  `inject` list. Per-install selection can filter that list from config.
- Keep a thin client (SDK wrapper) separate from the strategy (normalization).
- Prefer an explicit list over auto-discovery (decorator + `DiscoveryService`)
  until there are many providers: the module shows what is wired.

## A generic transport module never knows business

The capability module only speaks its own language (messages, buttons,
reactions), never business concepts (tickets). Business modules:

- subscribe to incoming events with a callback (`gateway.onMessage(handler)`);
- format their own content (texts, emoji, button ids) in a dedicated service.

Cross-cutting filters that need business data (e.g. "only registered users")
go in a module that owns that data and wraps the subscription
(`users.onUserMessage((message, sender) => …)`), not in the transport.

## Entry points: controllers and handlers

- `controllers/`: HTTP (`@Controller`).
- `handlers/`: other events (messages, queues). Registered as providers,
  subscribing in `onModuleInit`.

Both are thin: validate/translate the input, identify the caller, call a
service. No business logic.

## Inbound security

- **Webhook** (the provider calls our public URL, e.g. WhatsApp Cloud API):
  needs a guard verifying the provider's signature computed on the **raw**
  body (`rawBody: true` in `main.ts`), plus the provider's URL verification
  endpoint. The controller lives in the transport module.
- **Outbound connection** (we open a websocket to the provider, e.g. Discord
  Gateway): no guard needed, we authenticated and opened the TLS connection
  ourselves; no public URL needed either.
- Acknowledge webhooks fast and process afterwards: providers retry slow
  responses, so processing must be idempotent.
- Any HTTP API needs authentication, and the tenant (company) must come from
  the authenticated identity, never from a request parameter.
