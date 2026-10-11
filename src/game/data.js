// Game content: the four colour-coded bins and every waste item, taken from the
// hospital's segregation posters (English + Tamil).

export const GAME_NAME = 'MediBin Hero';
export const TAGLINE = 'Right waste. Right bin. Every time.';
export const TAGLINE_TA = 'சரியான கழிவு • சரியான தொட்டி';

export const MAX_LIVES = 3;

// Bins are listed in the order they stand on screen (left → right).
export const BINS = [
  {
    id: 'yellow',
    key: '1',
    color: '#f5c518',
    deep: '#b98600',
    soft: '#fff3bf',
    ink: '#3b2b00',
    name: 'Yellow',
    nameTa: 'மஞ்சள்',
    label: 'Infectious Waste',
    labelTa: 'தொற்றுக் கழிவு',
    icon: 'biohazard',
    rule: 'Body parts, soiled cotton and dressings, masks, caps, POP casts and expired medicines go in the YELLOW bin.',
    guide: [
      ['Post-operative body parts, placenta', 'உடல் பாகங்கள்'],
      ['Plaster of Paris (POP)', 'மாவுக் கட்டு'],
      ['Cotton waste', 'கழிவுப் பஞ்சு'],
      ['Dressing materials', 'கட்டு கட்டும் துணியின் கழிவுகள்'],
      ['Beddings, body-fluid contaminated paper & cloth', 'இரத்தக் கறைப்பட்ட பொருட்கள்'],
      ['Face mask, cap', 'முக மூடி, தொப்பி'],
      ['Cytotoxic, expired & discarded medicines', 'மருத்துவ கழிவுகள்'],
      ['Pathological & lab waste', 'இரத்த ஆய்வகத்தின் கழிவுகள்'],
    ],
  },
  {
    id: 'red',
    key: '2',
    color: '#e5352b',
    deep: '#a3140f',
    soft: '#ffd6d2',
    ink: '#ffffff',
    name: 'Red',
    nameTa: 'சிவப்பு',
    label: 'Contaminated Plastic',
    labelTa: 'பிளாஸ்டிக் கழிவு',
    icon: 'biohazard',
    rule: 'Used plastic items — syringes without needles, gloves, IV bottles, blood tubes, strips and test cards — go in the RED bin.',
    guide: [
      ['Syringe without needles', 'சிரிஞ்சு, ஊசி இல்லாமல்'],
      ['Gloves, IV bottles', 'குளுகோஸ் பாட்டில்கள்'],
      ['All blood tubes', 'இரத்த பரிசோதனைக் கழிவுகள்'],
      ['ESR tubes', 'ESR குழாய்கள்'],
      ['VIDAS strip', 'VIDAS ஸ்ட்ரிப்'],
      ['Rapid cards', 'ரேபிட் கார்டுகள்'],
    ],
  },
  {
    id: 'blue',
    key: '3',
    color: '#1f7fe0',
    deep: '#0f4f9c',
    soft: '#cfe5ff',
    ink: '#ffffff',
    name: 'Blue',
    nameTa: 'நீலம்',
    label: 'Glass & Metal',
    labelTa: 'கண்ணாடி & உலோகம்',
    icon: 'biohazard',
    rule: 'Broken glass, ampoules, lab slides, nails, metal implants and scissors go in the BLUE bin.',
    guide: [
      ['Broken glass', 'உடைந்த கண்ணாடி'],
      ['Ampoules', 'கண்ணாடி குப்பிகள்'],
      ['Lab slides', 'கண்ணாடி தட்டைகள் (ஸ்லைட்ஸ்)'],
      ['Nails', 'ஆணிகள்'],
      ['Metallic body implants', 'உலோக உடல் உள்வைப்புகள்'],
      ['Scissors', 'கத்திரிக்கோல்'],
    ],
  },
  {
    id: 'green',
    key: '4',
    color: '#2faa4f',
    deep: '#1b7434',
    soft: '#d2f5dc',
    ink: '#ffffff',
    name: 'Green',
    nameTa: 'பச்சை',
    label: 'General Waste',
    labelTa: 'பொதுவான கழிவு',
    icon: 'leaf',
    rule: 'Everyday waste — food, kitchen waste, paper cups and stationery — goes in the GREEN bin.',
    guide: [
      ['General waste', 'பொதுவான குப்பை கழிவுகள்'],
      ['Food', 'உணவு'],
      ['Stationery', 'எழுது பொருட்கள்'],
      ['Paper cup', 'காகித கப்'],
      ['Kitchen waste', 'சமையலறை கழிவுப் பொருட்கள்'],
    ],
  },
];

export const BIN_INDEX = Object.fromEntries(BINS.map((b, i) => [b.id, i]));

