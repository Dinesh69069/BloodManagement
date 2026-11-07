import path from 'node:path';
import { Donor } from '../models/donor.model.js';
import { User } from '../models/user.model.js';
import { BLOOD_GROUPS, escapeRegex, isValidPhone } from '../utils/blood.util.js';
import { removeDonorPhoto } from '../middleware/upload.middleware.js';
import { flash } from '../middleware/auth.middleware.js';
import { env } from '../config/environment.js';
import { logServerError } from '../middleware/error.middleware.js';

function isDuplicateDonorPhoneError(error) {
  return error?.code === 11000
    && (error.keyPattern?.phone === 1 || error.keyValue?.phone !== undefined);
}

export async function getDonorsPage(req, res) {
  const rawBloodGroup = String(req.query.bloodGroup || '').trim();
  const bloodGroup = rawBloodGroup && BLOOD_GROUPS.includes(rawBloodGroup) ? rawBloodGroup : '';
  const city = String(req.query.city || '').trim().slice(0, 100);
  const rawMinAge = String(req.query.minAge || '').trim();
  const rawMaxAge = String(req.query.maxAge || '').trim();
  const minAge = rawMinAge ? Number(rawMinAge) : null;
  const maxAge = rawMaxAge ? Number(rawMaxAge) : null;
  const gender = String(req.query.gender || '').trim();
  const supportedGenders = ['Female', 'Male', 'Other', 'Prefer not to say'];

  if ((rawBloodGroup && !bloodGroup)
      || (rawMinAge && (!Number.isInteger(minAge) || minAge < 18 || minAge > 65))
      || (rawMaxAge && (!Number.isInteger(maxAge) || maxAge < 18 || maxAge > 65))
      || (minAge !== null && maxAge !== null && minAge > maxAge)
      || (gender && !supportedGenders.includes(gender))) {
    flash(req, 'danger', 'Choose a valid blood group, gender and age range (18–65).');
    return res.redirect('/donors');
  }

  const searchActive = true;
  const filter = { available: true, directoryConsent: true, directoryConsentStatus: 'consented' };
  if (bloodGroup) filter.bloodGroup = bloodGroup;
  if (city) filter.city = new RegExp(escapeRegex(city), 'i');
  if (gender) filter.gender = gender;
  if (minAge !== null || maxAge !== null) {
    filter.age = {
      ...(minAge !== null ? { $gte: minAge } : {}),
      ...(maxAge !== null ? { $lte: maxAge } : {}),
    };
  }

  const donors = await Donor.find(filter).populate('user', 'fullName phone').sort({ createdAt: -1 }).lean();

  res.render('find-donors', {
    donors,
    selectedGroup: bloodGroup,
    city,
    minAge: rawMinAge,
    maxAge: rawMaxAge,
    gender,
    searchActive,
  });
}

