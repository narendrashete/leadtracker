// Parses the text of one marriage-profile page into structured fields.
// Works with English pages and (partially) with the Marathi pages whose
// font encoding garbles Devanagari when extracted.

const DEV_DIGITS = '०१२३४५६७८९';
export const devToAscii = (s) =>
  s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));

// Repairs the common legacy-font garbling seen in these PDFs:
//  - the "ि" matra comes out as "ह" placed BEFORE the consonant
//  - the "क्ष" ligature comes out as a lone "ि"
//  - "र्य" stands for "य", "ां" for "ं"
const CONS = 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहळ';
export function fixMarathi(s) {
  if (!/[ऀ-ॿ]/.test(s)) return s;
  let t = s;
  t = t.replace(/(^|[^ऀ-ॿ])ि/g, '$1क्ष'); // stray matra at word start
  t = t.replace(new RegExp(`([ािीुूेैोौंँः])ि`, 'g'), '$1क्ष');
  t = t.replace(new RegExp(`([${CONS}])ि(?=[ािीुूेैोौ]|$|[^ऀ-ॿ])`, 'g'), '$1क्ष');
  // "ह" + consonant cluster -> cluster + ि  (only when ह is at a syllable start)
  const cluster = `[${CONS}](?:्[${CONS}])*`;
  t = t.replace(
    new RegExp(`(^|[^ऀ-ॿ]|[ािीुूेैोौंँः]|[${CONS}](?=ह))ह(${cluster})`, 'g'),
    (m, pre, cl) => `${pre}${cl}ि`
  );
  t = t.replace(/र्य/g, 'य').replace(/ां/g, 'ं').replace(/\s+ं/g, 'ं');
  return t;
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  जानेवारी: 1, फेब्रुवारी: 2, मार्च: 3, एप्रिल: 4, मे: 5, जून: 6, जुलै: 7, ऑगस्ट: 8, सप्टेंबर: 9, ऑक्टोबर: 10, नोव्हेंबर: 11, डिसेंबर: 12,
};

// Label aliases -> field key. Order matters (more specific first).
const LABELS = [
  ['maritalStatus', ['marital\\s*:?\\s*status', 'marital', 'वैवाहिक\\s*स्थिती']],
  ['dob', ['date\\s*of\\s*birth', 'birth\\s*date', 'd\\.?o\\.?b\\.?', 'जन्म\\s*तारीख', 'जन्मतारीख', 'जन्म\\s*दिनांक']],
  ['birthTime', ['time\\s*of\\s*birth', 'birth\\s*time', 'जन्म\\s*वेळ']],
  ['birthPlace', ['place\\s*of\\s*birth', 'birth\\s*place', 'जन्म\\s*स्थळ', 'जन्मस्थळ', 'जन्म\\s*ठिकाण']],
  ['rashi', ['rashi', 'rasi', 'raashi', 'राशी', 'रास']],
  ['manglik', ['manglik', 'mangal', 'मांगलिक', 'मंगळ']],
  ['nakshatra', ['nakshatra', 'नक्षत्र']],
  ['gan', ['\\bgan\\b', 'गण']],
  ['bloodGroup', ['blood\\s*group', 'रक्त\\s*गट']],
  ['height', ['height', 'उंची']],
  ['weight', ['weight', 'वजन']],
  ['complexion', ['complexion', 'वर्ण']],
  ['education', ['edu\\.', 'education(?:al)?(?:\\s*qualification)?', 'qualification', 'शिक्षण']],
  ['job', ['occupation', 'profession', 'job(?:\\s*(?:details|profile|location))?', 'business', 'service', 'नोकरी', 'व्यवसाय']],
  ['income', ['annual\\s*package', 'annual\\s*income', 'monthly\\s*income', 'income', 'salary', 'package', 'ctc', 'उत्पन्न', 'पगार']],
  ['currentLocation', ['place\\s*of\\s*current\\s*living(?:\\s*on\\s*the\\s*(?:groom|bride))?', 'current\\s*(?:living|location|residence|place)', 'work(?:ing)?\\s*(?:place|location)', 'job\\s*place', 'सध्याचे\\s*(?:राहण्याचे\\s*)?ठिकाण', 'सध्या\\s*राहणे', 'नोकरीचे\\s*ठिकाण']],
  ['familyResidence', ['family\\s*residence', 'residence', 'address', 'कौटुंबिक\\s*निवास', 'पत्ता']],
  ['motherTongue', ['mother\\s*tongue', 'मातृभाषा']],
  ['caste', ['cast(?:e)?', 'community', 'religion', 'जात']],
  ['food', ['veg\\s*/\\s*non\\s*veg', 'non[\\s-]*vegetarian', 'vegetarian\\s*/\\s*non[\\s-]*vegetarian', 'food\\s*preference', 'diet', 'शाकाहारी\\s*/\\s*मांसाहारी']],
  ['native', ['native\\s*place', 'native', 'मूळ\\s*\\(?गाव\\)?', 'मूळ\\s*गाव', 'गाव']],
  ['expectedIncome', ['expected\\s*(?:annual\\s*)?income']],
  ['expectedLocation', ['expected\\s*location', 'preferred\\s*location', 'अपेक्षित\\s*ठिकाण']],
  ['expectation', ['expectations?', 'partner\\s*preference', 'अपेक्षा']],
  ['hobby', ['hobb(?:y|ies)', 'छंद']],
  ['family', ['family\\s*details', 'father', 'mother', 'siblings?', 'brother', 'sister', 'कुटुंब']],
  ['otherCaste', ['इतर\\s*जातीबाबत', 'other\\s*caste']],
];

