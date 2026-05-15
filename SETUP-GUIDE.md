# Trusty Water Website — Setup Guide

## Files in This Folder

```
website/
  index.html       ← Homepage
  services.html    ← Services page
  about.html       ← About page
  contact.html     ← Contact / booking page
  sitemap.xml      ← Submit to Google Search Console
  robots.txt       ← Search engine crawl rules
  css/
    style.css      ← All styles (shared across pages)
```

---

## Step 1: Fill In Your Placeholders

Search for these strings across all files and replace with your real info:

| Placeholder             | Replace with                                      |
|-------------------------|---------------------------------------------------|
| `[YOUR CITY, STATE]`    | e.g. "Phoenix, AZ" or "Salt Lake City, UT"        |
| `[YOUR CITY]`           | e.g. "Phoenix"                                    |
| `[YOUR STATE]`          | e.g. "AZ" or "Arizona"                            |
| `[STATE CODE]`          | 2-letter state code, e.g. "US-AZ"                 |
| `[YOUR PHONE]`          | Your real phone (also update `href="tel:..."`)     |
| `(555) 555-5555`        | Your real phone number                            |
| `hello@trustywater.com` | Your real email                                   |
| `[YOUR ADDRESS]`        | Your business address                             |
| `[YOUR LAT]` / `[YOUR LNG]` | Your GPS coordinates (for schema markup)      |
| `[City 1]` etc.         | Cities in your service area                       |
| `[YOUR STATE] Lic. #[NUMBER]` | Your actual license number                  |
| `https://trustywater.com` | Your actual domain                              |

**Tip:** Use Ctrl+H (or Cmd+H on Mac) in any text editor to Find & Replace across all files at once. VS Code works great for this.

---

## Step 2: Add Your Google Maps Embed

On the **Contact** page, replace the map placeholder in the `area-section` with your actual Google Maps embed:
1. Go to Google Maps, search your address
2. Click Share → Embed a map → Copy HTML
3. Replace the `<div class="area-map-placeholder">` block with the iframe

---

## Step 3: Wire Up the Contact Form

The contact form currently shows a success message locally. To actually receive submissions, choose one:

**Option A — Formspree (easiest, free tier available):**
1. Go to formspree.io and create an account
2. Create a new form — you'll get a form ID (e.g. `xabc1234`)
3. Change the form's `action` attribute:
   ```html
   <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```
4. Remove the JavaScript form handler at the bottom of contact.html

**Option B — Netlify Forms (if you host on Netlify):**
1. Add `netlify` attribute to the form tag: `<form netlify>`
2. Netlify automatically handles submissions — no code needed

**Option C — EmailJS:**
Good for sending form data directly to your email without a backend.

---

## Step 4: Deploy the Website

### Option A — Netlify (Recommended, Free)
1. Go to netlify.com and create a free account
2. Drag and drop the entire `website/` folder onto the Netlify dashboard
3. Your site goes live instantly with a free `.netlify.app` domain
4. Connect your custom domain (trustywater.com) in Settings → Domain Management

### Option B — GoDaddy / Bluehost / SiteGround
1. Purchase hosting + domain
2. Upload files via cPanel File Manager or FTP
3. Upload everything in the `website/` folder to the `public_html` directory

### Option C — GitHub Pages (Free)
1. Create a GitHub repo
2. Push the `website/` folder contents to the repo
3. Enable GitHub Pages in Settings

---

## Step 5: SEO Setup (Do This After Launch)

1. **Google Search Console** — Add your domain at search.google.com/search-console. Submit sitemap.xml.
2. **Google Business Profile** — Set up at business.google.com. This is the #1 local SEO action.
3. **Google Analytics** — Add GA4 tracking by inserting the GA snippet before `</head>` on each page.
4. **Bing Webmaster Tools** — Submit sitemap to bing.com/webmasters too.

---

## Step 6: Add Real Photos

Replace the placeholder/CSS-gradient visuals with real photos:
- A photo of your team or van on the homepage hero
- Before/after shots of installations
- Photos of equipment you install (softeners, filters)

Use compressed `.webp` format for fastest load times. Free tools: squoosh.app or tinypng.com.

---

## Long-Term Maintenance

- Update `sitemap.xml` lastmod dates when you make significant changes
- Add new pages as you add new services (e.g., a dedicated "Water Softener [City]" page for each city you serve — great for local SEO)
- Ask every customer for a Google review and add testimonials to the site quarterly
- Add a blog section over time with articles like "Signs You Need a Water Softener in [City]" — these rank well

---

*Built by Claude for Trusty Water, May 2026.*
