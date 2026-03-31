/* ============================================================
   LUNA — CONFIG
   Edit this file to change your supplements, habits, skincare,
   quick-tick items, and NFC tag labels.
   No coding knowledge needed — just edit the values in quotes.
   ============================================================ */

const LUNA_CONFIG = {

  /* ---- CYCLE ---- */
  cycle: {
    averageLength: 33,
    periodLength: 6,
    /* PCOS-adjusted ovulation window — your data shows day 17-24 */
    ovulationWindowStart: 17,
    ovulationWindowEnd: 24,
  },

  /* ---- SUPPLEMENTS ----
     id:    unique short name (no spaces)
     name:  display name
     time:  'morning' | 'night' | 'with food'
     note:  small reminder shown under name
     active: true/false — set false to hide without deleting
  */
  supplements: [
    { id:'mag',      name:'Magnesium glycinate', time:'night',      note:'381mg — keep always',        active:true },
    { id:'iron',     name:'Iron 15mg',           time:'morning',    note:'ferrous fumarate',            active:true },
    { id:'omega',    name:'Omega-3',             time:'morning',    note:'switch to Ditto in ~6 weeks', active:true },
    { id:'saffron',  name:'Saffron 30mg',        time:'morning',    note:'1 month left',                active:true },
    { id:'zinc',     name:'Zinc (bridge)',        time:'morning',    note:'until Ditto starts',          active:true },
    { id:'elvanse',  name:'Elvanse',             time:'morning',    note:'30mg / 50mg late luteal',     active:true },
    { id:'quercetin',name:'Quercetin complex',   time:'with food',  note:'check Elvanse interaction first', active:false },
  ],

  /* ---- DAILY HABITS ---- */
  habits: [
    { id:'jumps',    name:'50 jumps',            meta:'lymph flow',  active:true },
    { id:'water',    name:'Water',               meta:'',            active:true },
    { id:'meal',     name:'Proper meal',         meta:'no skipping', active:true },
    { id:'shower',   name:'Shower',              meta:'',            active:true },
    { id:'teeth-am', name:'Brush teeth AM',      meta:'',            active:true },
    { id:'teeth-pm', name:'Brush teeth PM',      meta:'',            active:true },
    { id:'moisturise',name:'Moisturise',         meta:'after shower',active:true },
    { id:'movement', name:'Movement',            meta:'',            active:true },
    { id:'sleep',    name:'Sleep before midnight',meta:'',           active:true },
  ],

  /* ---- SKINCARE
     Add your actual products here — swap out placeholders
  */
  skincare: [
    { id:'sc-cleanse1', name:'First cleanse',    meta:'AM + PM',     active:true },
    { id:'sc-cleanse2', name:'Second cleanse',   meta:'PM',          active:true },
    { id:'sc-argireline',name:'Argireline',      meta:'AM',          active:true },
    { id:'sc-retinol',  name:'Retinol',          meta:'PM only',     active:true },
    { id:'sc-retinal',  name:'Retinal eye serum',meta:'PM',          active:true },
    { id:'sc-spf',      name:'SPF',              meta:'AM',          active:true },
    { id:'sc-barrier',  name:'Barrier moisturiser',meta:'',          active:true },
  ],

  /* ---- QUICK TICK ITEMS
     These appear in the "Quick ticks" mode on the Log tab.
     Good for things you just want to record happened, no detail needed.
  */
  quickTicks: [
    { id:'qt-energy-low',  name:'Low energy',     group:'symptoms' },
    { id:'qt-energy-high', name:'Good energy',    group:'symptoms' },
    { id:'qt-brain-fog',   name:'Brain fog',      group:'symptoms' },
    { id:'qt-bloated',     name:'Bloated',        group:'symptoms' },
    { id:'qt-puffy',       name:'Puffy / inflamed',group:'symptoms' },
    { id:'qt-anxious',     name:'Anxious',        group:'mood' },
    { id:'qt-low-mood',    name:'Low mood',       group:'mood' },
    { id:'qt-good-mood',   name:'Good mood',      group:'mood' },
    { id:'qt-cramps',      name:'Cramps',         group:'symptoms' },
    { id:'qt-skin-clear',  name:'Skin clear',     group:'skin' },
    { id:'qt-skin-bad',    name:'Skin breaking out',group:'skin' },
    { id:'qt-hair-washed', name:'Washed hair',    group:'body' },
    { id:'qt-slept-well',  name:'Slept well',     group:'body' },
    { id:'qt-slept-badly', name:'Bad sleep',      group:'body' },
  ],

  /* ---- NFC TAG CONTEXTS
     Each tag opens the app at ?nfc=<id>
     e.g. yourdomain.com/?nfc=supplements
     Write this URL to your NFC tag using the NFC Tools app.
  */
  nfcTags: [
    {
      id: 'supplements',
      label: 'Supplements',
      icon: '◉',
      mode: 'tick',
      description: 'Tap next to your supplement bottles',
      items: 'supplements',
    },
    {
      id: 'habits',
      label: 'Morning habits',
      icon: '◎',
      mode: 'tick',
      description: 'Tap on your bathroom mirror',
      items: 'habits',
    },
    {
      id: 'skincare',
      label: 'Skincare',
      icon: '○',
      mode: 'tick',
      description: 'Tap next to your skincare shelf',
      items: 'skincare',
    },
    {
      id: 'food',
      label: 'Log food',
      icon: '◑',
      mode: 'input',
      description: 'Tap on your fridge',
      tab: 'food',
    },
    {
      id: 'symptoms',
      label: 'Quick symptoms',
      icon: '◐',
      mode: 'quicktick',
      description: 'Tap anywhere — how do you feel?',
      filter: 'symptoms',
    },
    {
      id: 'energy',
      label: 'Energy check-in',
      icon: '◒',
      mode: 'input',
      description: 'Tap wherever you keep your Elvanse',
      promptHint: "How's your energy right now? Any brain fog, crashes, or focus notes?",
    },
  ],

  /* ---- GOOGLE SHEETS SYNC
     After you set up the Apps Script (see SETUP.md),
     paste your Web App URL here.
  */
  sheetsWebAppUrl: 'https://script.google.com/macros/s/AKfycbxEi7yu22mP3eEsPVplzL2ax8fony5Uz9siJZmhHQzMu3v9tUo77lflDhhkerhIC2w__g/exec',   /* paste your Apps Script URL here */

  /* ---- AI
     The Claude API key is handled by the platform — leave this as-is.
  */
  aiModel: 'claude-sonnet-4-20250514',
};
