# Test cases

Automated in `tests/orders.test.ts`.

## POST /orders

| ID | Scenario | Expected |
| --- | --- | --- |
| TC-01 | Create order with valid data | 201, status `diterima`, correct `totalPrice` |
| TC-02 | Weight with decimals (2.5 kg) | 201, price = rate x 2.5 |
| TC-03 | Name with extra spaces | 201, name is trimmed |
| TC-04 | Create two orders | ids are 1 and 2 |
| TC-05 | Missing or blank customer name | 400 |
| TC-06 | Unsupported or missing service | 400 |
| TC-07 | Weight is 0, negative, or a string | 400 |
| TC-08 | Weight above 50 kg | 400 |
| TC-09 | Weight exactly 50 kg (boundary) | 201 |
| TC-10 | Empty body | 400, three error messages |
| TC-11 | Malformed JSON | 400, `invalid JSON body` |

## GET /orders and GET /orders/:id

| ID | Scenario | Expected |
| --- | --- | --- |
| TC-12 | No orders yet | 200, empty list |
| TC-13 | Two orders created | 200, list of 2 |
| TC-14 | Filter by `status=diproses` | 200, only matching orders |
| TC-15 | Filter by unknown status | 400 |
| TC-16 | Get existing order | 200, same data as created |
| TC-17 | Get unknown id (999) | 404 |
| TC-18 | Invalid id (`abc`, `0`, `-1`, `1.5`) | 400 |

## PATCH /orders/:id/status

| ID | Scenario | Expected |
| --- | --- | --- |
| TC-19 | Move through all four steps in order | 200 each time |
| TC-20 | Skip a step (`diterima` to `selesai`) | 409 |
| TC-21 | Move backwards | 409 |
| TC-22 | Change status after `diambil` | 409 |
| TC-23 | Invalid status value | 400 |
| TC-24 | Unknown order id | 404 |

## DELETE /orders/:id and others

| ID | Scenario | Expected |
| --- | --- | --- |
| TC-25 | Delete existing order, then fetch it | 204, then 404 |
| TC-26 | Delete unknown order | 404 |
| TC-27 | Health check | 200, `{ status: "ok" }` |
| TC-28 | Unknown route | 404, JSON error |
