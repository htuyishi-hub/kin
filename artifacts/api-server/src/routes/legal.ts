import { Router, type IRouter } from "express";

const legalRouter: IRouter = Router();

const PAGE_SHELL = (title: string, bodyContent: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — kinn</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #E6EDF3;
      background-color: #0D1117;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      background: #161B22;
      padding: 32px;
      border-radius: 16px;
      border: 1px solid #30363D;
    }
    h1 { color: #E5A93C; font-size: 28px; margin-top: 0; }
    h2 { color: #E6EDF3; font-size: 20px; border-bottom: 1px solid #30363D; padding-bottom: 8px; margin-top: 28px; }
    p, li { color: #8B949E; font-size: 15px; }
    strong { color: #E6EDF3; }
    a { color: #E5A93C; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { padding-left: 20px; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(229, 169, 60, 0.15);
      color: #E5A93C;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${bodyContent}
  </div>
</body>
</html>`;

legalRouter.get("/", (_req, res) => {
  res.send(PAGE_SHELL("Welcome", `
    <span class="badge">Rwanda's Trusted Network</span>
    <h1>kinn</h1>
    <p>A warm, private introduction network for serious people ready to find their person.</p>
    <p><a href="/terms">Terms of Service</a> &nbsp;·&nbsp; <a href="/privacy">Privacy Policy</a></p>
  `));
});

legalRouter.get("/terms", (_req, res) => {
  res.send(PAGE_SHELL("Terms of Service", `
    <span class="badge">Legal Document</span>
    <h1>Terms of Service</h1>
    <p>Last updated: 2026</p>
    <h2>1. Acceptance of Terms</h2>
    <p>By creating an account on kinn, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use kinn.</p>
    <h2>2. Eligibility</h2>
    <ul>
      <li>You must be at least 18 years old to use kinn.</li>
      <li>You must provide accurate information about yourself, including name, age, and photo.</li>
      <li>You may only maintain one active account at a time.</li>
    </ul>
    <h2>3. Nature of the Service</h2>
    <p>kinn is a trust-based introduction network facilitating connections between verified individuals seeking serious relationships or long-term partnerships.</p>
    <h2>4. Community Standards</h2>
    <p>All users must communicate respectfully. Harassment, threats, abusive language, solicitation, or misrepresentation will result in immediate termination.</p>
    <h2>5. Contact</h2>
    <p>For questions regarding these Terms, contact <a href="mailto:tuyishimirehonore3@gmail.com">tuyishimirehonore3@gmail.com</a>.</p>
    <p><a href="/privacy">View Privacy Policy →</a></p>
  `));
});

legalRouter.get("/privacy", (_req, res) => {
  res.send(PAGE_SHELL("Privacy Policy", `
    <span class="badge">Legal Document</span>
    <h1>Privacy Policy</h1>
    <p>Last updated: 2026</p>
    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Identity:</strong> Name, email address, phone number, age, gender.</li>
      <li><strong>Profile &amp; Photos:</strong> Profile details and photos you upload.</li>
      <li><strong>Voice Intros:</strong> Voice recording intro if you choose to record one.</li>
      <li><strong>Messages:</strong> Direct chat messages exchanged between matched users.</li>
    </ul>
    <h2>2. How We Use Your Information</h2>
    <p>Your data is used solely to provide the matching and messaging services, verify accounts, and maintain platform safety.</p>
    <h2>3. What We Never Do</h2>
    <p>kinn does not sell user data. kinn does not share your data with third-party advertisers.</p>
    <h2>4. Data Deletion &amp; Rights</h2>
    <p>You have the right to access, edit, or delete your account and associated personal data at any time directly in the app or by contacting support.</p>
    <h2>5. Contact</h2>
    <p>For privacy inquiries, contact <a href="mailto:tuyishimirehonore3@gmail.com">tuyishimirehonore3@gmail.com</a>.</p>
    <p><a href="/terms">View Terms of Service →</a></p>
  `));
});

export default legalRouter;
