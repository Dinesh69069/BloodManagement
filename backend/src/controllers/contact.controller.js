import { ContactMessage } from '../models/contact-message.model.js';
import { flash } from '../middleware/auth.middleware.js';

export function getContactPage(req, res) {
  res.render('contact');
}

export async function postContact(req, res) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();

  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || email.length > 120 || !subject || subject.length > 150 || !message || message.length > 2000) {
    flash(req, 'danger', 'Please complete all contact fields with valid details.');
    return res.redirect('/contact');
  }

  await ContactMessage.create({ name, email, subject, message });
  flash(req, 'success', 'Thanks for contacting LifeLine. Your message has been received.');
  res.redirect('/contact');
}

