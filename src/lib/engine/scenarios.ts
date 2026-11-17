import type { Scenario } from "./types";

// Each scenario is a finite-state model of a product journey. Agents can only
// take the actions listed for the state they are in, and every journey ends in
// a terminal outcome or at the step limit.

const loan: Scenario = {
  id: "personal-loan",
  name: "Personal Loan Application",
  product:
    "Sahay Finance (a fictional Indian digital lender). Mobile web flow for an unsecured personal loan of up to Rs 5,00,000.",
  goal:
    "You need roughly Rs 2,00,000 within the next two weeks and a friend mentioned this lender. You have just opened their personal loan page on your phone.",
  entry: "entry",
  funnel: ["entry", "eligibility", "options", "documents", "review", "submitted"],
  factors: [
    { id: "interest_rate", label: "Interest rate" },
    { id: "emi", label: "EMI" },
    { id: "fees", label: "Fees" },
    { id: "trust", label: "Trust" },
    { id: "effort", label: "Effort" },
    { id: "speed", label: "Speed" },
    { id: "other", label: "Other" },
  ],
  terminals: {
    submitted: { id: "submitted", label: "Application submitted", short: "Submitted", outcome: "completed" },
    abandoned: { id: "abandoned", label: "Left the journey", short: "Left", outcome: "abandoned" },
  },
  states: {
    entry: {
      id: "entry",
      label: "Landing page",
      short: "Entry",
      screen:
        "Headline: 'Personal loans up to Rs 5,00,000. Money in your account in 10 minutes.' Sub-line: 'Rates from 10.99% p.a.*' with a small asterisk. A large 'Check eligibility' button. Below it: a strip of partner bank logos, '4.3 stars, 2 lakh+ customers', and a footer link 'Rates, fees and terms'. No lender registration number is visible without scrolling.",
      friction: 0.08,
      frictionFactor: "trust",
      concern: "the 'from 10.99%*' headline rate with an asterisk and no visible lender registration",
      actions: [
        { id: "check_eligibility", label: "Check eligibility", to: "eligibility", kind: "progress", factor: "speed" },
        { id: "read_rates_and_fees", label: "Read rates, fees and terms", to: "fees", kind: "explore", factor: "fees" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    eligibility: {
      id: "eligibility",
      label: "Eligibility check",
      short: "Eligibility",
      screen:
        "Form asking for PAN number, date of birth, employment type, employer name and monthly take-home income. Small grey text: 'This is a soft check and will not affect your credit score.' A pre-ticked checkbox: 'I agree to receive offers by call, SMS and WhatsApp from Sahay Finance and its partners.' A link: 'How we use your data'. Button: 'See my offers'.",
      friction: 0.3,
      frictionFactor: "trust",
      concern: "being asked for PAN and income, with a pre-ticked marketing consent, before seeing any offer",
      actions: [
        { id: "submit_details", label: "Enter details and see offers", to: "options", kind: "progress", factor: "speed" },
        { id: "read_data_use", label: "Read how my data is used", to: "data_privacy", kind: "reassure", factor: "trust" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    data_privacy: {
      id: "data_privacy",
      label: "Data use page",
      short: "Data use",
      screen:
        "A long page of text. Key points: Sahay Finance is a lending service provider for an RBI-registered NBFC partner; the soft check uses a credit bureau; data may be shared with 'group companies and marketing partners'; you can withdraw marketing consent by emailing support. A 'Back to eligibility' button.",
      friction: 0.22,
      frictionFactor: "trust",
      concern: "data being shared with 'group companies and marketing partners'",
      actions: [
        { id: "continue_with_details", label: "Go back, enter details and see offers", to: "options", kind: "progress", factor: "trust" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    fees: {
      id: "fees",
      label: "Rates and fees page",
      short: "Fees",
      screen:
        "A table. Interest: 10.99% to 29.99% p.a. depending on profile. Processing fee: up to 3% of loan amount plus GST, deducted from the disbursed amount. Late payment: Rs 500 per missed EMI plus 2% per month. Prepayment charge: 4% of outstanding principal within the first 12 months. Optional loan protection insurance. A 'Check eligibility' button.",
      friction: 0.25,
      frictionFactor: "fees",
      concern: "the wide 10.99% to 29.99% rate range, a 3% processing fee and a 4% prepayment charge",
      actions: [
        { id: "check_eligibility", label: "Check eligibility", to: "eligibility", kind: "progress", factor: "speed" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    options: {
      id: "options",
      label: "Loan offers",
      short: "Offers",
      screen:
        "'You are pre-approved!' Three offer cards for Rs 2,00,000. A: 24 months, 16.5% p.a., EMI Rs 9,840. B: 36 months, 17.5% p.a., EMI Rs 7,180 (tagged 'Most popular'). C: 48 months, 18.5% p.a., EMI Rs 5,930 (tagged 'Lowest EMI'). The rate shown is higher than the 10.99% on the landing page. Small text: 'Processing fee applies'. A slider to change the amount, a 'Compare offers' link and a countdown: 'Offer valid for 14:59'.",
      friction: 0.2,
      frictionFactor: "interest_rate",
      concern: "offered rates of 16.5% to 18.5%, well above the advertised 10.99%, with a countdown timer",
      actions: [
        { id: "select_offer", label: "Select an offer and continue", to: "documents", kind: "progress", factor: "emi" },
        { id: "compare_offers", label: "Compare offers side by side", to: "compare", kind: "explore", factor: "interest_rate" },
        { id: "adjust_amount", label: "Change the loan amount or tenure", to: "options", kind: "adjust", factor: "emi" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    compare: {
      id: "compare",
      label: "Compare offers",
      short: "Compare",
      screen:
        "Side-by-side table of the three offers. Total interest paid: A Rs 36,160; B Rs 58,480; C Rs 84,640. Processing fee: Rs 5,900 incl. GST on each, deducted upfront, so Rs 1,94,100 reaches your account. Prepayment charge 4% in the first year. APR including fees: A 19.4%, B 19.6%, C 20.1%. Button under each: 'Choose this offer'.",
      friction: 0.24,
      frictionFactor: "fees",
      concern: "the total interest, the Rs 5,900 fee deducted upfront and an APR close to 20%",
      actions: [
        { id: "select_offer", label: "Choose an offer and continue", to: "documents", kind: "progress", factor: "emi" },
        { id: "back_to_offers", label: "Go back to the offers", to: "options", kind: "adjust", factor: "emi" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    documents: {
      id: "documents",
      label: "KYC and documents",
      short: "KYC",
      screen:
        "Three required steps. 1) Aadhaar verification by OTP. 2) Bank statement: 'Connect your bank through Account Aggregator (recommended, instant)' or 'Upload 6 months of PDF statements (review takes 24 to 48 hours)'. 3) Live selfie with camera access. Also asks permission to read SMS 'to verify income faster'. A link: 'Why do you need this?'. Progress bar shows step 3 of 5.",
      friction: 0.45,
      frictionFactor: "effort",
      concern: "Aadhaar OTP, bank statement access, a live selfie and SMS-reading permission all on one screen",
      actions: [
        { id: "complete_kyc", label: "Complete KYC and share documents", to: "review", kind: "progress", factor: "effort" },
        { id: "read_why_needed", label: "Read why this is needed", to: "kyc_help", kind: "reassure", factor: "trust" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    kyc_help: {
      id: "kyc_help",
      label: "KYC help page",
      short: "KYC help",
      screen:
        "Explains that KYC is required by RBI rules, Account Aggregator shares statements with consent and can be revoked, the selfie is matched to Aadhaar, and SMS access is optional and can be skipped by uploading statements. Shows a padlock icon and '256-bit encryption'. A 'Back to KYC' button.",
      friction: 0.15,
      frictionFactor: "trust",
      concern: "how much personal data the KYC step collects",
      actions: [
        { id: "complete_kyc", label: "Go back and complete KYC", to: "review", kind: "progress", factor: "trust" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
    review: {
      id: "review",
      label: "Review and e-sign",
      short: "Review",
      screen:
        "Summary: loan amount Rs 2,00,000; EMI and tenure as chosen; processing fee Rs 5,900 deducted; 'Loan Protect insurance Rs 2,499' is pre-selected and added to the loan; amount you receive Rs 1,91,601. E-mandate (auto-debit) set up on your salary account on the 5th of each month. A 14-page agreement link. Checkbox 'I have read and agree'. Button: 'E-sign and submit'.",
      friction: 0.38,
      frictionFactor: "fees",
      concern: "a pre-selected Rs 2,499 insurance add-on, the auto-debit mandate and a 14-page agreement",
      actions: [
        { id: "submit_application", label: "E-sign and submit the application", to: "submitted", kind: "progress", factor: "speed" },
        { id: "remove_insurance", label: "Remove the insurance add-on", to: "review", kind: "adjust", factor: "fees" },
        { id: "change_offer", label: "Go back and change the offer", to: "options", kind: "adjust", factor: "emi" },
        { id: "leave", label: "Leave the site", to: "abandoned", kind: "leave" },
      ],
    },
  },
};

const smartwatch: Scenario = {
  id: "smartwatch-checkout",
  name: "TechFlow Pro Smartwatch Checkout",
  product: "TechFlow Pro, a fictional smartwatch sold on the brand's own online store.",
  goal:
    "You have been thinking about getting a smartwatch and clicked an ad for the TechFlow Pro. You are now on its product page.",
  entry: "product",
  funnel: ["product", "pricing", "cart", "checkout", "purchased"],
  factors: [
    { id: "price", label: "Price" },
    { id: "features", label: "Features" },
    { id: "reviews", label: "Reviews" },
    { id: "trust", label: "Trust" },
    { id: "delivery", label: "Delivery" },
    { id: "other", label: "Other" },
  ],
  terminals: {
    purchased: { id: "purchased", label: "Purchase completed", short: "Purchased", outcome: "completed" },
    abandoned: { id: "abandoned", label: "Left the store", short: "Left", outcome: "abandoned" },
  },
  states: {
    product: {
      id: "product",
      label: "Product page",
      short: "Product",
      screen:
        "Hero image of the TechFlow Pro. Tagline: 'Health, fitness and 10-day battery.' Price is not shown above the fold; a 'See price and offers' button is. Rating: 4.4 stars from 1,280 reviews. Tabs: Features, Reviews. Button: 'Add to cart'.",
      friction: 0.08,
      frictionFactor: "price",
      concern: "the price not being shown up front",
      actions: [
        { id: "explore_features", label: "Explore the features", to: "features", kind: "explore", factor: "features" },
        { id: "read_reviews", label: "Read the reviews", to: "reviews", kind: "explore", factor: "reviews" },
        { id: "check_price", label: "Check the price and offers", to: "pricing", kind: "progress", factor: "price" },
        { id: "abandon", label: "Leave the store", to: "abandoned", kind: "leave" },
      ],
    },
    features: {
      id: "features",
      label: "Features",
      short: "Features",
      screen:
        "AMOLED display, heart-rate and SpO2 tracking, GPS, 10-day battery 'in typical use', 5 ATM water resistance, works with Android and iOS. Small print: ECG and blood-pressure features 'coming in a future update'. Some features need the Rs 199 per month TechFlow+ subscription.",
      friction: 0.18,
      frictionFactor: "features",
      concern: "key health features 'coming in a future update' and others behind a Rs 199 monthly subscription",
      actions: [
        { id: "read_reviews", label: "Read the reviews", to: "reviews", kind: "explore", factor: "reviews" },
        { id: "check_price", label: "Check the price and offers", to: "pricing", kind: "progress", factor: "price" },
        { id: "compare_alternatives", label: "Compare with other watches", to: "compare", kind: "explore", factor: "features" },
        { id: "abandon", label: "Leave the store", to: "abandoned", kind: "leave" },
      ],
    },
    reviews: {
      id: "reviews",
      label: "Reviews",
      short: "Reviews",
      screen:
        "4.4 stars overall. Top positive: 'Battery really lasts a week.' Top critical (3 stars): 'Strap broke in two months, support took 3 weeks to reply.' Several 5-star reviews are short and posted on the same day. 68% of reviews are 'verified purchase'.",
      friction: 0.2,
      frictionFactor: "reviews",
      concern: "a slow-support complaint and a cluster of same-day 5-star reviews",
      actions: [
        { id: "check_price", label: "Check the price and offers", to: "pricing", kind: "progress", factor: "price" },
        { id: "explore_features", label: "Explore the features", to: "features", kind: "explore", factor: "features" },
        { id: "abandon", label: "Leave the store", to: "abandoned", kind: "leave" },
      ],
    },
    pricing: {
      id: "pricing",
      label: "Price and offers",
      short: "Price",
      screen:
        "Price Rs 24,999 (MRP Rs 34,999, '28% off, ends tonight'). 10% instant discount on one bank's credit cards. No-cost EMI from Rs 4,167 for 6 months. Delivery in 5 to 7 days. 7-day replacement only, no returns. Button: 'Add to cart'.",
      friction: 0.3,
      frictionFactor: "price",
      concern: "a Rs 24,999 price with an 'ends tonight' timer and a replacement-only, no-returns policy",
      actions: [
        { id: "add_to_cart", label: "Add to cart", to: "cart", kind: "progress", factor: "price" },
        { id: "compare_alternatives", label: "Compare with other watches", to: "compare", kind: "explore", factor: "price" },
        { id: "read_reviews", label: "Read the reviews", to: "reviews", kind: "explore", factor: "reviews" },
        { id: "abandon", label: "Leave the store", to: "abandoned", kind: "leave" },
      ],
    },
    compare: {
      id: "compare",
      label: "Comparison",
      short: "Compare",
      screen:
        "Table against two well-known rivals. TechFlow Pro wins on battery and price; rivals win on app ecosystem, ECG and service-centre network. Rival prices: Rs 29,900 and Rs 32,999.",
      friction: 0.2,
      frictionFactor: "features",
      concern: "rivals offering better apps, ECG and a wider service network for a little more money",
      actions: [
        { id: "add_to_cart", label: "Add the TechFlow Pro to cart", to: "cart", kind: "progress", factor: "price" },
        { id: "back_to_product", label: "Go back to the product page", to: "product", kind: "adjust", factor: "features" },
        { id: "abandon", label: "Leave the store", to: "abandoned", kind: "leave" },
      ],
    },
    cart: {
      id: "cart",
      label: "Cart",
      short: "Cart",
      screen:
        "TechFlow Pro x1, Rs 24,999. A '2-year extended warranty Rs 1,999' is pre-added to the cart. Shipping Rs 99. Total Rs 27,097. Buttons: 'Proceed to checkout', 'Remove warranty', 'Continue shopping'.",
      friction: 0.26,
      frictionFactor: "price",
      concern: "a pre-added Rs 1,999 warranty and a shipping fee that push the total to Rs 27,097",
      actions: [
        { id: "proceed_to_checkout", label: "Proceed to checkout", to: "checkout", kind: "progress", factor: "price" },
        { id: "remove_warranty", label: "Remove the warranty", to: "cart", kind: "adjust", factor: "price" },
        { id: "abandon", label: "Leave the store", to: "abandoned", kind: "leave" },
      ],
    },
    checkout: {
      id: "checkout",
      label: "Checkout",
      short: "Checkout",
      screen:
        "Requires creating an account with phone OTP before paying. Address form. Payment: cards, UPI, EMI. Cash on delivery is not available. Delivery estimate now shows 7 to 9 days. Button: 'Pay now'.",
      friction: 0.34,
      frictionFactor: "delivery",
      concern: "forced account creation, no cash on delivery and a delivery estimate that grew to 7 to 9 days",
      actions: [
        { id: "complete_purchase", label: "Pay and complete the purchase", to: "purchased", kind: "progress", factor: "delivery" },
        { id: "abandon", label: "Leave the store", to: "abandoned", kind: "leave" },
      ],
    },
  },
};

export const SCENARIOS: Scenario[] = [loan, smartwatch];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

export function stateLabel(scenario: Scenario, id: string): string {
  return scenario.states[id]?.label ?? scenario.terminals[id]?.label ?? id;
}

export function factorLabel(scenario: Scenario, id: string): string {
  return scenario.factors.find((f) => f.id === id)?.label ?? "Other";
}

/** Checks that every transition points at a real state or terminal. */
export function validateScenario(s: Scenario): string[] {
  const problems: string[] = [];
  const known = new Set([...Object.keys(s.states), ...Object.keys(s.terminals)]);
  if (!s.states[s.entry]) problems.push(`entry state "${s.entry}" is missing`);
  for (const st of Object.values(s.states)) {
    if (st.actions.length === 0) problems.push(`state "${st.id}" has no actions`);
    for (const a of st.actions) {
      if (!known.has(a.to)) problems.push(`action "${a.id}" in "${st.id}" points at unknown "${a.to}"`);
      if (a.factor && !s.factors.some((f) => f.id === a.factor)) problems.push(`action "${a.id}" uses unknown factor "${a.factor}"`);
    }
  }
  for (const id of s.funnel) if (!known.has(id)) problems.push(`funnel entry "${id}" is unknown`);
  return problems;
}
