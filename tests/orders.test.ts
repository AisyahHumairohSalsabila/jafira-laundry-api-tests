import request from 'supertest';
import { createApp, MAX_WEIGHT_KG, PRICE_PER_KG } from '../src/app';

const validOrder = {
  customerName: 'Siti Aminah',
  service: 'cuci-setrika',
  weightKg: 3,
};

// Helper: create an order and return the response body
async function createOrder(app: ReturnType<typeof createApp>, body: object = validOrder) {
  const res = await request(app).post('/orders').send(body);
  return res.body;
}

describe('GET /health', () => {
  it('returns 200 and status ok', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /orders', () => {
  it('creates an order with status "diterima" and the right total price', async () => {
    const res = await request(createApp()).post('/orders').send(validOrder);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 1,
      customerName: 'Siti Aminah',
      service: 'cuci-setrika',
      weightKg: 3,
      status: 'diterima',
      totalPrice: PRICE_PER_KG['cuci-setrika'] * 3,
    });
  });

  it('accepts decimal weight and calculates price correctly', async () => {
    const res = await request(createApp())
      .post('/orders')
      .send({ ...validOrder, service: 'setrika', weightKg: 2.5 });

    expect(res.status).toBe(201);
    expect(res.body.totalPrice).toBe(PRICE_PER_KG.setrika * 2.5);
  });

  it('trims spaces around the customer name', async () => {
    const res = await request(createApp())
      .post('/orders')
      .send({ ...validOrder, customerName: '  Budi  ' });

    expect(res.status).toBe(201);
    expect(res.body.customerName).toBe('Budi');
  });

  it('gives each new order a unique, increasing id', async () => {
    const app = createApp();
    const first = await createOrder(app);
    const second = await createOrder(app);

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
  });

  it.each([
    ['customerName is missing', { service: 'setrika', weightKg: 1 }],
    ['customerName is empty spaces', { ...validOrder, customerName: '   ' }],
    ['service is not supported', { ...validOrder, service: 'dry-clean' }],
    ['service is missing', { customerName: 'Budi', weightKg: 1 }],
    ['weightKg is zero', { ...validOrder, weightKg: 0 }],
    ['weightKg is negative', { ...validOrder, weightKg: -2 }],
    ['weightKg is a string', { ...validOrder, weightKg: '3' }],
    ['weightKg is above the maximum', { ...validOrder, weightKg: MAX_WEIGHT_KG + 1 }],
  ])('returns 400 when %s', async (_caseName, body) => {
    const res = await request(createApp()).post('/orders').send(body);

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expect.any(Array));
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('returns 400 with all validation errors at once', async () => {
    const res = await request(createApp()).post('/orders').send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(3);
  });

  it('accepts the maximum allowed weight (boundary value)', async () => {
    const res = await request(createApp())
      .post('/orders')
      .send({ ...validOrder, weightKg: MAX_WEIGHT_KG });

    expect(res.status).toBe(201);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(createApp())
      .post('/orders')
      .set('Content-Type', 'application/json')
      .send('{"customerName": ');

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['invalid JSON body']);
  });
});

describe('GET /orders', () => {
  it('returns an empty list when there are no orders', async () => {
    const res = await request(createApp()).get('/orders');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all created orders', async () => {
    const app = createApp();
    await createOrder(app);
    await createOrder(app, { ...validOrder, customerName: 'Budi' });

    const res = await request(app).get('/orders');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters orders by status', async () => {
    const app = createApp();
    const first = await createOrder(app);
    await createOrder(app, { ...validOrder, customerName: 'Budi' });
    await request(app).patch(`/orders/${first.id}/status`).send({ status: 'diproses' });

    const res = await request(app).get('/orders').query({ status: 'diproses' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(first.id);
  });

  it('returns 400 for an unknown status filter', async () => {
    const res = await request(createApp()).get('/orders').query({ status: 'hilang' });

    expect(res.status).toBe(400);
  });
});

describe('GET /orders/:id', () => {
  it('returns the order when it exists', async () => {
    const app = createApp();
    const created = await createOrder(app);

    const res = await request(app).get(`/orders/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

  it('returns 404 when the order does not exist', async () => {
    const res = await request(createApp()).get('/orders/999');

    expect(res.status).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5'])('returns 400 for invalid id "%s"', async (badId) => {
    const res = await request(createApp()).get(`/orders/${badId}`);

    expect(res.status).toBe(400);
  });
});

describe('PATCH /orders/:id/status', () => {
  it('moves an order through the full flow, one step at a time', async () => {
    const app = createApp();
    const { id } = await createOrder(app);

    for (const status of ['diproses', 'selesai', 'diambil']) {
      const res = await request(app).patch(`/orders/${id}/status`).send({ status });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it('returns 409 when a step is skipped', async () => {
    const app = createApp();
    const { id } = await createOrder(app);

    const res = await request(app).patch(`/orders/${id}/status`).send({ status: 'selesai' });

    expect(res.status).toBe(409);
  });

  it('returns 409 when moving backwards', async () => {
    const app = createApp();
    const { id } = await createOrder(app);
    await request(app).patch(`/orders/${id}/status`).send({ status: 'diproses' });

    const res = await request(app).patch(`/orders/${id}/status`).send({ status: 'diterima' });

    expect(res.status).toBe(409);
  });

  it('returns 409 when the order is already "diambil"', async () => {
    const app = createApp();
    const { id } = await createOrder(app);
    for (const status of ['diproses', 'selesai', 'diambil']) {
      await request(app).patch(`/orders/${id}/status`).send({ status });
    }

    const res = await request(app).patch(`/orders/${id}/status`).send({ status: 'diambil' });

    expect(res.status).toBe(409);
  });

  it('returns 400 for an invalid status value', async () => {
    const app = createApp();
    const { id } = await createOrder(app);

    const res = await request(app).patch(`/orders/${id}/status`).send({ status: 'hilang' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when the order does not exist', async () => {
    const res = await request(createApp())
      .patch('/orders/999/status')
      .send({ status: 'diproses' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /orders/:id', () => {
  it('deletes an order and it can no longer be found', async () => {
    const app = createApp();
    const { id } = await createOrder(app);

    const deleteRes = await request(app).delete(`/orders/${id}`);
    const getRes = await request(app).get(`/orders/${id}`);

    expect(deleteRes.status).toBe(204);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when the order does not exist', async () => {
    const res = await request(createApp()).delete('/orders/999');

    expect(res.status).toBe(404);
  });
});

describe('Unknown routes', () => {
  it('returns 404 with a JSON error', async () => {
    const res = await request(createApp()).get('/pelanggan');

    expect(res.status).toBe(404);
    expect(res.body.errors).toEqual(['route not found']);
  });
});
