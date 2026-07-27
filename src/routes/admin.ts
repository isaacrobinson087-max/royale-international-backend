import { Router } from "express";
import { z } from "zod";
import { ShipmentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const shipmentInput = z.object({
  shipmentReference: z.string().optional(),
  senderName: z.string().min(1),
  senderContact: z.string().optional(),
  senderEmail: z.string().email().optional().or(z.literal("")),
  recipientName: z.string().min(1),
  recipientContact: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  origin: z.string().min(1),
  destination: z.string().min(1),
  currentLocation: z.string().optional(),
  status: z.nativeEnum(ShipmentStatus).optional(),
  estimatedDeliveryDate: z.string().datetime().optional().or(z.literal(""))
});

function createTrackingNumber(sequence: number) {
  const year = new Date().getFullYear();
  return `ROY-${year}-${String(sequence).padStart(6, "0")}`;
}

async function generateUniqueTrackingNumber() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const count = await prisma.shipment.count();
    const candidate = createTrackingNumber(count + 1 + attempt);

    const exists = await prisma.shipment.findUnique({
      where: { trackingNumber: candidate }
    });

    if (!exists) return candidate;
  }

  throw new Error("Could not generate a unique tracking number.");
}

router.get("/stats", async (_req, res) => {
  const [total, grouped] = await Promise.all([
    prisma.shipment.count({ where: { archivedAt: null } }),
    prisma.shipment.groupBy({
      by: ["status"],
      where: { archivedAt: null },
      _count: { _all: true }
    })
  ]);

  const byStatus = Object.fromEntries(
    grouped.map((item) => [item.status, item._count._all])
  );

  res.json({ total, byStatus });
});

router.get("/shipments", async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const q = String(req.query.q || "").trim();

  const where: any = { archivedAt: null };

  if (q) {
    where.OR = [
      { trackingNumber: { contains: q, mode: "insensitive" } },
      { shipmentReference: { contains: q, mode: "insensitive" } },
      { senderName: { contains: q, mode: "insensitive" } },
      { recipientName: { contains: q, mode: "insensitive" } },
      { origin: { contains: q, mode: "insensitive" } },
      { destination: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.shipment.count({ where })
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit)
  });
});

router.post("/shipments", async (req, res) => {
  const parsed = shipmentInput.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const data = parsed.data;
  const trackingNumber = await generateUniqueTrackingNumber();
  const status = data.status || ShipmentStatus.SHIPMENT_CREATED;
  const location = data.currentLocation || data.origin;

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      shipmentReference: data.shipmentReference,
      senderName: data.senderName,
      senderContact: data.senderContact,
      senderEmail: data.senderEmail || null,
      recipientName: data.recipientName,
      recipientContact: data.recipientContact,
      recipientEmail: data.recipientEmail || null,
      origin: data.origin,
      destination: data.destination,
      currentLocation: location,
      status,
      estimatedDeliveryDate: data.estimatedDeliveryDate
        ? new Date(data.estimatedDeliveryDate)
        : null,
      trackingEvents: {
        create: {
          status,
          location,
          description: "Shipment created."
        }
      }
    },
    include: {
      trackingEvents: true
    }
  });

  res.status(201).json(shipment);
});

router.get("/shipments/:id", async (req, res) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: req.params.id },
    include: {
      trackingEvents: {
        orderBy: { eventTimestamp: "asc" }
      }
    }
  });

  if (!shipment) {
    return res.status(404).json({ error: "Shipment not found" });
  }

  res.json(shipment);
});

router.put("/shipments/:id", async (req, res) => {
  const parsed = shipmentInput.partial().safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const data = parsed.data;

  const shipment = await prisma.shipment.update({
    where: { id: req.params.id },
    data: {
      ...data,
      senderEmail: data.senderEmail === "" ? null : data.senderEmail,
      recipientEmail: data.recipientEmail === "" ? null : data.recipientEmail,
      estimatedDeliveryDate:
        data.estimatedDeliveryDate === ""
          ? null
          : data.estimatedDeliveryDate
            ? new Date(data.estimatedDeliveryDate)
            : undefined
    }
  });

  res.json(shipment);
});

router.delete("/shipments/:id", async (req, res) => {
  const shipment = await prisma.shipment.update({
    where: { id: req.params.id },
    data: { archivedAt: new Date() }
  });

  res.json({
    success: true,
    id: shipment.id
  });
});

router.post("/shipments/:id/events", async (req, res) => {
  const schema = z.object({
    status: z.nativeEnum(ShipmentStatus),
    location: z.string().min(1),
    description: z.string().optional(),
    eventTimestamp: z.string().datetime().optional()
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: req.params.id }
  });

  if (!shipment) {
    return res.status(404).json({ error: "Shipment not found" });
  }

  const data = parsed.data;

  const event = await prisma.$transaction(async (tx) => {
    const createdEvent = await tx.trackingEvent.create({
      data: {
        shipmentId: req.params.id,
        status: data.status,
        location: data.location,
        description: data.description,
        eventTimestamp: data.eventTimestamp
          ? new Date(data.eventTimestamp)
          : new Date()
      }
    });

    await tx.shipment.update({
      where: { id: req.params.id },
      data: {
        status: data.status,
        currentLocation: data.location
      }
    });

    return createdEvent;
  });

  res.status(201).json(event);
});

router.get("/shipments/:id/events", async (req, res) => {
  const events = await prisma.trackingEvent.findMany({
    where: { shipmentId: req.params.id },
    orderBy: { eventTimestamp: "asc" }
  });

  res.json(events);
});

export default router;