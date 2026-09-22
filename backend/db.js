const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'leads.db');

let _db = null;

// Initial rosters for the shared availability calendar. Seeded once; after that
// the groups are edited in the app, so changing this has no effect on a live DB.
const CALENDAR_SEED_GROUPS = [
  {
    group_key: 'funda', name_en: 'Funda', name_mr: 'फंडा', sort_order: 1,
    members: [
      { id: 'narendra', en: 'Narendra', mr: 'नरेंद्र', color: '#E4572E' },
      { id: 'vivek',    en: 'Vivek',    mr: 'विवेक',   color: '#2E86AB' },
      { id: 'prasad',   en: 'Prasad',   mr: 'प्रसाद',  color: '#5E8C3F' },
      { id: 'bhushan',  en: 'Bhushan',  mr: 'भूषण',    color: '#8E5BD8' },
      { id: 'mishal',   en: 'Mishal',   mr: 'मिशाल',   color: '#D9A404' },
      { id: 'pant',     en: 'Pant',     mr: 'पंत',     color: '#C42A67' }
    ]
  },
  {
    group_key: 'thigdam', name_en: 'Thigdam', name_mr: 'ठिगडम', sort_order: 2,
    members: [
      { id: 'narendra',  en: 'Narendra',  mr: 'नरेंद्र',   color: '#E4572E' },
      { id: 'siddharth', en: 'Siddharth', mr: 'सिद्धार्थ', color: '#2E86AB' },
      { id: 'riyaz',     en: 'Riyaz',     mr: 'रियाझ',     color: '#5E8C3F' }
    ]
  }
];

// Initial list for the Shete Parivar Navratri history page (यजमान + वर्ष + गाव).
// Seeded once into shete_history; after that the list is edited from the admin
// page directly. Transcribed from the Shete Kutumbiya register PDF (sr 1-31);
// sr 31 had no year/village recorded in the source.
const SHETE_HISTORY_SEED = [
  { name: 'रामचंद्र शेटे', year: 1991, village: 'कुळगाव' },
  { name: 'चंद्रकांत शेटे', year: 1992, village: 'कुळगाव' },
  { name: 'साईनाथ शेटे', year: 1993, village: 'कल्याण' },
  { name: 'पदमाकर शेटे', year: 1994, village: 'कल्याण' },
  { name: 'शांताराम शेटे', year: 1995, village: 'कल्याण' },
  { name: 'दत्तात्रय शेटे', year: 1996, village: 'मुरबाड' },
  { name: 'दिनेश शेटे', year: 1997, village: 'खोपोली' },
  { name: 'विनोद शेटे', year: 1998, village: 'कल्याण' },
  { name: 'सुधाकर शेटे', year: 1999, village: 'अंबरनाथ' },
  { name: 'ऋषिकांत शेटे', year: 2000, village: 'कल्याण' },
  { name: 'रामचंद्र शेटे', year: 2001, village: 'कुळगाव' },
  { name: 'चंद्रकांत शेटे', year: 2002, village: 'मुरबाड' },
  { name: 'दत्तात्रय शेटे', year: 2003, village: 'मुरबाड' },
  { name: 'दत्तात्रय द्वा. शेटे', year: 2004, village: 'मुरबाड' },
  { name: 'प्रमोद शेटे', year: 2005, village: 'कल्याण' },
  { name: 'विश्वनाथ शेटे', year: 2006, village: 'भिवंडी' },
  { name: 'कृष्णा शेटे', year: 2007, village: 'भिवंडी' },
  { name: 'सुभाष शेटे', year: 2008, village: 'भिवंडी' },
  { name: 'नंदकुमार शेटे', year: 2009, village: 'भिवंडी' },
  { name: 'अरुण शेटे', year: 2010, village: 'कल्याण' },
  { name: 'दत्तात्रय शेटे', year: 2011, village: 'कल्याण' },
  { name: 'दिगंबर शेटे', year: 2012, village: 'कल्याण' },
  { name: 'नंदकुमार वासुदेव शेटे', year: 2013, village: 'भिवंडी' },
  { name: 'रवींद्र भीमनाथ शेटे', year: 2014, village: 'मुरबाड' },
  { name: 'दत्तात्रय द्वा. शेटे', year: 2015, village: 'मुरबाड' },
  { name: 'अनिरुद्ध सूर्यकांत शेटे', year: 2016, village: 'बदलापूर' },
  { name: 'रामचंद्र प. शेटे', year: 2017, village: 'बदलापूर' },
  { name: 'चंद्रकांत प. शेटे', year: 2018, village: 'बदलापूर' },
  { name: 'अरुण दत्तात्रय शेटे', year: 2019, village: 'देवरूग' },
  { name: 'गुरुनाथ द्वा. शेटे', year: 2020, village: 'बापगाव' },
  { name: 'विलास मोरेश्वर शेटे', year: null, village: null },
];

