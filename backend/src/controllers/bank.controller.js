import { BloodBank } from '../models/blood-bank.model.js';
import { BLOOD_GROUPS } from '../utils/blood.util.js';
import { flash } from '../middleware/auth.middleware.js';

export async function getBloodBanksPage(req, res) {
  const city = String(req.query.city || '').trim().slice(0, 100);
  const bloodGroup = BLOOD_GROUPS.includes(req.query.bloodGroup) ? req.query.bloodGroup : '';
  const filter = { verified: true };
  if (city) filter.city = new RegExp(city, 'i');
  if (bloodGroup) filter.bloodGroups = bloodGroup;

  const banks = await BloodBank.find(filter).sort({ city: 1, name: 1 }).lean();
  res.render('blood-banks', { banks, city, selectedGroup: bloodGroup });
}

export async function postSuggestBloodBank(req, res) {
  const name = String(req.body.name || '').trim();
  const address = String(req.body.address || '').trim();
  const city = String(req.body.city || '').trim();
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const openingHours = String(req.body.openingHours || '').trim();
  const rawBloodGroups = req.body.bloodGroups;
  const bloodGroups = Array.isArray(rawBloodGroups)
    ? rawBloodGroups
    : rawBloodGroups ? [rawBloodGroups] : [];
  const phoneDigits = phone.replace(/\D/g, '');

  if (!name || name.length > 150 || !address || address.length > 255
      || !city || city.length > 100 || phone.length > 20
      || !/^[+\d().\-\s]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15
      || (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120))
      || openingHours.length > 200 || bloodGroups.some((group) => !BLOOD_GROUPS.includes(group))) {
    flash(req, 'danger', 'Please enter valid blood bank details before submitting.');
    return res.redirect('/blood-banks#register-bank');
  }

  await BloodBank.create({
    name,
    address,
    city,
    phone,
    email,
    openingHours,
    bloodGroups,
    verified: false,
  });

  flash(req, 'success', 'Thank you. Your blood bank submission is pending administrator verification.');
  res.redirect('/blood-banks#directory');
}

