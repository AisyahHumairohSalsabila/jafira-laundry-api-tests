# Jafira Laundry API Tests

A small laundry order REST API, built to practise **automated API testing** with
**Supertest + Jest + TypeScript**.

The domain comes from my Penulisan Ilmiah project, *Pembuatan Aplikasi Berbasis Website
pada Toko Jafira Laundry*. Here I focus on the QA side: writing clear test cases for
positive flows, validation errors, boundary values and business rules.

## What is tested

- **Create order** - total price calculation, decimal weight, trimmed names, unique ids
- **Validation (400)** - missing/empty name, unsupported service, zero/negative/string/too-heavy weight, malformed JSON
- **Boundary values** - weight at the maximum allowed (50 kg) vs. one above it
- **Read** - list, filter by status, get by id, `404` for unknown ids, `400` for invalid ids
- **Business rule** - order status can only move forward one step:
  `diterima -> diproses -> selesai -> diambil` (skipping or going back returns `409`)
- **Delete** - `204`, then `404` when fetched again
- **Unknown routes** - JSON `404`

35 tests in total. The full list of scenarios is in [docs/test-cases.md](docs/test-cases.md).

## API overview

| Method | Endpoint | Success | Error codes |
| --- | --- | --- | --- |
| GET | `/health` | 200 | - |
| POST | `/orders` | 201 | 400 |
| GET | `/orders?status=` | 200 | 400 |
| GET | `/orders/:id` | 200 | 400, 404 |
| PATCH | `/orders/:id/status` | 200 | 400, 404, 409 |
| DELETE | `/orders/:id` | 204 | 400, 404 |

Example request:

```json
POST /orders
{ "customerName": "Siti Aminah", "service": "cuci-setrika", "weightKg": 3 }
```

Services: `cuci-kering`, `cuci-setrika`, `setrika`. Data is kept in memory (no database needed).

## Run it

```bash
npm install
npm test               # run all tests
npm run test:coverage  # tests + coverage report
npm run dev            # start the API on http://localhost:3000
```

Tests run on every push through GitHub Actions (`.github/workflows/ci.yml`).

## Tech

TypeScript, Express, Jest, ts-jest, Supertest

## Next steps

- Add UI tests with Playwright
- Add contract checks against an OpenAPI spec
- Try basic load testing (e.g. k6)