// Initial roster for the Shete Parivar Navratri member directory. Seeded once
// into shete_members; after that the list is edited through the site's own
// add-member request + admin-approval flow, so changing this has no effect on
// a live DB. Carried over from the original members-data.js the site shipped
// with (66 members, transcribed from the 2025 collection register).
const SHETE_MEMBERS_SEED = [
{name:"श्री. रामचंद्र पंढरीनाथ शेटे",nameEn:"Ramchandra Pandharinath Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"9822896296"},
{name:"श्री. नरेंद्र रामचंद्र शेटे",nameEn:"Narendra Ramchandra Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"9820101355"},
{name:"श्री. नितीन रामचंद्र शेटे",nameEn:"Nitin Ramchandra Shete",village:"भिवंडी",villageEn:"Bhiwandi",mobile:"9822778545"},
{name:"श्री. सुनील पंढरीनाथ शेटे",nameEn:"Sunil Pandharinath Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9930253573"},
{name:"श्री. प्रसाद नंदकुमार शेटे",nameEn:"Prasad Nandkumar Shete",village:"अंबाडी",villageEn:"Ambadi",mobile:"8605657111"},
{name:"श्री. मनोज सुधाकर शेटे",nameEn:"Manoj Sudhakar Shete",village:"कर्जत",villageEn:"Karjat",mobile:"9022168494"},
{name:"श्री. विजय अनंत शेटे",nameEn:"Vijay Anant Shete",village:"उल्हासनगर",villageEn:"Ulhasnagar",mobile:"9041168227"},
{name:"श्री. विलास मोरेश्वर शेटे",nameEn:"Vilas Moreshwar Shete",village:"देवरंग",villageEn:"Devrang",mobile:"9529053063"},
{name:"श्री. नवीन रामचंद्र शेटे",nameEn:"Navin Ramchandra Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"9730086818"},
{name:"श्री. विनोद गजानन शेटे",nameEn:"Vinod Gajanan Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9969029805"},
{name:"श्री. अल्पेश अरुण शेटे",nameEn:"Alpesh Arun Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"8097514868"},
{name:"श्री. सुनील दत्तात्रय शेटे",nameEn:"Sunil Dattatray Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9172616166"},
{name:"श्री. सर्जेराव हरकानाथ शेटे",nameEn:"Sarjerao Harkanath Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9987236358"},
{name:"श्री. योगेश बाबू शेटे",nameEn:"Yogesh Babu Shete",village:"अंबाडी",villageEn:"Ambadi",mobile:"9673727050"},
{name:"श्री. त्र्यंबकांत रामचंद्र शेटे",nameEn:"Tryambakant Ramchandra Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9220152808"},
{name:"श्री. मोहन विश्वनाथ शेटे",nameEn:"Mohan Vishwanath Shete",village:"भिवंडी",villageEn:"Bhiwandi",mobile:"9028265888"},
{name:"श्री. चंद्रकांत पंढरीनाथ शेटे",nameEn:"Chandrakant Pandharinath Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"7620764784"},
{name:"श्री. समीर चंद्रकांत शेटे",nameEn:"Sameer Chandrakant Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"9922495797"},
{name:"श्री. बिपिन चंद्रकांत शेटे",nameEn:"Bipin Chandrakant Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"9665371380"},
{name:"श्री. सुधीर पंढरीनाथ शेटे",nameEn:"Sudhir Pandharinath Shete",village:"टिटवाळा",villageEn:"Titwala",mobile:"9029813910"},
{name:"श्री. सुधीर बळीराम शेटे",nameEn:"Sudhir Baliram Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"7768929444"},
{name:"श्री. विलास बळीराम शेटे",nameEn:"Vilas Baliram Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"8655464268"},
{name:"श्री. उदय गजानन शेटे",nameEn:"Uday Gajanan Shete",village:"कुळगाव",villageEn:"Kulgaon",mobile:"8484872796"},
{name:"श्री. शिवराज विकास शेटे",nameEn:"Shivraj Vikas Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"7276641118"},
{name:"श्री. रोहित नंदकुमार शेटे",nameEn:"Rohit Nandkumar Shete",village:"भिवंडी",villageEn:"Bhiwandi",mobile:"9226976766"},
{name:"श्री. रविंद्र भिमनाथ शेटे",nameEn:"Ravindra Bhimnath Shete",village:"मुरबाड",villageEn:"Murbad",mobile:"9226124141"},
{name:"श्री. साईनाथ दत्तात्रय शेटे",nameEn:"Sainath Dattatray Shete",village:"मुरबाड",villageEn:"Murbad",mobile:"9764661669"},
{name:"श्री. मिलिंद पांडुरंग शेटे",nameEn:"Milind Pandurang Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"9227973363"},
{name:"श्री. राजेश अनंत शेटे",nameEn:"Rajesh Anant Shete",village:"अंबरनाथ",villageEn:"Ambernath",mobile:"9890641537"},
{name:"श्री. दिगंबर मालचंद्र शेटे",nameEn:"Digambar Malchandra Shete",village:"मुरबाड",villageEn:"Murbad",mobile:"7039975438"},
{name:"श्री. संतोष मुरलीधर शेटे",nameEn:"Santosh Muralidhar Shete",village:"उल्हासनगर",villageEn:"Ulhasnagar",mobile:"9960332566"},
{name:"श्री. योगेश मुरलीधर शेटे",nameEn:"Yogesh Muralidhar Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"9224413542"},
{name:"श्री. महेश सदानंद शेटे",nameEn:"Mahesh Sadanand Shete",village:"नेतीवली",villageEn:"Netivali",mobile:"9867386723"},
{name:"श्री. अरुण सदानंद शेटे",nameEn:"Arun Sadanand Shete",village:"देवरंग",villageEn:"Devrang",mobile:"9320301053"},
{name:"श्री. स्वप्नील पद्माकर शेटे",nameEn:"Swapnil Padmakar Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9699761517"},
{name:"श्री. दत्तात्रय नारायण शेटे",nameEn:"Dattatray Narayan Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9819654242"},
{name:"श्री. प्रमोद गजानन शेटे",nameEn:"Pramod Gajanan Shete",village:"मुरबाड",villageEn:"Murbad",mobile:"8850834532"},
{name:"श्री. मिलिंद मुरलीधर शेटे",nameEn:"Milind Muralidhar Shete",village:"विठ्ठलवाडी",villageEn:"Vitthalwadi",mobile:"7498046149"},
{name:"श्री. किरण काशिनाथ शेटे",nameEn:"Kiran Kashinath Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"8805347590"},
{name:"श्री. योगेश विश्वनाथ शेटे",nameEn:"Yogesh Vishwanath Shete",village:"भिवंडी",villageEn:"Bhiwandi",mobile:"9822270707"},
{name:"श्री. गुरुनाथ द्वारकानाथ शेटे",nameEn:"Gurunath Dwarkanath Shete",village:"सुरडा",villageEn:"Surda",mobile:"9421627743"},
{name:"श्री. बाळकृष्ण बाबू शेटे",nameEn:"Balkrishna Babu Shete",village:"ढलोंडा",villageEn:"Dhalonda",mobile:"9028296961"},
{name:"श्री. ओंकार मुरलीधर शेटे",nameEn:"Omkar Muralidhar Shete",village:"अंबरनाथ",villageEn:"Ambernath",mobile:"7768887974"},
{name:"श्री. दिनेश मेघराज शेटे",nameEn:"Dinesh Meghraj Shete",village:"डोंबिवली",villageEn:"Dombivli",mobile:"9823587946"},
{name:"श्री. राजेंद्र मोरेश्वर शेटे",nameEn:"Rajendra Moreshwar Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9833410701"},
{name:"श्री. श्रीनाथ सूर्यकांत शेटे",nameEn:"Shrinath Suryakant Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"8007951369"},
{name:"श्री. अनिरुद्ध सूर्यकांत शेटे",nameEn:"Aniruddha Suryakant Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"7722080550"},
{name:"श्री. कृष्णदास सदानंद शेटे",nameEn:"Krishnadas Sadanand Shete",village:"बदलापूर",villageEn:"Badlapur",mobile:"8698858558"},
{name:"श्री. महेश मधुकर शेटे",nameEn:"Mahesh Madhukar Shete",village:"वडगाव",villageEn:"Wadgaon",mobile:"9960816183"},
{name:"श्री. निखिलेश अनिल शेटे",nameEn:"Nikhilesh Anil Shete",village:"वासिंद",villageEn:"Vasind",mobile:"9028663031"},
{name:"श्री. सुनील शांताराम शेटे",nameEn:"Sunil Shantaram Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"8976903137"},
{name:"श्री. विजय रमेश शेटे",nameEn:"Vijay Ramesh Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9623683435"},
{name:"श्री. गिरीश गुरुनाथ शेटे",nameEn:"Girish Gurunath Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9769551942"},
{name:"श्री. प्राशिल निखिल शेटे",nameEn:"Prashil Nikhil Shete",village:"ठाणे",villageEn:"Thane",mobile:"9987888388"},
{name:"श्री. मंजिरी गोविंद शेटे",nameEn:"Manjiri Govind Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9226466108"},
{name:"श्री. मनोज मधुकर शेटे",nameEn:"Manoj Madhukar Shete",village:"वडगाव",villageEn:"Wadgaon",mobile:"9049434137"},
{name:"श्री. मनोज मेघराज शेटे",nameEn:"Manoj Meghraj Shete",village:"खोपोली",villageEn:"Khopoli",mobile:"8793538450"},
{name:"कै. मोहन चंद्रकांत शेटे",nameEn:"Mohan Chandrakant Shete",village:"विठ्ठलवाडी",villageEn:"Vitthalwadi",mobile:"9323474369"},
{name:"श्री. प्रमोद गजानन शेटे",nameEn:"Pramod Gajanan Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9819242132"},
{name:"श्री. गुरुनाथ द्वारकानाथ शेटे",nameEn:"Gurunath Dwarkanath Shete",village:"देवरंग",villageEn:"Devrang",mobile:"8655385355"},
{name:"श्री. सुरेश नारायण शेटे",nameEn:"Suresh Narayan Shete",village:"भिवंडी",villageEn:"Bhiwandi",mobile:"7219573730"},
{name:"श्री. सुनील शांताराम शेटे",nameEn:"Sunil Shantaram Shete",village:"वासिंद",villageEn:"Vasind",mobile:"9324484800"},
{name:"सौ. लक्ष्मी पंकज शेटे",nameEn:"Laxmi Pankaj Shete",village:"वासिंद",villageEn:"Vasind",mobile:"8080005505"},
{name:"श्री. मंगेश शांताराम शेटे",nameEn:"Mangesh Shantaram Shete",village:"वासिंद",villageEn:"Vasind",mobile:"9766920125"},
{name:"कु. मयूर संगेश शेटे",nameEn:"Mayur Sangesh Shete",village:"वासिंद",villageEn:"Vasind",mobile:"8983662652"},
{name:"श्री. प्रशांत रघुनाथ शेटे",nameEn:"Prashant Raghunath Shete",village:"कल्याण",villageEn:"Kalyan",mobile:"9699907943"}
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const h = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return h === hash;
}

async function getDb() {
  if (_db) return _db;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      contact_no TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      required_software TEXT,
      customer_description TEXT,
      committed_to_customer TEXT,
      next_followup_date TEXT,
      status TEXT NOT NULL DEFAULT 'In-Process',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // Existing databases predate the address/city/state columns — add them if missing.
  for (const col of ['address', 'city', 'state']) {
    try {
      _db.run(`ALTER TABLE leads ADD COLUMN ${col} TEXT`);
    } catch { /* column already exists */ }
  }
  _db.run(`
    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      followup_date TEXT NOT NULL,
      discussion TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // Shared availability calendar (mokla-divas). Public, code-gated, independent
  // of the lead pipeline — it shares this database file only for storage.
  // Small key/value store for install-level values that belong to no feature.
  // Currently holds only the visitor-counting salt.
  _db.run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // One row per visitor per page per day. Unique visitors for a day are the
  // rows; views are their summed counters. `visitor` is a salted hash, never an
  // address — see analytics.js for why it is only comparable within one day.
  _db.run(`
    CREATE TABLE IF NOT EXISTS page_hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      page TEXT NOT NULL,
      visitor TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 1,
      first_seen TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // Integrity, not speed: one row per visitor per page per day, so a reload
  // bumps the counter instead of inventing a second visitor.
  try {
    _db.run(`CREATE UNIQUE INDEX IF NOT EXISTS page_hits_unique
             ON page_hits (day, page, visitor)`);
  } catch { /* index already exists */ }

  _db.run(`
    CREATE TABLE IF NOT EXISTS calendar_spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS calendar_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_mr TEXT,
      sort_order INTEGER NOT NULL DEFAULT 99,
      members TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS calendar_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key TEXT NOT NULL,
      mark_date TEXT NOT NULL,
      member_id TEXT NOT NULL,
      mark_kind TEXT NOT NULL DEFAULT 'busy',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // A mark is either 'busy' (cannot make it) or 'prefer' (would like this date
  // for the event). Databases predating the second kind get the column here.
  try {
    _db.run(`ALTER TABLE calendar_marks ADD COLUMN mark_kind TEXT NOT NULL DEFAULT 'busy'`);
  } catch { /* column already exists */ }

  // Integrity, not speed: one friend, one mark of each kind per date. The old
  // index left mark_kind out, which would have collapsed the two kinds into one
  // row, so it is replaced. Dropping an index discards no data.
  try { _db.run(`DROP INDEX IF EXISTS calendar_marks_unique`); } catch { /* never existed */ }
  try {
    _db.run(`CREATE UNIQUE INDEX IF NOT EXISTS calendar_marks_unique_kind
             ON calendar_marks (group_key, mark_date, member_id, mark_kind)`);
  } catch { /* index already exists */ }

  // calendar_spaces held the original single install-wide code. Each group now
  // carries its own, so this table only survives to donate that original code to
  // the first group below, keeping a link already handed out working.
  if (query(`SELECT id FROM calendar_spaces`).length === 0) {
    const code = process.env.CALENDAR_SHARE_CODE || crypto.randomBytes(6).toString('hex');
    _db.run(`INSERT INTO calendar_spaces (share_code) VALUES (?)`, [code]);
  }

  if (query(`SELECT id FROM calendar_groups`).length === 0) {
    for (const g of CALENDAR_SEED_GROUPS) {
      _db.run(
        `INSERT INTO calendar_groups (group_key, name_en, name_mr, sort_order, members)
         VALUES (?,?,?,?,?)`,
        [g.group_key, g.name_en, g.name_mr, g.sort_order, JSON.stringify(g.members)]
      );
    }
  }

  // One share code per GROUP: a friend's link resolves to exactly one group, so
  // they never see another group or its members.
  try {
    _db.run(`ALTER TABLE calendar_groups ADD COLUMN share_code TEXT`);
  } catch { /* column already exists */ }

  const uncoded = query(
    `SELECT id FROM calendar_groups WHERE share_code IS NULL OR share_code = '' ORDER BY sort_order, id`
  );
  if (uncoded.length > 0) {
    const legacy = query(`SELECT share_code FROM calendar_spaces ORDER BY id LIMIT 1`);
    const firstHasCode = query(`SELECT id FROM calendar_groups WHERE share_code IS NOT NULL AND share_code != ''`).length > 0;
    uncoded.forEach((row, i) => {
      // The very first group inherits the old install-wide code so a link already
      // shared with friends keeps working — and now points at just that group.
      const inherit = i === 0 && !firstHasCode && legacy.length > 0;
      const code = inherit ? legacy[0].share_code : crypto.randomBytes(6).toString('hex');
      _db.run(`UPDATE calendar_groups SET share_code = ? WHERE id = ?`, [code, row.id]);
    });
  }
  try {
    _db.run(`CREATE UNIQUE INDEX IF NOT EXISTS calendar_groups_share_code
             ON calendar_groups (share_code)`);
  } catch { /* index already exists */ }

  // Shete Parivar Navratri: member directory + photo gallery, both gated by an
  // admin-approval queue. Shares this database file only for storage — no
  // relation to leads/calendar. `shete_members` is the live, public roster;
  // `shete_member_requests` and `shete_gallery` hold submissions until an admin
  // approves them (rows for shete_gallery only ever reach 'approved' by an
  // admin action — there is no auto-approve path).
  _db.run(`
    CREATE TABLE IF NOT EXISTS shete_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT,
      village TEXT NOT NULL,
      village_en TEXT,
      mobile TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS shete_member_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      village TEXT NOT NULL,
      mobile TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      reviewed_at TEXT
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS shete_gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_file TEXT NOT NULL,
      caption TEXT NOT NULL,
      year INTEGER NOT NULL,
      mobile TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      reviewed_at TEXT
    )
  `);
  // Navratri history list — edited straight from the admin page (add/edit/delete),
  // no request/approval queue like members and gallery have, since it's the
  // admin's own record rather than something friends submit.
  _db.run(`
    CREATE TABLE IF NOT EXISTS shete_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      village TEXT,
      year INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  if (query(`SELECT id FROM shete_members`).length === 0) {
    for (const m of SHETE_MEMBERS_SEED) {
      _db.run(
        `INSERT INTO shete_members (name, name_en, village, village_en, mobile) VALUES (?,?,?,?,?)`,
        [m.name, m.nameEn, m.village, m.villageEn, m.mobile]
      );
    }
  }

  if (query(`SELECT id FROM shete_history`).length === 0) {
    for (const h of SHETE_HISTORY_SEED) {
      _db.run(
        `INSERT INTO shete_history (name, village, year) VALUES (?,?,?)`,
        [h.name, h.village, h.year]
      );
    }
  }

  // Seed admin if not exists
  const existing = query(`SELECT id FROM users WHERE username = 'admin'`);
  if (existing.length === 0) {
    const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'admin123';
    if (!process.env.ADMIN_SEED_PASSWORD) {
      console.warn('ADMIN_SEED_PASSWORD not set — seeding admin with dev-only default password.');
    }
    const adminHash = hashPassword(seedPassword);
    _db.run(
      `INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')`,
      [adminHash]
    );
  }

  save();
  return _db;
}

function save() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// sql.js cannot bind `undefined` — coerce any undefined param to null.
function sanitize(params) {
  return params.map(p => (p === undefined ? null : p));
}

function query(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(sanitize(params));
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  _db.run(sql, sanitize(params));
  // Capture the new row id BEFORE saving/exporting.
  const rowid = _db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  save();
  return rowid;
}

module.exports = { getDb, query, run, save, hashPassword, verifyPassword };
