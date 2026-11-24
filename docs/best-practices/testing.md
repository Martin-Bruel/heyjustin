# Testing

## Fake only the edges

Unit-test services with `new` and fakes, without Nest. Fake only what leaves
the process (database, AI, the external app); use real collaborators for the
rest.

Example: the ticket flow test uses the real `MessagingGateway` and the real
notifier, with a fake strategy recording what would be sent. It checks the
whole path down to the message, not just that a mock was called.

For AI calls, fake the model, not the service: the real `AiService` with
`FakeModel` (`@nestjs/ai/testing`) also covers the schema validation, the
error mapping and what is sent to the model, without network.

## Faking a class

- A class with no private field: extend it and override (`class FakeClock extends Clock`).
- A class with a private field (`private readonly prismaService`): TypeScript
  refuses another class in its place. Use a plain object, checked against the
  public API, then cast:

```ts
const repository = {
  findById: async (id: string) => tickets.get(id) ?? null,
  // ...
} satisfies Record<keyof TicketRepository, unknown>;
return repository as unknown as TicketRepository;
```

`satisfies` makes the fake fail to compile when a method is added to the real class.

## What to test

- Entities: each transition, forbidden transitions, final statuses.
- Mappers: round-trip for each status (entity → row → entity), and rejection
  of an inconsistent row.
- Value objects: their validation rules.
- Entry points: the translation of the input, the ignored cases.
- User-facing texts: formatting (locale, currency, dates).

## Wiring check

After moving providers or modules, check Nest can build the dependency graph:

```ts
await Test.createTestingModule({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ DATABASE_URL: 'postgresql://x@localhost/x' })] }), TicketsModule],
}).compile(); // resolves DI without running lifecycle hooks (no connection)
```

## Checks after each change

Format, lint, type-check, tests: `prettier`, `oxlint`, `tsc --noEmit`, `vitest run`.
