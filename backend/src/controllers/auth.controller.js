import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { User } from '../models/user.model.js';
import { Donor } from '../models/donor.model.js';
import { BloodRequest } from '../models/blood-request.model.js';
import { Donation } from '../models/donation.model.js';
import { isValidPhone } from '../utils/blood.util.js';
import { flash } from '../middleware/auth.middleware.js';
import { withMongoTransaction, MongoReplicaSetRequiredError } from '../utils/transaction.util.js';

export function getSignupPage(req, res) {
  res.render('signup');
}

export async function postSignup(req, res) {
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (!fullName || fullName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || email.length > 120 || phone.length > 20 || !isValidPhone(phone) || password.length < 8
      || password.length > 128 || password !== confirmPassword) {
    flash(req, 'danger', 'Enter valid name, email and phone details. Passwords must match and be 8–128 characters.');
    return res.redirect('/signup');
  }

  try {
    await User.create({
      fullName,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
    });
  } catch (error) {
    if (error?.code === 11000) {
      flash(req, 'warning', 'This email is already registered. Please log in.');
      return res.redirect('/login');
    }
    throw error;
  }

  flash(req, 'success', 'Account created. Please log in.');
  res.redirect('/login');
}

export function getLoginPage(req, res) {
  res.render('login');
}

export async function postLogin(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).lean();

  if (!user || user.accountStatus !== 'active'
      || !(await bcrypt.compare(password, user.passwordHash))) {
    flash(req, 'danger', 'Invalid email or password.');
    return res.redirect('/login');
  }

  req.session.regenerate((error) => {
    if (error) {
      return res.status(500).render('error', {
        title: 'Login error',
        message: 'Unable to start your session. Please try again.',
      });
    }
    req.session.user = { id: String(user._id), name: user.fullName, role: user.role };
    req.session.csrfToken = randomBytes(32).toString('hex');
    req.session.cookie.maxAge = req.body.remember === 'on' ? 1000 * 60 * 60 * 24 * 7 : null;
    req.session.flashMessages = [{ type: 'success', message: `Welcome, ${user.fullName}!` }];
    res.redirect('/dashboard');
  });
}

export function postLogout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('lifeline.sid');
    res.redirect('/');
  });
}

export async function postDeletionRequest(req, res) {
  const password = String(req.body.password || '');
  const user = await User.findById(req.session.user.id).select('passwordHash role accountStatus').lean();

  if (!password || password.length > 128 || !user || user.accountStatus !== 'active'
      || !(await bcrypt.compare(password, user.passwordHash))) {
    flash(req, 'danger', 'Enter your current password to confirm this request.');
    return res.redirect('/dashboard#account-privacy');
  }

  if (user.role === 'admin'
      && await User.countDocuments({ role: 'admin', accountStatus: 'active' }) <= 1) {
    flash(req, 'danger', 'The last active administrator cannot be deactivated. Assign another administrator first.');
    return res.redirect('/dashboard#account-privacy');
  }

  const now = new Date();
  try {
    await withMongoTransaction(async (session) => {
      const result = await User.updateOne(
        { _id: user._id, accountStatus: 'active' },
        {
          $set: {
            accountStatus: 'deletion_requested',
            deletionRequestedAt: now,
            deletionReviewedAt: null,
            deletionReviewedBy: null,
          },
        },
        { session },
      );
      if (result.modifiedCount !== 1) throw new Error('Account status changed before the request was saved.');

      await Donor.updateOne(
        { user: user._id },
        {
          $set: {
            available: false,
            directoryConsent: false,
            directoryConsentStatus: 'withdrawn',
            directoryConsentUpdatedAt: now,
            photoConsent: false,
            photoConsentStatus: 'withdrawn',
            photoConsentUpdatedAt: now,
          },
        },
        { session },
      );
    });
  } catch (error) {
    if (error instanceof MongoReplicaSetRequiredError) {
      flash(req, 'danger', 'Account deactivation requires MongoDB to run as a replica set. No account data was changed.');
      return res.redirect('/dashboard#account-privacy');
    }
    throw error;
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).render('error', {
        title: 'Sign-out error',
        message: 'Your account has been deactivated, but this session could not be closed. Close the browser and contact LifeLine support.',
      });
    }
    res.clearCookie('lifeline.sid');
    return res.redirect('/login');
  });
}

export async function getDashboardPage(req, res) {
  const [user, donor, requests, donations] = await Promise.all([
    User.findById(req.session.user.id).select('fullName email phone').lean(),
    Donor.findOne({ user: req.session.user.id }).lean(),
    BloodRequest.find({ user: req.session.user.id }).sort({ createdAt: -1 }).lean(),
    Donation.find({ user: req.session.user.id }).sort({ donationDate: -1 }).lean(),
  ]);

  const notifications = requests.slice(0, 5).map((request) => ({
    icon: request.status === 'Fulfilled' ? '✓' : request.status === 'Rejected' ? '!' : '✚',
    title: `${request.bloodGroup} blood request ${request.status.toLowerCase()}`,
    message: request.status === 'Pending'
      ? 'Your request is waiting for review by the LifeLine team.'
      : `The request for ${request.patientName} is now ${request.status.toLowerCase()}.`,
    href: '#requests',
  }));

  if (!donor) {
    notifications.unshift({
      icon: '♥',
      title: 'Complete your donor profile',
      message: 'Add your blood group and city if you would like to appear in donor searches.',
      href: '/donor/register',
    });
  } else if (!donor.available) {
    notifications.unshift({
      icon: '◷',
      title: 'Donor availability is paused',
      message: 'Update your profile whenever you are ready to be contacted again.',
      href: '/donor/register',
    });
  }

  res.render('dashboard', {
    account: user,
    donor,
    requests,
    donations,
    notifications: notifications.slice(0, 5),
  });
}

