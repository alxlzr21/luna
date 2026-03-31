/* ============================================================
   LUNA — CONFIG v2
   Edit this file to change supplements, habits, skincare, etc.
   No coding needed — just edit the text values.
   ============================================================ */

const LUNA_CONFIG = {

  cycle: {
    averageLength: 33,
    periodLength: 6,
    ovulationWindowStart: 17,
    ovulationWindowEnd: 24,
  },

  supplements: [
    { id:'mag',       name:'Magnesium glycinate', time:'night',     note:'381mg — keep always',             active:true  },
    { id:'iron',      name:'Iron 15mg',           time:'morning',   note:'ferrous fumarate',                active:true  },
    { id:'omega',     name:'Omega-3',             time:'morning',   note:'switch to Ditto in ~6 weeks',     active:true  },
    { id:'saffron',   name:'Saffron 30mg',        time:'morning',   note:'1 month left',                    active:true  },
    { id:'zinc',      name:'Zinc (bridge)',        time:'morning',   note:'until Ditto starts',              active:true  },
    { id:'elvanse',   name:'Elvanse',             time:'morning',   note:'30mg / 50mg late luteal',         active:true  },
    { id:'quercetin', name:'Quercetin complex',   time:'with food', note:'check Elvanse interaction first', active:false },
  ],

  /* Nested habit groups. Children can have their own children (sub-habits). */
  habitGroups: [
    {
      id:'body', name:'Body',
      children: [
        { id:'jumps',    name:'50 jumps',             meta:'lymph flow',  active:true },
        { id:'water',    name:'Water',               meta:'',            active:true },
        { id:'meal',     name:'Proper meal',         meta:'no skipping', active:true },
        { id:'movement', name:'Movement',            meta:'',            active:true },
        { id:'sleep',    name:'Sleep before midnight',meta:'',           active:true },
      ]
    },
    {
      id:'hygiene', name:'Hygiene',
      children: [
        { id:'shower',    name:'Shower',             meta:'',            active:true },
        { id:'teeth-am',  name:'Brush teeth AM',     meta:'',            active:true },
        { id:'teeth-pm',  name:'Brush teeth PM',     meta:'',            active:true },
        { id:'moisturise',name:'Moisturise',         meta:'after shower',active:true },
        { id:'hair-wash', name:'Hair wash',          meta:'',            active:true },
      ]
    },
    {
      id:'skincare', name:'Skincare',
      children: [
        {
          id:'am-routine', name:'AM routine', meta:'', active:true,
          children: [
            { id:'sc-cleanse-am', name:'Cleanse',          meta:'AM', active:true },
            { id:'sc-spf',        name:'SPF',              meta:'AM', active:true },          ]
        },
        {
          id:'pm-routine', name:'PM routine', meta:'', active:true,
          children: [
            { id:'sc-cleanse1', name:'First cleanse - Ultrabland',      meta:'PM', active:true },
            { id:'sc-cleanse1', name:'First cleanse - Iunik Oil Cleanser',      meta:'PM', active:true },

            { id:'sc-cleanse2', name:'Second cleanse',     meta:'PM', active:true },
            { id:'sc-retinol',  name:'Retinol',            meta:'PM', active:true },
            { id:'sc-retinal',  name:'Retinal eye serum',  meta:'PM', active:true },
            { id:'sc-barrier',  name:'Barrier moisturiser',meta:'PM', active:true },
          ]
        },
      ]
    },
  ],

  quickTicks: [
    { id:'qt-energy-low',  name:'Low energy',        group:'symptoms' },
    { id:'qt-energy-high', name:'Good energy',       group:'symptoms' },
    { id:'qt-brain-fog',   name:'Brain fog',         group:'symptoms' },
    { id:'qt-bloated',     name:'Bloated',           group:'symptoms' },
    { id:'qt-puffy',       name:'Puffy',             group:'symptoms' },
    { id:'qt-anxious',     name:'Anxious',           group:'mood'     },
    { id:'qt-low-mood',    name:'Low mood',          group:'mood'     },
    { id:'qt-good-mood',   name:'Good mood',         group:'mood'     },
    { id:'qt-cramps',      name:'Cramps',            group:'symptoms' },
    { id:'qt-skin-clear',  name:'Skin clear',        group:'skin'     },
    { id:'qt-skin-bad',    name:'Skin breaking out', group:'skin'     },
    { id:'qt-slept-well',  name:'Slept well',        group:'body'     },
    { id:'qt-slept-badly', name:'Bad sleep',         group:'body'     },
  ],

  nfcTags: [
    { id:'supplements', label:'Supplements',     mode:'tick',      items:'supplements', description:'Next to your supplement bottles'  },
    { id:'habits',      label:'Morning habits',  mode:'habitgroup',                     description:'Bathroom mirror'                  },
    { id:'food',        label:'Log food',        mode:'input',     tab:'food',          description:'On the fridge'                    },
    { id:'symptoms',    label:'Symptoms',        mode:'quicktick', filter:'symptoms',   description:'Anywhere handy'                   },
    { id:'energy',      label:'Energy check-in', mode:'input',     promptHint:"How's your energy? Brain fog, crashes, focus notes?", description:'Next to your Elvanse' },
    { id:'temp',        label:'Temperature',     mode:'temp',                           description:'Next to your thermometer'         },
  ],

  sheetsWebAppUrl: '',
  aiModel: 'claude-sonnet-4-20250514',
};
