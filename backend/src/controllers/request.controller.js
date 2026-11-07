import { BloodRequest } from '../models/blood-request.model.js';
import { BLOOD_GROUPS, isValidPhone } from '../utils/blood.util.js';
import { flash } from '../middleware/auth.middleware.js';
import { withMongoTransaction, MongoReplicaSetRequiredError } from '../utils/transaction.util.js';

export function getRequestBloodPage(req, res) {
  res.render('request-blood', {
    canSubmit: Boolean(req.session.user),
  });
}

export async function postRequestBlood(req, res) {
  const units = Number(req.body.units);
  const bloodGroup = String(req.body.bloodGroup || '');
  const urgency = String(req.body.urgency || 'Normal');
  const fields = ['patientName', 'hospital', 'city', 'contactPhone'];
  const formValues = Object.fromEntries(fields.map((field) => [field, String(req.body[field] || '').trim()]));
  const message = String(req.body.message || '').trim();
  const fieldLimits = { patientName: 100, hospital: 150, city: 100, contactPhone: 20 };

  if (!BLOOD_GROUPS.includes(bloodGroup) || !Number.isInteger(units) || units < 1 || units > 20
      || !['Normal', 'Urgent', 'Emergency'].includes(urgency)
      || fields.some((field) => !formValues[field] || formValues[field].length > fieldLimits[field])
      || !isValidPhone(formValues.contactPhone)
      || message.length > 500) {
    flash(req, 'danger', 'Check all request details. Units must be between 1 and 20.');
    return res.redirect('/request-blood');
  }

  try {
    await withMongoTransaction((session) => BloodRequest.create([{
      user: req.session.user.id,
      ...formValues,
      bloodGroup,
      units,
      urgency,
      message,
    }], { session }));
  } catch (error) {
    if (error instanceof MongoReplicaSetRequiredError) {
      flash(req, 'danger', 'Submitting requests requires MongoDB to run as a replica set. No request was saved.');
      return res.redirect('/request-blood');
    }
    throw error;
  }

  flash(req, 'success', 'Blood request submitted for review.');
  res.redirect('/dashboard');
}

export async function postCancelBloodRequest(req, res) {
  const result = await BloodRequest.updateOne(
    { _id: req.params.id, user: req.session.user.id, status: 'Pending' },
    { $set: { status: 'Cancelled' } },
  );

  flash(req, result.modifiedCount ? 'success' : 'warning',
    result.modifiedCount ? 'Request cancelled.' : 'This request could not be cancelled.');
  res.redirect('/dashboard');
}

