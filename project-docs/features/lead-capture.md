# Feature: Lead Capture (Submit Item + Newsletter)

## Summary

Two ways visitors become leads: the **"Submit Your Item"** form (sellers describe
an item + contact info, optional photos) and the **newsletter** signup.

## Submit Your Item (Jotform)

- **Live implementation:** a **Jotform** is embedded directly on `contact.html`
  inside the `#submit-item` section:
  ```html
  <div class="jotform-embed">
    <script type="text/javascript" src="https://form.jotform.com/jsform/261379265677068"></script>
  </div>
  ```
- Jotform handles submission delivery, validation, and **photo uploads** — no
  custom backend or `FORM_ACTION` needed.
- Form fields (per Jotform): Name, Location, Phone, "What would you like to
  submit?", optional photo upload.
- To change fields, recipients, or notifications, edit the form in the Jotform
  dashboard (form id `261379265677068`).

### Legacy (unused) custom form

`submit-item-form.partial.html`, `submit-item-form.css`, and
`scripts/forms/submit-item-form.js` are the **old** custom form (with an empty
`FORM_ACTION`). They are no longer referenced by any page and can be removed (see
`TASKS.md`). A legacy redirect for `/submit-item-form.js` still exists in
`netlify.toml`.

## Newsletter

- MailerLite universal script + embedded form on the homepage
  (`index.html` → `#newsletter`, `<div class="ml-embedded" data-form="I6Xvs6">`).
- Managed entirely in the MailerLite dashboard.

## Other CTAs

- Click-to-call `(239) 404-8505` (`tel:` links throughout).
- Appointment / "Request a Call" anchors (`index.html#appointment`).

## Notes / Gotchas

- Submissions and uploaded photos live in the Jotform account — make sure email
  notifications are enabled and pointed at the right recipient.
- The Jotform iframe is styled via `.jotform-embed` in `contact.html`.
