import { Donation } from '../models/donation.model.js';
import { Donor } from '../models/donor.model.js';
import { flash } from '../middleware/auth.middleware.js';

export async function postDonation(req, res) {
  const donationDate = new Date(String(req.body.donationDate || ''));
  const center = String(req.body.center || '').trim();
  const notes = String(req.body.notes || '').trim();

  if (Number.isNaN(donationDate.getTime()) || donationDate > new Date()
      || donationDate < new Date('1900-01-01') || center.length > 150 || notes.length > 300) {
    flash(req, 'danger', 'Enter a valid donation date and center.');
    return res.redirect('/dashboard');
  }

  await Donation.create({
    user: req.session.user.id,
    donationDate,
    center,
    notes,
  });

  await Donor.updateOne(
    { user: req.session.user.id },
    { $max: { lastDonationDate: donationDate } },
  );

  flash(req, 'success', 'Donation history entry saved.');
  res.redirect('/dashboard');
}

