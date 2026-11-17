# lachinsoufizadeh.github.io

Personal website of Lachin Soufizadeh Balaneji, published with GitHub Pages at
https://lachinsoufizadeh.github.io

It is plain HTML and CSS with no build step: edit a file, commit to `main`, and
GitHub Pages republishes the site within a minute or two.

## Where things are

| What | File |
| --- | --- |
| All page text (research, publications, background, contact) | `index.html` |
| Colours, fonts and layout | `assets/css/site.css` |
| The recording illustration at the top of the page | `assets/js/recording.js` |
| Photo, favicon and link-preview image | `assets/img/` |
| Font files (Literata, SIL Open Font License) | `assets/fonts/` |
| Page shown for broken links | `404.html` |

## Common edits

- **Add a publication or poster:** in `index.html`, copy one `<li class="entry">`
  block inside the "Publications and posters" section and change the year,
  title, link, authors and venue. Newest goes first.
- **Change your email or links:** search `index.html` for `mailto:`,
  `linkedin.com` and `github.com`. They appear in the top section, the contact
  section and the `application/ld+json` block in `<head>`.
- **Replace the photo:** export a 4:5 portrait at 400×500 and 800×1000 pixels as
  both `.jpg` and `.webp`, keeping the same file names in `assets/img/`.
- **Update the date in the footer** when you make changes.

The recording at the top is an illustration made from synthetic signals, not
real data. The caption on the page says so.