export async function serveDonorPhoto(req, res) {
  if (!/^[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(req.params.filename)) return res.sendStatus(404);
  const photoPath = `/donor-photos/${req.params.filename}`;
  const donor = await Donor.exists({
    photoPath,
    photoConsent: true,
    photoConsentStatus: 'consented',
    available: true,
    directoryConsent: true,
    directoryConsentStatus: 'consented',
  });
  if (!donor) return res.sendStatus(404);
  res.set('Cache-Control', 'private, no-store');
  return res.sendFile(path.join(env.paths.uploads, req.params.filename));
}

export async function getDonorRegisterPage(req, res) {
  const donor = req.session.user
    ? await Donor.findOne({ user: req.session.user.id }).lean()
    : null;
  const account = req.session.user
    ? await User.findById(req.session.user.id).select('fullName phone').lean()
    : null;
  res.render('donor-register', { donor, account });
}

export async function postDonorRegister(req, res) {
  const age = Number(req.body.age);
  const bloodGroup = String(req.body.bloodGroup || '');
  const city = String(req.body.city || '').trim();
  const account = req.session.user
    ? await User.findById(req.session.user.id).select('fullName phone').lean()
    : null;
  const existingDonor = req.session.user
    ? await Donor.findOne({ user: req.session.user.id }).lean()
    : null;
  const fullName = String(req.body.fullName || account?.fullName || '').trim();
  const phone = String(req.body.phone || account?.phone || '').trim();
  const lastDonationDate = req.body.lastDonationDate ? new Date(req.body.lastDonationDate) : null;
  const gender = String(req.body.gender || 'Prefer not to say');

  if (!fullName || fullName.length > 100 || phone.length > 20 || !isValidPhone(phone)
      || !Number.isInteger(age) || age < 18 || age > 65 || !BLOOD_GROUPS.includes(bloodGroup)
      || !['Prefer not to say', 'Female', 'Male', 'Other'].includes(gender)
      || !city || city.length > 100 || (lastDonationDate && Number.isNaN(lastDonationDate.getTime()))
      || (lastDonationDate && lastDonationDate > new Date())) {
    if (req.file) await removeDonorPhoto(req.file.filename);
    flash(req, 'danger', 'Please check age, blood group, city and last donation date.');
    return res.redirect('/donor/register');
  }

  const available = Array.isArray(req.body.available)
    ? req.body.available.includes('on')
    : req.body.available !== 'off';
  const directoryConsent = req.body.directoryConsent === 'on';
  const consentUpdatedAt = new Date();
  const directoryConsentStatus = directoryConsent
    ? 'consented'
    : existingDonor?.directoryConsentStatus === 'consented' ? 'withdrawn' : 'unknown';
  const photoConsent = req.body.photoConsent === 'on'
    && Boolean(req.file || existingDonor?.photoPath);
  const photoConsentStatus = photoConsent
    ? 'consented'
    : existingDonor?.photoConsentStatus === 'consented' ? 'withdrawn' : 'unknown';

  if (!req.session.user && !directoryConsent) {
    if (req.file) await removeDonorPhoto(req.file.filename);
    flash(req, 'danger', 'Please consent to public donor-directory visibility before registering.');
    return res.redirect('/donor/register');
  }
  if (req.file && req.body.photoConsent !== 'on') {
    await removeDonorPhoto(req.file.filename);
    flash(req, 'danger', 'Please confirm that you consent to display your uploaded photo in donor search.');
    return res.redirect('/donor/register');
  }

  const phoneConflictFilter = { phone };
  if (req.session.user) phoneConflictFilter.user = { $ne: req.session.user.id };
  if (await Donor.exists(phoneConflictFilter)) {
    if (req.file) await removeDonorPhoto(req.file.filename);
    flash(req, 'danger', 'This phone number is already registered as a donor. Please use a different number.');
    return res.redirect('/donor/register');
  }

  const photoPath = req.file
    ? `/donor-photos/${req.file.filename}`
    : req.body.photoConsent === 'on' && req.body.removePhoto !== 'on'
      ? existingDonor?.photoPath || null
      : null;

  const donorDetails = {
    fullName,
    phone,
    bloodGroup,
    age,
    gender,
    city,
    address: String(req.body.address || '').trim().slice(0, 255),
    lastDonationDate,
    directoryConsent,
    directoryConsentStatus,
    directoryConsentUpdatedAt: directoryConsent || directoryConsentStatus === 'withdrawn'
      ? consentUpdatedAt
      : existingDonor?.directoryConsentUpdatedAt || null,
    directoryConsentPolicyVersion: directoryConsent
      ? env.directoryConsentPolicyVersion
      : existingDonor?.directoryConsentPolicyVersion || null,
    photoPath,
    photoConsent: Boolean(photoPath && photoConsent),
    photoConsentStatus,
    photoConsentUpdatedAt: photoConsent || photoConsentStatus === 'withdrawn'
      ? consentUpdatedAt
      : existingDonor?.photoConsentUpdatedAt || null,
    available: available && directoryConsent,
  };

  if (req.session.user) {
    try {
      await Donor.findOneAndUpdate(
        { user: req.session.user.id },
        { ...donorDetails, user: req.session.user.id },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (req.file) await removeDonorPhoto(req.file.filename);
      if (!isDuplicateDonorPhoneError(error)) throw error;
      flash(req, 'danger', 'This phone number is already registered as a donor. Please use a different number.');
      return res.redirect('/donor/register');
    }

    if (existingDonor?.photoPath && existingDonor.photoPath !== photoPath) {
      const previousFilename = path.basename(existingDonor.photoPath);
      await removeDonorPhoto(previousFilename).catch(logServerError);
    }

    flash(req, 'success', donorDetails.available
      ? 'Donor profile saved.'
      : 'Donor profile saved. Your public listing is paused until you are available and have given directory consent.');
    return res.redirect('/dashboard');
  }

  try {
    await Donor.create(donorDetails);
  } catch (error) {
    if (req.file) await removeDonorPhoto(req.file.filename);
    if (!isDuplicateDonorPhoneError(error)) throw error;
    flash(req, 'danger', 'This phone number is already registered as a donor. Please use a different number.');
    return res.redirect('/donor/register');
  }

  flash(req, 'success', 'Thank you for registering as a donor. You can now be found by people searching in your area.');
  res.redirect('/donors?bloodGroup=' + encodeURIComponent(bloodGroup) + '&city=' + encodeURIComponent(city));
}

