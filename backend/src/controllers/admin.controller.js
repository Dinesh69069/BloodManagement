import { BloodBank } from '../models/blood-bank.model.js';
import { BloodRequest } from '../models/blood-request.model.js';
import { BloodStock } from '../models/blood-stock.model.js';
import { ContactMessage } from '../models/contact-message.model.js';
import { Donor } from '../models/donor.model.js';
import { User } from '../models/user.model.js';
import { BLOOD_GROUPS } from '../utils/blood.util.js';
import { csvCell } from '../utils/csv.util.js';
import { flash } from '../middleware/auth.middleware.js';
import { orderedStock } from './page.controller.js';
import { withMongoTransaction, MongoReplicaSetRequiredError, InsufficientStockError } from '../utils/transaction.util.js';

export async function getAdminDashboard(req, res) {
  const [
    requests,
    inventory,
    donorCount,
    messages,
    requestCount,
    pendingRequestCount,
    fulfilledRequestCount,
    pendingBanks,
    donorGroupCounts,
    recentDonors,
    recentRequests,
    recentMessages,
    pendingDeletionRequests,
  ] = await Promise.all([
    BloodRequest.find().populate('user', 'fullName').sort({ createdAt: -1 }).limit(200).lean(),
    orderedStock(),
    Donor.countDocuments(),
    ContactMessage.find().sort({ createdAt: -1 }).limit(50).lean(),
    BloodRequest.countDocuments(),
    BloodRequest.countDocuments({ status: 'Pending' }),
    BloodRequest.countDocuments({ status: 'Fulfilled' }),
    BloodBank.find({ verified: false }).sort({ createdAt: 1 }).limit(100).lean(),
    Donor.aggregate([{ $group: { _id: '$bloodGroup', count: { $sum: 1 } } }]),
    Donor.find().select('fullName bloodGroup city createdAt available directoryConsentStatus').sort({ createdAt: -1 }).limit(6).lean(),
    BloodRequest.find().select('patientName bloodGroup status urgency createdAt').sort({ createdAt: -1 }).limit(6).lean(),
    ContactMessage.find().select('name subject createdAt').sort({ createdAt: -1 }).limit(6).lean(),
    User.find({ accountStatus: 'deletion_requested', deletionReviewedAt: null })
      .select('fullName email deletionRequestedAt')
      .sort({ deletionRequestedAt: 1 })
      .limit(100)
      .lean(),
  ]);

  const donorCountsByGroup = new Map(donorGroupCounts.map(({ _id, count }) => [_id, count]));
  const bloodGroupStats = BLOOD_GROUPS.map((bloodGroup) => ({
    bloodGroup,
    count: donorCountsByGroup.get(bloodGroup) || 0,
  }));

  const recentActivity = [
    ...recentDonors.map((donor) => ({
      type: 'donor',
      title: `${donor.fullName} joined as a donor`,
      detail: `${donor.bloodGroup} · ${donor.city}`,
      createdAt: donor.createdAt,
    })),
    ...recentRequests.map((request) => ({
      type: 'request',
      title: `${request.urgency} blood request`,
      detail: `${request.bloodGroup} · ${request.patientName} · ${request.status}`,
      createdAt: request.createdAt,
    })),
    ...recentMessages.map((message) => ({
      type: 'message',
      title: `New enquiry from ${message.name}`,
      detail: message.subject,
      createdAt: message.createdAt,
    })),
  ].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)).slice(0, 8);

  res.render('admin', {
    requests,
    inventory,
    donorCount,
    messages,
    requestCount,
    pendingRequestCount,
    fulfilledRequestCount,
    pendingBanks,
    bloodGroupStats,
    recentDonors,
    recentActivity,
    pendingDeletionRequests,
  });
}

