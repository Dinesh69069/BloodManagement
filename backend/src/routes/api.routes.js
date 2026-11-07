import { Router } from 'express';
import { BloodStock } from '../models/blood-stock.model.js';
import { BloodBank } from '../models/blood-bank.model.js';
import { Donor } from '../models/donor.model.js';
import { BloodRequest } from '../models/blood-request.model.js';
import { ContactMessage } from '../models/contact-message.model.js';
import { BLOOD_GROUPS, COMPATIBLE_DONORS, escapeRegex, isValidPhone } from '../utils/blood.util.js';
import { requireLogin } from '../middleware/auth.middleware.js';
import { orderedStock } from '../controllers/page.controller.js';

const router = Router();

// Health Check Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Blood Stock & Inventory API
router.get('/inventory', async (req, res, next) => {
  try {
    const stock = await orderedStock();
    res.json({
      success: true,
      totalUnits: stock.reduce((total, item) => total + item.units, 0),
      data: stock,
    });
  } catch (error) {
    next(error);
  }
});

// Donor Search API
router.get('/donors', async (req, res, next) => {
  try {
    const rawBloodGroup = String(req.query.bloodGroup || '').trim();
    const bloodGroup = rawBloodGroup && BLOOD_GROUPS.includes(rawBloodGroup) ? rawBloodGroup : '';
    const city = String(req.query.city || '').trim().slice(0, 100);

    const filter = { available: true, directoryConsent: true, directoryConsentStatus: 'consented' };
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (city) filter.city = new RegExp(escapeRegex(city), 'i');

    const donors = await Donor.find(filter)
      .select('fullName bloodGroup age gender city photoPath photoConsent createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: donors.length, data: donors });
  } catch (error) {
    next(error);
  }
});

// Emergency Match API
router.get('/emergency-match', async (req, res, next) => {
  try {
    const bloodGroup = BLOOD_GROUPS.includes(req.query.bloodGroup) ? req.query.bloodGroup : '';
    const city = String(req.query.city || '').trim().slice(0, 100);

    if (!bloodGroup) {
      return res.status(400).json({ success: false, error: 'Provide a valid recipient bloodGroup' });
    }

    const compatibleGroups = COMPATIBLE_DONORS[bloodGroup] || [];
    const filter = {
      bloodGroup: { $in: compatibleGroups },
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
    };
    if (city) filter.city = new RegExp(escapeRegex(city), 'i');

    const donors = await Donor.find(filter)
      .select('fullName bloodGroup city phone')
      .sort({ bloodGroup: 1 })
      .lean();

    res.json({
      success: true,
      recipientGroup: bloodGroup,
      compatibleGroups,
      count: donors.length,
      data: donors,
    });
  } catch (error) {
    next(error);
  }
});

// Verified Blood Banks API
router.get('/blood-banks', async (req, res, next) => {
  try {
    const city = String(req.query.city || '').trim().slice(0, 100);
    const bloodGroup = BLOOD_GROUPS.includes(req.query.bloodGroup) ? req.query.bloodGroup : '';
    const filter = { verified: true };
    if (city) filter.city = new RegExp(city, 'i');
    if (bloodGroup) filter.bloodGroups = bloodGroup;

    const banks = await BloodBank.find(filter).sort({ city: 1, name: 1 }).lean();
    res.json({ success: true, count: banks.length, data: banks });
  } catch (error) {
    next(error);
  }
});

// User's Requests (Authenticated)
router.get('/user/requests', requireLogin, async (req, res, next) => {
  try {
    const requests = await BloodRequest.find({ user: req.session.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
});

export default router;