// model: { glb } loads a file from /public/models, { make } builds it in code.
// rot is the display tilt in radians, size the longest side in metres.
export const ITEMS = [
  // ── Yellow ────────────────────────────────────────────────────────────────
  { id: 'cotton', bin: 'yellow', en: 'Blood-stained Cotton', ta: 'இரத்தம் படிந்த பஞ்சு', model: { make: 'cotton' } },
  { id: 'dressing', bin: 'yellow', en: 'Used Dressing / Bandage', ta: 'பயன்படுத்திய கட்டுத் துணி', model: { make: 'bandage' }, rot: [0.35, -0.5, 0] },
  { id: 'mask', bin: 'yellow', en: 'Used Face Mask', ta: 'பயன்படுத்திய முக மூடி', model: { make: 'mask' }, rot: [0.1, 0, 0] },
  { id: 'cap', bin: 'yellow', en: 'Disposable Cap', ta: 'தலை தொப்பி', model: { make: 'cap' }, rot: [0.35, 0, 0] },
  { id: 'pop', bin: 'yellow', en: 'Plaster Cast (POP)', ta: 'மாவுக் கட்டு', model: { make: 'cast' }, rot: [0.2, 0, -0.75] },
  { id: 'medicine', bin: 'yellow', en: 'Expired Medicines', ta: 'காலாவதியான மருந்துகள்', model: { make: 'medicine' }, rot: [0.85, 0, 0.1] },
  { id: 'bone', bin: 'yellow', en: 'Body Part (Bone)', ta: 'உடல் பாகம் (எலும்பு)', model: { glb: 'items/bone.glb' }, rot: [0, 0, 0.45] },
  { id: 'cloth', bin: 'yellow', en: 'Blood-stained Cloth', ta: 'இரத்தக் கறை படிந்த துணி', model: { make: 'cloth' }, rot: [-0.45, 0, 0] },
  { id: 'bedding', bin: 'yellow', en: 'Soiled Bedding', ta: 'கறை படிந்த படுக்கை விரிப்பு', model: { make: 'bedding' }, rot: [0.5, 0.4, 0] },

  // ── Red ───────────────────────────────────────────────────────────────────
  { id: 'syringe', bin: 'red', en: 'Syringe (without needle)', ta: 'ஊசி இல்லாத சிரிஞ்சு', model: { make: 'syringe' }, rot: [0, 0, -0.95] },
  { id: 'gloves', bin: 'red', en: 'Used Gloves', ta: 'பயன்படுத்திய கையுறை', model: { make: 'glove' }, rot: [0, 0, 0.25] },
  { id: 'iv-bottle', bin: 'red', en: 'IV / Glucose Bottle', ta: 'குளுகோஸ் பாட்டில்', model: { make: 'ivBottle' }, rot: [0, 0, 0.2] },
  { id: 'blood-tube', bin: 'red', en: 'Blood Collection Tubes', ta: 'இரத்தக் குழாய்கள்', model: { make: 'bloodTubes' } },
  { id: 'esr-tube', bin: 'red', en: 'ESR Tube', ta: 'ESR குழாய்', model: { make: 'esrTube' }, rot: [0, 0, -0.6], size: 0.7 },
  { id: 'vidas', bin: 'red', en: 'VIDAS Strip', ta: 'VIDAS ஸ்ட்ரிப்', model: { make: 'vidasStrip' }, rot: [0.55, 0, 0.18], size: 0.7 },
  { id: 'rapid-card', bin: 'red', en: 'Rapid Test Card', ta: 'ரேபிட் டெஸ்ட் கார்டு', model: { make: 'rapidCard' }, rot: [1.0, 0, 0.22], size: 0.66 },

  // ── Blue ──────────────────────────────────────────────────────────────────
  { id: 'broken-glass', bin: 'blue', en: 'Broken Glass', ta: 'உடைந்த கண்ணாடி', model: { make: 'brokenGlass' }, rot: [0.25, 0, 0] },
  { id: 'ampoule', bin: 'blue', en: 'Glass Ampoule', ta: 'கண்ணாடி ஆம்பூல்', model: { make: 'ampoule' }, rot: [0, 0, 0.4] },
  { id: 'lab-slide', bin: 'blue', en: 'Lab Slides', ta: 'கண்ணாடி தட்டைகள் (ஸ்லைடு)', model: { make: 'labSlides' }, rot: [0.8, 0, 0.1], size: 0.68 },
  { id: 'glass-bottle', bin: 'blue', en: 'Glass Bottle / Vial', ta: 'கண்ணாடி குப்பி', model: { glb: 'items/glass-bottle.glb' }, rot: [0, 0, 0.25] },
  { id: 'nails', bin: 'blue', en: 'Metal Nails', ta: 'ஆணிகள்', model: { make: 'nails' } },
  { id: 'implant', bin: 'blue', en: 'Metallic Body Implant', ta: 'உலோக உடல் உள்வைப்பு', model: { make: 'implant' }, rot: [-0.35, 0, 0.3], size: 0.7 },
  { id: 'scissors', bin: 'blue', en: 'Scissors', ta: 'கத்திரிக்கோல்', model: { make: 'scissors' }, rot: [0, 0, 0.5], size: 0.7 },

  // ── Green ─────────────────────────────────────────────────────────────────
  { id: 'banana', bin: 'green', en: 'Banana (Food Waste)', ta: 'வாழைப்பழம் (உணவுக் கழிவு)', model: { glb: 'items/banana.glb' }, rot: [0.3, 0, 0.3] },
  { id: 'apple', bin: 'green', en: 'Half-eaten Apple', ta: 'கடித்த ஆப்பிள்', model: { glb: 'items/apple-half.glb' }, rot: [0, 1.2, 0], size: 0.5 },
  { id: 'sandwich', bin: 'green', en: 'Leftover Food', ta: 'மீதமான உணவு', model: { glb: 'items/sandwich.glb' }, rot: [0.4, 0, 0] },
  { id: 'fish-bones', bin: 'green', en: 'Fish Bones (Kitchen Waste)', ta: 'மீன் முள் (சமையலறை கழிவு)', model: { glb: 'items/fish-bones.glb' }, rot: [0.9, 0, 0.3] },
  { id: 'egg-shell', bin: 'green', en: 'Egg Shell', ta: 'முட்டை ஓடு', model: { glb: 'items/egg-half.glb' }, rot: [0.4, 0, 0], size: 0.5 },
  { id: 'vegetable', bin: 'green', en: 'Vegetable Waste', ta: 'காய்கறி கழிவு', model: { glb: 'items/cabbage.glb' }, rot: [0.3, 0, 0], size: 0.55 },
  { id: 'paper-cup', bin: 'green', en: 'Paper Cup', ta: 'காகித கப்', model: { glb: 'items/cup.glb' }, rot: [0.35, 0, 0.2], size: 0.5 },
  { id: 'pencil', bin: 'green', en: 'Pencil (Stationery)', ta: 'பென்சில் (எழுது பொருள்)', model: { glb: 'items/pencil.glb' }, rot: [0, 0, 0.6], size: 0.7 },
  { id: 'paper', bin: 'green', en: 'Waste Paper', ta: 'கழிவு காகிதம்', model: { make: 'paperBall' }, size: 0.5 },
  { id: 'notebook', bin: 'green', en: 'Old Notebook', ta: 'பழைய நோட்டுப் புத்தகம்', model: { glb: 'items/book.glb' }, rot: [0.2, 0.6, 0.15] },
  { id: 'food-box', bin: 'green', en: 'Empty Food Box', ta: 'காலி உணவுப் பெட்டி', model: { glb: 'items/pizza-box.glb' }, rot: [0.3, 0.5, 0] },
  { id: 'carton', bin: 'green', en: 'Juice Carton', ta: 'ஜூஸ் அட்டைப் பெட்டி', model: { glb: 'items/carton.glb' }, rot: [0, 0.5, 0.15] },
  { id: 'paper-bag', bin: 'green', en: 'Paper Bag', ta: 'காகிதப் பை', model: { glb: 'items/bag.glb' }, rot: [0, 0.5, 0.1] },
];

