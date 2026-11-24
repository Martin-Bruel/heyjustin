# Dependencies and abstraction

## No port/adapter over an existing abstraction

Use dependencies directly through concrete classes when they already abstract
what varies:

| Dependency | Already abstracts | So |
|---|---|---|
| Prisma | the database engine | a concrete repository injects `PrismaService` |
| AI SDK (`@nestjs/ai`, Vercel AI SDK) | the AI provider | a concrete service calls it |
| An internal module (`messaging`, `users`) | its own internals, through its exported API | import its service from `index.ts` |

Introduce an abstract class (port) + implementations only when **several
implementations really exist** and nothing abstracts them yet. Example: several
messaging apps → one strategy per app behind a gateway (see
[integrations.md](integrations.md)).

**Why:** an abstraction over an abstraction adds a file, a mapping and a
wiring line for nothing. A concrete class that only takes and returns domain
objects already keeps infrastructure types out of the services.

## Services

- One service per use case (`ReceiveTicketService`, `ExtractTicketService`),
  not one big `TicketService`: each file does one thing, its dependencies are
  exactly what it needs, tests stay small.
- Services are default-scoped singletons, instantiated once at startup: the
  number of services has no runtime cost. Never use `Scope.REQUEST` unless
  required: the scope propagates to every dependent provider.
- Keep the call graph between services acyclic.
- Presentation of a concept for an external system (message texts, emoji,
  button ids) lives in one service/file (`TicketNotifierService` +
  `ticket-messages.ts`), not spread over the flows.

## Naming injected dependencies

Name a constructor-injected dependency after its type, in camelCase:

```ts
constructor(
  private readonly ticketRepository: TicketRepository,
  private readonly messagingGateway: MessagingGateway,
  private readonly prismaService: PrismaService,
) {}
```

Never shortened (`tickets`, `messaging`, `prisma`). **Why:** at every
`this.xxx` call the reader knows what it is without scrolling up.

## Configuration

Inject the typed config of the module in the class that needs it (a client,
a repository), never in business services. See [config.md](config.md).