const LABEL_RES = LABELS.map(([key, alts]) => [
  key,
  new RegExp(`^[^\\p{L}\\p{N}]*(?:${alts.join('|')})\\s*(?:details|groom|bride|\\([^)]*\\))?\\s*(?:details|groom|bride)?\\s*[:：\\-–=]+\\s*`, 'iu'),
]);
// Some lines are "Income 600000 (+ ...)" with no colon
const LOOSE_RES = [
  ['education', /^[^\p{L}]*edu\.\s*/iu],
  ['income', /^\s*(?:annual\s*)?income\s+(?=[₹\d])/i],
  ['weight', /^\s*weight\s+(?=\d)/i],
  ['height', /^\s*height\s+(?=\d)/i],
];

// Marathi labels are matched on a consonant "skeleton" so that the
// font garbling (moved/missing matras, ह for ि, etc.) doesn't matter.
export const skel = (t) =>
  t.replace(/क्ष|ि/g, '').replace(/[\u093E-\u094D\u0901-\u0903\u0951-\u0954ह\s()0-9a-z.,]/gi, '');
const MR_LABELS = [
  ['otherCaste', ['इतर जाती']],
  ['expectedLocation', ['अपेक्षित ठिकाण', 'अपेक्षित स्थळ']],
  ['expectedIncome', ['अपेक्षित उत्पन्न']],
  ['currentLocation', ['सध्या', 'राहण्याचे ठिकाण', 'वास्तव्य']],
  ['maritalStatus', ['वैवाहिक']],
  ['dob', ['जन्मतारीख', 'जन्म दिनांक', 'जन्मदिनांक']],
  ['birthTime', ['जन्मवेळ', 'जन्म वेळ']],
  ['birthPlace', ['जन्मस्थान', 'जन्मस्थळ', 'जन्म ठिकाण']],
  ['rashi', ['राशी', 'रास']],
  ['manglik', ['मंगळ', 'मंगल', 'मांगलिक']],
  ['nakshatra', ['नक्षत्र']],
  ['bloodGroup', ['रक्त']],
  ['height', ['उंची']],
  ['weight', ['वजन']],
  ['education', ['शिक्षण']],
  ['job', ['नोकरी', 'व्यवसाय', 'नौकरी']],
  ['income', ['उत्पन्न', 'पगार', 'वेतन']],
  ['familyResidence', ['कौटुंबिक', 'निवास', 'पत्ता']],
  ['motherTongue', ['मातृभाषा']],
  ['caste', ['जात']],
  ['food', ['शाकाहारी', 'मांसाहारी']],
  ['native', ['मूळ', 'गाव']],
  ['expectation', ['अपेक्षा', 'अपेिा']],
  ['hobby', ['छंद']],
].map(([k, al]) => [k, al.map(skel).filter(Boolean)]);

