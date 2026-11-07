import { Router } from 'express';
import {
  getHomePage,
  getAboutPage,
  getHowItWorksPage,
  getPrivacyPage,
  getTermsPage,
  getEmergencyMatchPage,
} from '../controllers/page.controller.js';
import {
  getSignupPage,
  postSignup,
  getLoginPage,
  postLogin,
  postLogout,
  postDeletionRequest,
  getDashboardPage,
} from '../controllers/auth.controller.js';
import {
  getDonorsPage,
  serveDonorPhoto,
  getDonorRegisterPage,
  postDonorRegister,
} from '../controllers/donor.controller.js';
import {
  getRequestBloodPage,
  postRequestBlood,
  postCancelBloodRequest,
} from '../controllers/request.controller.js';
import {
  getBloodBanksPage,
  postSuggestBloodBank,
} from '../controllers/bank.controller.js';
import { postDonation } from '../controllers/donation.controller.js';
import { getContactPage, postContact } from '../controllers/contact.controller.js';
import {
  getAdminDashboard,
  getRequestsCsv,
  postUpdateInventory,
  postReviewBloodBank,
  postUpdateRequestStatus,
  postReviewDeletionRequest,
  postUpdateContactStatus,
} from '../controllers/admin.controller.js';
import { requireLogin, requireAdmin } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Public Information Pages
router.get('/', asyncRoute(getHomePage));
router.get('/about', getAboutPage);
router.get('/how-it-works', getHowItWorksPage);
router.get('/privacy', getPrivacyPage);
router.get('/terms', getTermsPage);

// Donor Discovery & Registration
router.get('/donors', asyncRoute(getDonorsPage));
router.get('/donor-photos/:filename', asyncRoute(serveDonorPhoto));
router.get('/donor/register', asyncRoute(getDonorRegisterPage));
router.post('/donor/register', asyncRoute(postDonorRegister));

// Authentication & Account
router.get('/signup', getSignupPage);
router.get('/register', (req, res) => res.redirect('/signup'));
router.post('/signup', authLimiter, asyncRoute(postSignup));
router.get('/login', getLoginPage);
router.post('/login', authLimiter, asyncRoute(postLogin));
router.post('/logout', requireLogin, postLogout);
router.post('/account/deletion-request', requireLogin, asyncRoute(postDeletionRequest));
router.get('/dashboard', requireLogin, asyncRoute(getDashboardPage));
router.post('/donations', requireLogin, asyncRoute(postDonation));

// Blood Requests
router.get('/request-blood', getRequestBloodPage);
router.post('/request-blood', requireLogin, asyncRoute(postRequestBlood));
router.post('/request-blood/:id/cancel', requireLogin, asyncRoute(postCancelBloodRequest));

// Emergency Matching
router.get('/emergency-match', asyncRoute(getEmergencyMatchPage));

// Blood Banks
router.get('/blood-banks', asyncRoute(getBloodBanksPage));
router.post('/blood-banks/suggest', asyncRoute(postSuggestBloodBank));

// Contact
router.get('/contact', getContactPage);
router.post('/contact', asyncRoute(postContact));

// Admin Operations
router.use('/admin', requireLogin, requireAdmin);
router.get('/admin', asyncRoute(getAdminDashboard));
router.get('/admin/reports/requests.csv', asyncRoute(getRequestsCsv));
router.post('/admin/inventory', asyncRoute(postUpdateInventory));
router.post('/admin/blood-bank/:id/:action', asyncRoute(postReviewBloodBank));
router.post('/admin/request/:id/:status', asyncRoute(postUpdateRequestStatus));
router.post('/admin/account/:id/deletion-request/review', asyncRoute(postReviewDeletionRequest));
router.post('/admin/contact/:id/:status', asyncRoute(postUpdateContactStatus));

export default router;

