import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import multer from 'multer';
import { env } from '../config/environment.js';
import { isSupportedDonorPhoto } from '../utils/donor-photo.util.js';
import { flash } from './auth.middleware.js';

const donorPhotoExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const donorPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      mkdir(env.paths.uploads, { recursive: true })
        .then(() => callback(null, env.paths.uploads))
        .catch(callback);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomBytes(16).toString('hex')}.${donorPhotoExtensions.get(file.mimetype)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (_req, file, callback) => {
    if (!donorPhotoExtensions.has(file.mimetype)) {
      return callback(new Error('Choose a JPEG, PNG, or WebP profile photo.'));
    }
    callback(null, true);
  },
});

export async function removeDonorPhoto(filename) {
  if (!/^[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(filename || '')) return;
  try {
    await unlink(path.join(env.paths.uploads, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function handleDonorPhotoUpload(req, res, next) {
  if (req.method !== 'POST' || req.path !== '/donor/register'
      || !req.is('multipart/form-data')) return next();

  donorPhotoUpload.single('photo')(req, res, (error) => {
    if (error) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Profile photos must be 5 MB or smaller.'
        : error instanceof multer.MulterError
          ? 'Choose one JPEG, PNG, or WebP profile photo.'
          : error.message === 'Choose a JPEG, PNG, or WebP profile photo.'
            ? error.message
            : 'Unable to process the profile photo. Please try again.';
      flash(req, 'danger', message);
      return res.redirect('/donor/register');
    }
    if (!req.file) return next();
    readFile(req.file.path)
      .then(async (buffer) => {
        if (isSupportedDonorPhoto(buffer, req.file.mimetype)) return next();
        await removeDonorPhoto(req.file.filename);
        req.file = undefined;
        flash(req, 'danger', 'The selected file is not a valid JPEG, PNG, or WebP image.');
        return res.redirect('/donor/register');
      })
      .catch(next);
  });
}