export async function getRequestsCsv(req, res) {
  const requests = await BloodRequest.find()
    .select('patientName bloodGroup units hospital city urgency status createdAt')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const rows = [
    ['Patient', 'Blood group', 'Units', 'Hospital', 'City', 'Urgency', 'Status', 'Created at'],
    ...requests.map((request) => [
      request.patientName,
      request.bloodGroup,
      request.units,
      request.hospital,
      request.city,
      request.urgency,
      request.status,
      request.createdAt,
    ]),
  ];

  res.type('text/csv; charset=utf-8');
  res.attachment('lifeline-blood-requests.csv');
  res.send(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
}

export async function postUpdateInventory(req, res) {
  const rawUnits = String(req.body.units ?? '');
  const units = /^\d+$/.test(rawUnits) ? Number(rawUnits) : NaN;
  const bloodGroup = String(req.body.bloodGroup || '');

  if (!BLOOD_GROUPS.includes(bloodGroup) || !Number.isInteger(units) || units < 0 || units > 100000) {
    flash(req, 'danger', 'Enter a valid blood group and inventory count.');
    return res.redirect('/admin');
  }

  await BloodStock.findOneAndUpdate(
    { bloodGroup },
    { $set: { units, updatedBy: req.session.user.id } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  flash(req, 'success', `${bloodGroup} inventory updated.`);
  res.redirect('/admin');
}

export async function postReviewBloodBank(req, res) {
  if (!['verify', 'reject'].includes(req.params.action)) {
    flash(req, 'danger', 'Invalid blood bank review action.');
    return res.redirect('/admin');
  }

  const result = req.params.action === 'verify'
    ? await BloodBank.updateOne(
      { _id: req.params.id, verified: false },
      { $set: { verified: true } },
    )
    : await BloodBank.deleteOne({ _id: req.params.id, verified: false });

  const changed = req.params.action === 'verify' ? result.modifiedCount : result.deletedCount;
  flash(req, changed ? 'success' : 'warning',
    changed
      ? req.params.action === 'verify' ? 'Blood bank listing verified and published.' : 'Unverified blood bank submission rejected.'
      : 'This blood bank submission was not changed.');
  res.redirect('/admin');
}

export async function postUpdateRequestStatus(req, res) {
  if (req.params.status === 'Fulfilled') {
    try {
      const changed = await withMongoTransaction(async (session) => {
        const request = await BloodRequest.findOne({
          _id: req.params.id,
          status: 'Approved',
        }).session(session).lean();
        if (!request) return false;

        const stockUpdate = await BloodStock.updateOne(
          { bloodGroup: request.bloodGroup, units: { $gte: request.units } },
          { $inc: { units: -request.units } },
          { session, runValidators: true },
        );
        if (stockUpdate.modifiedCount !== 1) throw new InsufficientStockError();

        const requestUpdate = await BloodRequest.updateOne(
          { _id: request._id, status: 'Approved' },
          { $set: { status: 'Fulfilled', fulfilledAt: new Date(), fulfilledBy: req.session.user.id } },
          { session },
        );
        if (requestUpdate.modifiedCount !== 1) {
          throw new Error('Request status changed before fulfillment completed.');
        }
        return true;
      });

      flash(req, changed ? 'success' : 'warning',
        changed ? 'Request fulfilled and inventory updated.' : 'Request status was not changed.');
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        flash(req, 'danger', 'There is not enough recorded inventory for this blood group to fulfill the request.');
      } else if (error instanceof MongoReplicaSetRequiredError) {
        flash(req, 'danger', 'Request fulfillment requires MongoDB to run as a replica set. No data was changed.');
      } else {
        throw error;
      }
    }
    return res.redirect('/admin');
  }

  const allowedTransitions = {
    Approved: ['Pending'],
    Rejected: ['Pending', 'Approved'],
  };
  const previous = allowedTransitions[req.params.status];
  if (!previous) {
    flash(req, 'danger', 'Invalid request status.');
    return res.redirect('/admin');
  }

  const result = await BloodRequest.updateOne(
    { _id: req.params.id, status: { $in: previous } },
    { $set: { status: req.params.status } },
  );

  flash(req, result.modifiedCount ? 'success' : 'warning',
    result.modifiedCount ? `Request marked ${req.params.status.toLowerCase()}.` : 'Request status was not changed.');
  res.redirect('/admin');
}

export async function postReviewDeletionRequest(req, res) {
  const result = await User.updateOne(
    {
      _id: req.params.id,
      accountStatus: 'deletion_requested',
      deletionReviewedAt: null,
    },
    {
      $set: {
        deletionReviewedAt: new Date(),
        deletionReviewedBy: req.session.user.id,
      },
    },
  );

  flash(req, result.modifiedCount ? 'success' : 'warning',
    result.modifiedCount
      ? 'Account deactivation request marked reviewed. No records were deleted.'
      : 'This account request was not changed.');
  res.redirect('/admin');
}

export async function postUpdateContactStatus(req, res) {
  if (!['Reviewed', 'Closed'].includes(req.params.status)) {
    flash(req, 'danger', 'Invalid contact status.');
    return res.redirect('/admin');
  }

  await ContactMessage.updateOne({ _id: req.params.id }, { $set: { status: req.params.status } });
  flash(req, 'success', 'Contact enquiry updated.');
  res.redirect('/admin');
}

