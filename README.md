# heyjustin

Expense receipts, straight from your chat app to your accounting.

Employees send a photo or PDF of a receipt to a bot, in the messaging app
they already use. heyjustin reads it with AI, asks the employee to confirm
what it read, then imports the invoice into [Pennylane](https://www.pennylane.com/)
and follows it until it is matched with a bank transaction. No app to
install, no form to fill in.

## How it works

1. **Send:** the employee sends one receipt per message to the bot.
2. **Read:** AI extracts the supplier, date, total, VAT and currency.
3. **Confirm:** the bot replies with a recap and two buttons, _Validate_ / _Cancel_.
4. **Import:** once validated, the invoice is created in the company's Pennylane.
5. **Match:** heyjustin waits for the matching bank transaction in Pennylane.

The employee follows the progress through the reaction the bot puts on their
message:

| Reaction | Meaning                                                                              |
| -------- | ------------------------------------------------------------------------------------ |
| 🕓       | In progress: being read, waiting for validation, or waiting for the bank transaction |
| ✅       | Done: imported and matched with a bank transaction                                   |
| ⚠️       | Imported, but no transaction found: to match by hand in Pennylane                    |
| ❌       | Failed: send the receipt again                                                       |
| 🚫       | Cancelled by the employee                                                            |
| 🔁       | Already sent before                                                                  |

## Repository

```
apps/back/          NestJS backend (TypeScript, Prisma, PostgreSQL)
docs/project/       the product: domain, ticket lifecycle, decisions, open questions
docs/best-practices/  architecture and coding rules (NestJS, not project-specific)
docker-compose.yaml local PostgreSQL
```

## Getting started

Requirements: Node.js, Docker, and a Discord bot token.

```bash
docker compose up -d
cd apps/back
cp .env.example .env   # fill it in, every variable is explained
npm install
npm run prisma:deploy
npm run start:dev
```

Details in [apps/back/README.md](apps/back/README.md). The Discord bot must
share a server with you to receive your direct messages.

## Documentation

- [Domain](docs/project/domain.md): vocabulary, ticket lifecycle, modules, channels.
- [Decisions](docs/project/decisions/): why the code is the way it is.
- [Open questions](docs/project/open-questions.md): what is not decided or not built yet.
- [Best practices](docs/best-practices/README.md): rules followed by the code.
