import { BloodRequest } from '../models/blood-request.model.js';
import { BloodStock } from '../models/blood-stock.model.js';
import { Donor } from '../models/donor.model.js';
import { BLOOD_GROUPS, COMPATIBLE_DONORS, escapeRegex } from '../utils/blood.util.js';

export async function orderedStock() {
  const records = await BloodStock.find().lean();
  const byGroup = new Map(records.map((record) => [record.bloodGroup, record]));
  return BLOOD_GROUPS.map((bloodGroup) => byGroup.get(bloodGroup) || { bloodGroup, units: 0 });
}

export async function getHomePage(req, res) {
  const [totalDonors, totalRequests, stock] = await Promise.all([
    Donor.countDocuments({
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
    }),
    BloodRequest.countDocuments(),
    orderedStock(),
  ]);

  res.render('home', {
    totalDonors,
    totalRequests,
    totalUnits: stock.reduce((total, item) => total + item.units, 0),
    inventory: stock,
  });
}

export function getAboutPage(req, res) {
  res.render('about');
}

export function getHowItWorksPage(req, res) {
  res.render('how-it-works', {
    compatibleDonors: COMPATIBLE_DONORS,
  });
}

export function getPrivacyPage(req, res) {
  res.render('privacy');
}

export function getTermsPage(req, res) {
  res.render('terms');
}

export async function getEmergencyMatchPage(req, res) {
  const bloodGroup = BLOOD_GROUPS.includes(req.query.bloodGroup) ? req.query.bloodGroup : '';
  const city = String(req.query.city || '').trim().slice(0, 100);
  let donors = [];

  if (bloodGroup) {
    const filter = {
      bloodGroup: { $in: COMPATIBLE_DONORS[bloodGroup] },
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
    };
    if (city) filter.city = new RegExp(escapeRegex(city), 'i');
    donors = await Donor.find(filter).populate('user', 'fullName phone').sort({ bloodGroup: 1 }).lean();
  }

  res.render('emergency-match', {
    donors,
    selectedGroup: bloodGroup,
    city,
    compatibleGroups: COMPATIBLE_DONORS[bloodGroup] || [],
  });
}

