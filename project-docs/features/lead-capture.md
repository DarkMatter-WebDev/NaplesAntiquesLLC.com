# Feature: Lead Capture (Submit Item + Newsletter)

## Summary

Two ways visitors become leads: the **"Submit Your Item"** form (sellers describe
an item + contact info and upload photos) and the **newsletter** signup.

## Submit Your Item (Netlify Forms)

- **Live implementation:** static Netlify Forms on `contact.html` and
  `/es/contact.html`, inside the `#submit-item` section.
- English form name: `submit-item`; Spanish form name: `submit-item-es`.
- The forms use `method="POST"`, `data-netlify="true"`,
  `data-netlify-honeypot="bot-field"`, and
  `enctype="multipart/form-data"` for photo uploads.
- Form fields: one required photo, item description, name, required phone, optional email,
  and location.
- The photo input is presented as a large square upload target to make the
  photo-first flow obvious. After one photo is selected from the visitor's
  computer/camera roll, a native modal opens for the remaining details and final
  submit.
- `scripts/forms/submit-item-form.js` is a small enhancement only; it updates the
  selected-photo label and opens/closes the details modal. It does not control
  delivery.
- To change recipients or notifications, configure Netlify Forms notifications in
  the Netlify site dashboard.

## Newsletter

- MailerLite universal script + embedded form on the homepage
  (`index.html` -> `#newsletter`, `<div class="ml-embedded" data-form="I6Xvs6">`).
- Managed entirely in the MailerLite dashboard.

## Other CTAs

- Click-to-call `(239) 404-8505` (`tel:` links throughout).
- Appointment / "Request a Call" anchors (`index.html#appointment`).

## Notes / Gotchas

- Submissions and uploaded photos live in Netlify Forms. Netlify supports one
  uploaded file per field, so this form collects one image. Confirm notifications
  after deploy and run a real submit test with and without photos.
- The large square upload target, native details modal, and form fields are
  styled inline in `contact.html` and `/es/contact.html`.