export const ROLES = [
  { id: 'staff', label: 'Hospital Staff', labelTa: 'மருத்துவமனை பணியாளர்' },
  { id: 'student', label: 'Student', labelTa: 'மாணவர்' },
  { id: 'public', label: 'General Public', labelTa: 'பொதுமக்கள்' },
];

export const RANKS = [
  { min: 0, title: 'Trainee', titleTa: 'பயிற்சியாளர்', stars: 0 },
  { min: 60, title: 'Safety Starter', titleTa: 'பாதுகாப்பு தொடக்கம்', stars: 1 },
  { min: 180, title: 'Waste Warrior', titleTa: 'கழிவு வீரர்', stars: 2 },
  { min: 350, title: 'Bin Master', titleTa: 'தொட்டி நிபுணர்', stars: 3 },
  { min: 600, title: 'MediBin Hero', titleTa: 'மெடிபின் ஹீரோ', stars: 3 },
];

export function rankFor(score) {
  let rank = RANKS[0];
  for (const r of RANKS) if (score >= r.min) rank = r;
  return rank;
}

// Difficulty: every 5 correct answers is a new level with a shorter timer.
export const CORRECT_PER_LEVEL = 5;
export function levelFor(correct) {
  return 1 + Math.floor(correct / CORRECT_PER_LEVEL);
}
export function timeForLevel(level) {
  return Math.max(4.5, 12 - (level - 1) * 1.25);
}
export function pointsFor(timeFrac, streak) {
  return 10 + Math.round(5 * Math.max(0, timeFrac)) + Math.min(streak, 5) * 2;
}