function matchMarathi(line) {
  const m = line.match(/^([^:：=\-–]{1,40}?)\s*[:：=\-–]+\s*(.*)$/);
  if (!m || !/[\u0900-\u097F]/.test(m[1])) return null;
  const sk = skel(m[1]);
  if (!sk) return null;
  for (const [key, al] of MR_LABELS) if (al.some((a) => sk.includes(a))) return [key, m[2].trim()];
  return null;
}

function matchLabel(line) {
  const mr = matchMarathi(line);
  if (mr) return mr;
  for (const [key, re] of LABEL_RES) {
    const m = line.match(re);
    if (m) return [key, line.slice(m[0].length).trim()];
  }
  for (const [key, re] of LOOSE_RES) {
    const m = line.match(re);
    if (m) return [key, line.slice(m[0].length).trim()];
  }
  return null;
}

export function parseDob(raw, headerYear) {
  if (!raw) return headerYear ? { y: headerYear, m: 7, d: 1, approx: true } : null;
  const s = devToAscii(raw).replace(/(\d)(st|nd|rd|th)\b/gi, '$1').trim();
  let m = s.match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m.map(Number);
    if (y < 100) y += y > 40 ? 1900 : 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    return valid(y, mo, d);
  }
  m = s.match(/(\d{1,2})\s*[- ,.]*\s*([A-Za-zऀ-ॿ]+)\.?\s*[- ,.]*\s*(\d{4})/);
  if (m) {
    const mo = monthNum(m[2]);
    if (mo) return valid(+m[3], mo, +m[1]);
  }
  m = s.match(/([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mo = monthNum(m[1]);
    if (mo) return valid(+m[3], mo, +m[2]);
  }
  m = s.match(/\b(19[5-9]\d|20[01]\d)\b/);
  if (m) return { y: +m[1], m: 7, d: 1, approx: true };
  if (headerYear) return { y: headerYear, m: 7, d: 1, approx: true };
  return null;
}
function monthNum(word) {
  const w = word.toLowerCase();
  for (const k of Object.keys(MONTHS)) {
    if (/[a-z]/.test(k) ? w.startsWith(k) : w.includes(k)) return MONTHS[k];
  }
  return 0;
}
function valid(y, m, d) {
  if (y < 1940 || y > 2015 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

export function ageFrom(dob, now = new Date()) {
  if (!dob) return null;
  let a = now.getFullYear() - dob.y;
  if (now.getMonth() + 1 < dob.m || (now.getMonth() + 1 === dob.m && now.getDate() < dob.d)) a--;
  return a;
}

// Returns total inches
const MR_NUM = { एक: 1, दोन: 2, तीन: 3, चार: 4, पाच: 5, सहा: 6, सात: 7, आठ: 8, नऊ: 9, दहा: 10, अकरा: 11 };
export function parseHeight(raw) {
  if (!raw) return null;
  let t = raw;
  for (const [w, n] of Object.entries(MR_NUM)) t = t.replace(new RegExp(w, 'g'), String(n));
  t = t.replace(/(\d+)\s*फ[ुू]ट\s*(\d+)?/, (m, a, b) => `${a}'${b || 0}"`);
  const s = devToAscii(t).replace(/[’‘`´]/g, "'").replace(/[“”″]/g, '"').replace(/''/g, '"');
  let m = s.match(/(\d{3})\s*(?:cm|से)/i);
  if (m) return Math.round(+m[1] / 2.54);
  m = s.match(/([4-7])\s*(?:'|ft|feet|फूट|फुट)\s*[-.]?\s*(\d{1,2}(?:\.\d)?)?/i);
  if (m) return +m[1] * 12 + (m[2] ? Math.min(11, Math.floor(+m[2])) : 0);
  m = s.match(/\b([4-7])\s*[.,]\s*(\d{1,2})\b/);
  if (m) return +m[1] * 12 + +m[2];
  m = s.match(/\b([4-7])\b/);
  if (m) return +m[1] * 12;
  return null;
}
export const fmtHeight = (inch) => (inch ? `${Math.floor(inch / 12)}'${inch % 12}"` : '—');

export function parseWeight(raw) {
  if (!raw) return null;
  const m = devToAscii(raw).match(/(\d{2,3}(?:\.\d)?)/);
  if (!m) return null;
  const w = +m[1];
  return w >= 30 && w <= 150 ? Math.round(w) : null;
}

// Returns annual income in Lakhs (number) or null
const FX = [
  [/\$|usd|dollar/, 0.85], // 1 USD ≈ ₹85 -> 0.85 L per 1000
  [/euro|€|eur\b/, 0.95],
  [/aed|dirham/, 0.23],
  [/gbp|£|pound/, 1.1],
  [/aud|australian/, 0.55],
  [/cad|canadian/, 0.6],
];
export function parseIncome(raw) {
  if (!raw || /^(on request|tbd|will be|na\b|n\/a)/i.test(raw.trim())) return null;
  let t = raw;
  for (const [w, n] of Object.entries(MR_NUM)) t = t.replace(new RegExp(w, 'g'), String(n));
  let s = devToAscii(t).toLowerCase();
  // prefer an explicit rupee amount if a foreign amount is also quoted
  const rs = s.match(/(?:rs\.?|₹|inr)\s*([\d,.]+\s*(?:lakhs?|lacs?|laks?|lpa|l\b|लाख)?)/);
  let fx = null;
  for (const [re, rate] of FX) if (re.test(s)) fx = rate;
  if (fx && rs) { s = rs[1]; fx = null; }
  s = s.replace(/rs\.?|inr|₹|\/-/g, ' ').replace(/(\d),\s+(\d)/g, '$1,$2').replace(/(\d)\s+(\d{3})\b/g, '$1$2');
  const monthly = /month|महिना|मसनिा|महहना|मासिक|p\.?\s?m\b|\bpm\b|per\s*m|\/m\b/.test(s);
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|laks?|lkh|lpa|lac|l\b|लाख|k\b|thousand|हजार|cr|crore|कोटी)?/g;
  let m;
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(n) || n === 0) continue;
    const u = m[2] || '';
    if (fx) {
      const amt = /^k/.test(u) ? n * 1000 : n;
      if (amt < 100) continue;
      return round((amt / 1000) * fx * (monthly || amt < 20000 ? 12 : 1));
    }
    let v;
    if (/^(lakh|lac|lak|lkh|lpa|l$|लाख)/.test(u)) v = monthly ? n * 12 : n;
    else if (/^(cr|crore|कोटी)/.test(u)) v = n * 100;
    else if (/^(k|thousand|हजार)/.test(u)) v = (n * 1000) / 1e5 * (n < 400 ? 12 : 1);
    else if (n >= 100000) v = n >= 1e8 ? null : (n / 1e5) * (monthly ? 12 : 1);
    else if (n >= 1000) v = (n / 1e5) * 12; // bare small figures are monthly salaries
    else if (n < 200) {
      // "8 to 9 lakhs" – unit only on a later number
      v = monthly && !/lakh|lac|lak|lkh|lpa|लाख/.test(s) ? null : monthly ? n * 12 : n;
    }
    if (v != null) return round(v);
  }
  return null;
}
const round = (v) => Math.round(v * 10) / 10;

export const EDU_LEVELS = [
  ['Doctor / Medical', /\b(mbbs|md\b|ms\b(?!c)|bds|mds|bams|bhms|dr\.|doctor|physio|pharm\.?d)/i],
  ['CA / CS / Law', /(\bCA\b|\bC\.A\.(?!\w)|chartered|\bCS\b|company secretary|\bCMA\b|icwa|\bLL\.?B|\bLL\.?M|\blaw\b)/],
  ['PhD', /\b(ph\.?d|doctorate)/i],
  ['Engineering (B.E/B.Tech)', /\b(b\.?\s?e\.?\b|b\.?\s?tech|engineer|engg|be\s*\(|be-|be\s+(civil|mech|comp|it|elec|e&tc|extc|chem|production|instru|auto))/i],
  ['Masters (M.E/M.Tech)', /\b(m\.?\s?e\.?\b|m\.?\s?tech)/i],
  ['MBA / PGDM', /\b(mba|m\.?b\.?a|pgdm|pgdbm|mms|mmm|management)/i],
  ['MCA / MSc / MCom / MA', /\b(mca|m\.?\s?sc|m\.?\s?com|m\.?\s?a\b|master|post\s*grad|pg\b)/i],
  ['Graduate (B.Com/B.Sc/BA/BCA…)', /\b(b\.?\s?com|b\.?\s?sc|b\.?\s?a\.?\b|bca|bba|bms|baf|bbi|bfm|graduat|bachelor|b\.?\s?pharm|b\.?\s?arch|bsc|bcom|हशिण|पदवी)/i],
  ['Diploma / ITI', /\b(diploma|iti|polytechnic|d\.?\s?pharm)/i],
  ['HSC / SSC', /\b(hsc|ssc|12th|10th|h\.s\.c|s\.s\.c)/i],
];
export function eduTags(raw) {
  if (!raw) return [];
  return EDU_LEVELS.filter(([, re]) => re.test(raw)).map(([n]) => n);
}

// Canonical place names with spelling / Marathi variants, so filters group them together
const PLACES = {
  'Navi Mumbai': ['navi mumbai', 'नवी मुंबई', 'new mumbai'],
  Mumbai: ['mumbai', 'bombay', 'मुंबई', 'मंबई'],
  Thane: ['thane', 'ठाणे', 'thana'],
  Pune: ['pune', 'पुणे', 'पणे', 'poona'],
  Panvel: ['panvel', 'पनवेल'],
  Kankavli: ['kankavli', 'kankavali', 'kankawali', 'kankawli', 'कणकवली'],
  Ratnagiri: ['ratnagiri', 'रत्नागिरी', 'रत्नासगरी'],
  Dombivli: ['dombivli', 'dombivali', 'dombavli', 'dombiwali', 'डोंबिवली'],
  Badlapur: ['badlapur', 'बदलापूर'],
  Chiplun: ['chiplun', 'चिपळूण'],
  Vaibhavwadi: ['vaibhavwadi', 'vaibhav vadi', 'vaibhavvadi', 'वैभववाडी', 'वैभवाडी'],
  Rajapur: ['rajapur', 'राजापूर'],
  Kudal: ['kudal', 'कुडाळ'],
  Lanja: ['lanja', 'लांजा'],
  Virar: ['virar', 'विरार'],
  Vasai: ['vasai', 'वसई'],
  Wada: ['wada', 'वाडा'],
  Alibag: ['alibag', 'alibaug', 'अलिबाग', 'अहलबाग'],
  Pachal: ['pachal', 'पाचल'],
  Devgad: ['devgad', 'devgarh', 'देवगड'],
  Sindhudurg: ['sindhudurg', 'sindhudurgh', 'sindhudurga', 'सिंधुदुर्ग', 'सिंधुदुगव'],
  Kalyan: ['kalyan', 'कल्याण', 'कल्ाण'],
  Nashik: ['nashik', 'nasik', 'नाशिक', 'नासिक'],
  Bangalore: ['bangalore', 'bengaluru', 'बेंगलोर', 'बंगळूर'],
  Kolhapur: ['kolhapur', 'कोल्हापूर'],
  Guhagar: ['guhagar', 'गुहागर'],
  Sangameshwar: ['sangameshwar', 'sangmeshwar', 'संगमेश्वर'],
  Dubai: ['dubai', 'दुबई'],
  Kharepatan: ['kharepatan', 'kharepaten', 'खारेपाटण'],
  Raipatan: ['raipatan', 'raypatan', 'रायपाटण'],
  Belgaum: ['belgaum', 'begaum', 'belagavi', 'बेळगाव'],
  Malvan: ['malvan', 'मालवण'],
  Sawantwadi: ['sawantwadi', 'सावंतवाडी'],
  Mahad: ['mahad', 'महाड'],
  Sakharpa: ['sakharpa', 'साखरपा'],
  Devrukh: ['devrukh', 'देवरुख'],
  Palghar: ['palghar', 'पालघर'],
  Karak: ['karak', 'करक'],
  Khed: ['khed', 'खेड'],
  Dapoli: ['dapoli', 'दापोली'],
  Roha: ['roha', 'रोहा'],
  Shahapur: ['shahapur', 'शहापूर'],
  Ambernath: ['ambernath', 'अंबरनाथ'],
  Bhiwandi: ['bhiwandi', 'भिवंडी'],
  Khopoli: ['khopoli', 'खोपोली'],
  Uran: ['uran', 'उरण'],
  Goa: ['goa', 'गोवा'],
  Mangaon: ['mangaon', 'माणगाव'],
  Kandivali: ['kandivali', 'कांदिवली'],
  Chembur: ['chembur', 'चेंबूर'],
  Bhayandar: ['bhayandar', 'bhayander', 'भाईंदर'],
  'Mira Road': ['mira road', 'mira bhayandar', 'मीरा रोड', 'मीरारोड'],
  USA: ['usa', 'us', 'america'],
  UAE: ['uae', 'abu dhabi'],
  UK: ['uk', 'london', 'england'],
};
const PLACE_LOOKUP = new Map();
for (const [canon, vs] of Object.entries(PLACES)) for (const v of vs) PLACE_LOOKUP.set(v, canon);

export function canonPlace(s) {
  if (!s) return '';
  const lc = s.toLowerCase().trim();
  if (PLACE_LOOKUP.has(lc)) return PLACE_LOOKUP.get(lc);
  const toks = lc.split(/\s+/);
  for (let i = 0; i < toks.length - 1; i++) {
    const two = toks[i] + ' ' + toks[i + 1];
    if (PLACE_LOOKUP.has(two)) return PLACE_LOOKUP.get(two);
  }
  // first known token wins ("Lanja Ratnagiri" -> Lanja, "Thane East" -> Thane)
  for (const t of toks) if (PLACE_LOOKUP.has(t)) return PLACE_LOOKUP.get(t);
  return null;
}

// Normalises a place string to a short city/town name for grouping
export function normPlace(raw) {
  if (!raw) return '';
  let s = raw
    .replace(/^(location|own (flat|house) in|shifted to|currently (in|at)|at present|working in|staying (in|at)|based in|originally( from)?)\s*/i, '')
    .replace(/\b(caste|native|place|details|from|expectation|family|residence|re)\b.*$/i, '')
    .replace(/(कौटुंबिक|कौटंसबक|इतर जात).*$/, '')
    .replace(/\b(dist(rict)?|tal(uka)?|ta|dt|at|post|po|near|maharashtra|india|mh|city|west|east)\b\.?[-:]?/gi, ' ')
    .replace(/जिल्हा|जि\.?\s|ता\.|मु\.?\s*पो\.?|मुक्काम|पोस्ट/g, ' ')
    .split(/[,/(&\[]|\band\b|\s-\s|–/)[0]
    .replace(/[.\-:;"'\d_=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  const c = canonPlace(s);
  if (c) return c;
  s = s.split(' ').slice(0, 2).join(' ');
  if (/[a-z]/i.test(s)) s = s.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
  return s.slice(0, 24);
}

// Group visually-ordered text items into lines
export function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) {
      if (it.hasEOL && rows.length) rows[rows.length - 1].eol = true;
      continue;
    }
    const y = it.transform[5];
    const x = it.transform[4];
    const h = Math.abs(it.transform[3]) || it.height || 10;
    let row = rows.find((r) => Math.abs(r.y - y) < h * 0.45);
    if (!row) rows.push((row = { y, h, parts: [] }));
    row.parts.push({ x, str: it.str, w: it.width });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = '';
    let lastEnd = null;
    for (const p of r.parts) {
      if (lastEnd != null && p.x - lastEnd > 2 && !out.endsWith(' ') && !p.str.startsWith(' ')) out += ' ';
      out += p.str;
      lastEnd = p.x + (p.w || 0);
    }
    return out.replace(/\s+/g, ' ').trim();
  });
}

const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

export function parseProfile(lines) {
  const original = lines;
  lines = lines
    .flatMap((l) => l.split(/\s+(?=(?:place of current living|family residence|native place|mother tongue|expected location|hobby|hobbies)\s*[:\-])/i))
    .map((l) => fixMarathi(l))
    .filter((l) => l && !/^\d{10}$/.test(l.replace(/\s/g, '')));
  const p = { raw: {}, extra: [] };
  // Header: "97 Korgaonkar - Mumbai 14092026"
  const headIdx = lines.findIndex((l) => /^\s*\d{2}\s+\S/.test(devToAscii(l)) && /[-–]/.test(l));
  if (headIdx >= 0) {
    const h = devToAscii(lines[headIdx]);
    p.header = lines[headIdx];
    const hm = h.match(/^\s*(\d{2})\s+(.+?)\s*[-–]\s*(.+?)(?:\s*[-–]?\s*(\d{6,8}))?\s*$/);
    if (hm) {
      p.headerYear = 1900 + +hm[1] + (+hm[1] < 30 ? 100 : 0);
      p.surname = hm[2].replace(/[-–]+$/, '').trim();
      p.headerLocation = hm[3].replace(/[-–]+\s*$/, '').trim();
      if (hm[4]) {
        const d = hm[4];
        const yy = d.length === 8 ? d.slice(4) : '20' + d.slice(4);
        p.listedOn = `${yy}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
      }
    }
  }
  const idLine = lines.find((l) => /MVS|MV\s*Sewa/i.test(l));
  if (idLine) {
    p.code = idLine.replace(/365\s*Day[’'`]?s\s*/i, '').trim();
    const nm = idLine.match(/MVS\s*[-–:]?\s*(\d+)/i);
    if (nm) p.mvs = nm[1];
  }

  let cur = null;
  const start = Math.max(headIdx, lines.indexOf(idLine)) + 1;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const lm = matchLabel(line);
    if (lm) {
      const [key, val] = lm;
      if (p.raw[key] && key !== 'family') {
        cur = key + '_' + i;
        p.raw[cur] = val;
        p.extra.push(cur);
      } else {
        cur = key;
        p.raw[key] = p.raw[key] ? p.raw[key] + '; ' + val : val;
      }
    } else if (cur && i > start) {
      // continuation of previous field (wrapped line)
      p.raw[cur] = (p.raw[cur] + ' ' + line).trim();
    } else if (!p.nameLine) {
      p.nameLine = line;
    } else {
      p.extra.push(line);
      p.raw['note_' + i] = line;
    }
  }
  const r = p.raw;
  for (const k of Object.keys(r)) r[k] = r[k].replace(/\s+/g, ' ').replace(/^[:\-–\s]+/, '').trim();

  p.name = p.surname || p.nameLine || 'Profile';
  const all = original.join(' ');
  p.phones = [...new Set((all.match(PHONE_RE) || []).map((x) => x.replace(/\D/g, '').slice(-10)))];
  return derive(p);
}

// Computes the filterable values from raw fields (+ user edits)
export function derive(p) {
  const r = { ...p.raw, ...(p.edits || {}) };
  p.dob = parseDob(r.dob, p.headerYear);
  p.heightIn = parseHeight(r.height);
  p.weightKg = parseWeight(r.weight);
  p.incomeL = parseIncome(r.income);
  p.eduTags = eduTags(r.education);
  p.nativeNorm = normPlace(r.native || r.familyResidence);
  p.locationRaw = r.currentLocation || r.familyResidence || p.headerLocation || '';
  p.locationNorm = normPlace(r.currentLocation || p.headerLocation || r.familyResidence);
  p.fields = r;
  return p;
}

export const fmtIncome = (l) =>
  l == null ? '—' : l >= 100 ? `₹${(l / 100).toFixed(1)} Cr` : `₹${l % 1 ? l.toFixed(1) : l} L`;
