import express, { NextFunction, Request, Response } from 'express';

export const SERVICES = ['cuci-kering', 'cuci-setrika', 'setrika'] as const;
export const STATUS_FLOW = ['diterima', 'diproses', 'selesai', 'diambil'] as const;

export type Service = (typeof SERVICES)[number];
export type Status = (typeof STATUS_FLOW)[number];

export interface Order {
  id: number;
  customerName: string;
  service: Service;
  weightKg: number;
  totalPrice: number;
  status: Status;
}

// Price per kg in rupiah (example values for this demo).
export const PRICE_PER_KG: Record<Service, number> = {
  'cuci-kering': 6000,
  'cuci-setrika': 8000,
  setrika: 5000,
};

export const MAX_WEIGHT_KG = 50;

const isService = (value: unknown): value is Service =>
  typeof value === 'string' && (SERVICES as readonly string[]).includes(value);

const isStatus = (value: unknown): value is Status =>
  typeof value === 'string' && (STATUS_FLOW as readonly string[]).includes(value);

const parseId = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
};

/**
 * Builds a fresh app with its own in-memory data,
 * so every test file/test can start from a clean state.
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  let orders: Order[] = [];
  let nextId = 1;

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/orders', (req: Request, res: Response) => {
    const { customerName, service, weightKg } = req.body ?? {};
    const errors: string[] = [];

    if (typeof customerName !== 'string' || customerName.trim() === '') {
      errors.push('customerName is required');
    }
    if (!isService(service)) {
      errors.push(`service must be one of: ${SERVICES.join(', ')}`);
    }
    if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
      errors.push('weightKg must be a number greater than 0');
    } else if (weightKg > MAX_WEIGHT_KG) {
      errors.push(`weightKg must not exceed ${MAX_WEIGHT_KG}`);
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const order: Order = {
      id: nextId++,
      customerName: customerName.trim(),
      service,
      weightKg,
      totalPrice: PRICE_PER_KG[service as Service] * weightKg,
      status: 'diterima',
    };
    orders.push(order);
    return res.status(201).json(order);
  });

  app.get('/orders', (req: Request, res: Response) => {
    const { status } = req.query;
    if (status !== undefined) {
      if (!isStatus(status)) {
        return res
          .status(400)
          .json({ errors: [`status must be one of: ${STATUS_FLOW.join(', ')}`] });
      }
      return res.status(200).json(orders.filter((o) => o.status === status));
    }
    return res.status(200).json(orders);
  });

  app.get('/orders/:id', (req: Request, res: Response) => {
    const id = parseId(String(req.params.id));
    if (id === null) return res.status(400).json({ errors: ['id must be a positive integer'] });

    const order = orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({ errors: ['order not found'] });
    return res.status(200).json(order);
  });

  // Status can only move forward one step: diterima -> diproses -> selesai -> diambil
  app.patch('/orders/:id/status', (req: Request, res: Response) => {
    const id = parseId(String(req.params.id));
    if (id === null) return res.status(400).json({ errors: ['id must be a positive integer'] });

    const { status } = req.body ?? {};
    if (!isStatus(status)) {
      return res
        .status(400)
        .json({ errors: [`status must be one of: ${STATUS_FLOW.join(', ')}`] });
    }

    const order = orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({ errors: ['order not found'] });

    const current = STATUS_FLOW.indexOf(order.status);
    const target = STATUS_FLOW.indexOf(status);
    if (target !== current + 1) {
      return res.status(409).json({
        errors: [`cannot change status from "${order.status}" to "${status}"`],
      });
    }

    order.status = status;
    return res.status(200).json(order);
  });

  app.delete('/orders/:id', (req: Request, res: Response) => {
    const id = parseId(String(req.params.id));
    if (id === null) return res.status(400).json({ errors: ['id must be a positive integer'] });

    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return res.status(404).json({ errors: ['order not found'] });

    orders.splice(index, 1);
    return res.status(204).send();
  });

  // Unknown route
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ errors: ['route not found'] });
  });

  // Malformed JSON body and other errors
  app.use((err: { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ errors: ['invalid JSON body'] });
    }
    return res.status(err.status ?? 500).json({ errors: ['unexpected error'] });
  });

  return app;
}
