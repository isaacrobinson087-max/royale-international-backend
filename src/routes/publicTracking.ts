import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../lib/prisma";

const router = Router();

const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
});

router.get("/track/:trackingNumber", trackingLimiter, async (req, res) => {
  const trackingNumber = String(req.params.trackingNumber).trim().toUpperCase();

  const shipment = await prisma.shipment.findFirst({
    where: {
      trackingNumber,
      archivedAt: null
    },
    include: {
      trackingEvents: {
        orderBy: { eventTimestamp: "asc" }
      }
    }
  });

  if (!shipment) {
    return res.status(404).json({
      error: "Shipment not found"
    });
  }

  res.json({
    trackingNumber: shipment.trackingNumber,
    shipmentReference: shipment.shipmentReference,
    origin: shipment.origin,
    destination: shipment.destination,
    currentLocation: shipment.currentLocation,
    currentStatus: shipment.status,
    estimatedDeliveryDate: shipment.estimatedDeliveryDate,
    trackingHistory: shipment.trackingEvents.map((event) => ({
      status: event.status,
      location: event.location,
      description: event.description,
      eventTimestamp: event.eventTimestamp
    }))
  });
});

export default router;