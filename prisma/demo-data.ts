/**
 * Fictional demo content used by the seed. No real people, reports or photos.
 */
export const DEPARTMENTS = [
  { code: "ROADS", name: "Direcția Drumuri și Infrastructură", email: "drumuri@demo-city.example" },
  { code: "LIGHT", name: "Serviciul Iluminat Public", email: "iluminat@demo-city.example" },
  { code: "SANIT", name: "Direcția Salubrizare", email: "salubrizare@demo-city.example" },
  { code: "GREEN", name: "Direcția Spații Verzi", email: "spatii.verzi@demo-city.example" },
  { code: "TRAFFIC", name: "Serviciul Trafic și Parcări", email: "trafic@demo-city.example" },
  { code: "UTIL", name: "Serviciul Utilități Publice", email: "utilitati@demo-city.example" },
  { code: "BUILD", name: "Direcția Patrimoniu și Clădiri Publice", email: "patrimoniu@demo-city.example" },
  { code: "POLICE", name: "Poliția Locală", email: "politia.locala@demo-city.example" },
];

type Sub = { slug: string; ro: string; en: string };
type Cat = {
  slug: string;
  ro: string;
  en: string;
  color: string;
  dept: string;
  sla: number;
  notice?: { ro: string; en: string };
  subs: Sub[];
  sensitive?: boolean;
};

export const CATEGORIES: Cat[] = [
  {
    slug: "roads", ro: "Străzi și trotuare", en: "Roads & sidewalks", color: "#b45309", dept: "ROADS", sla: 30,
    subs: [
      { slug: "roads-potholes", ro: "Gropi în carosabil", en: "Potholes" },
      { slug: "roads-sidewalk", ro: "Trotuar deteriorat", en: "Damaged sidewalk" },
      { slug: "roads-curb", ro: "Borduri și rigole", en: "Curbs & gutters" },
    ],
  },
  {
    slug: "lighting", ro: "Iluminat public", en: "Street lighting", color: "#ca8a04", dept: "LIGHT", sla: 10,
    subs: [
      { slug: "lighting-off", ro: "Stâlp nefuncțional", en: "Light not working" },
      { slug: "lighting-daytime", ro: "Iluminat aprins ziua", en: "Light on during the day" },
      { slug: "lighting-damaged", ro: "Stâlp deteriorat", en: "Damaged pole" },
    ],
  },
  {
    slug: "waste", ro: "Salubrizare și deșeuri", en: "Waste & cleaning", color: "#4d7c0f", dept: "SANIT", sla: 7,
    subs: [
      { slug: "waste-illegal", ro: "Deșeuri abandonate", en: "Illegal dumping" },
      { slug: "waste-bins", ro: "Containere pline", en: "Overflowing bins" },
      { slug: "waste-street", ro: "Stradă necurățată", en: "Street cleaning" },
    ],
  },
  {
    slug: "green", ro: "Spații verzi și locuri de joacă", en: "Green spaces & playgrounds", color: "#15803d", dept: "GREEN", sla: 21,
    subs: [
      { slug: "green-trees", ro: "Arbori (toaletare, căzuți)", en: "Trees (pruning, fallen)" },
      { slug: "green-grass", ro: "Iarbă necosită", en: "Uncut grass" },
      { slug: "green-playground", ro: "Loc de joacă deteriorat", en: "Damaged playground" },
    ],
  },
  {
    slug: "infrastructure", ro: "Infrastructură publică", en: "Public infrastructure", color: "#0f766e", dept: "ROADS", sla: 30,
    subs: [
      { slug: "infra-benches", ro: "Bănci și mobilier urban", en: "Benches & street furniture" },
      { slug: "infra-bus-stop", ro: "Stații de autobuz", en: "Bus stops" },
      { slug: "infra-bridges", ro: "Poduri și pasaje", en: "Bridges & underpasses" },
    ],
  },
  {
    slug: "traffic", ro: "Trafic și semne de circulație", en: "Traffic & road signs", color: "#dc2626", dept: "TRAFFIC", sla: 14,
    subs: [
      { slug: "traffic-signs", ro: "Indicatoare lipsă sau deteriorate", en: "Missing or damaged signs" },
      { slug: "traffic-lights", ro: "Semafoare", en: "Traffic lights" },
      { slug: "traffic-markings", ro: "Marcaje rutiere", en: "Road markings" },
    ],
  },
  {
    slug: "parking", ro: "Parcări", en: "Parking", color: "#7c3aed", dept: "TRAFFIC", sla: 14,
    notice: {
      ro: "Pentru mașini parcate neregulamentar în acest moment, sunați la Poliția Locală.",
      en: "For vehicles illegally parked right now, call the Local Police.",
    },
    subs: [
      { slug: "parking-illegal", ro: "Parcare neregulamentară", en: "Illegal parking" },
      { slug: "parking-abandoned", ro: "Vehicul abandonat", en: "Abandoned vehicle" },
    ],
  },
  {
    slug: "noise", ro: "Zgomot și ordine publică", en: "Noise & public order", color: "#be185d", dept: "POLICE", sla: 5,
    notice: {
      ro: "Sesizările din această categorie sunt preluate de Poliția Locală. În caz de urgență sunați la 112.",
      en: "Reports in this category are handled by the Local Police. In an emergency call 112.",
    },
    subs: [
      { slug: "noise-night", ro: "Zgomot pe timp de noapte", en: "Night-time noise" },
      { slug: "noise-works", ro: "Lucrări în afara programului", en: "Construction outside allowed hours" },
    ],
  },
  {
    slug: "water", ro: "Apă și termoficare", en: "Water & heating", color: "#0284c7", dept: "UTIL", sla: 7,
    subs: [
      { slug: "water-leak", ro: "Scurgere de apă", en: "Water leak" },
      { slug: "water-hydrant", ro: "Hidrant deteriorat", en: "Damaged hydrant" },
    ],
  },
  {
    slug: "sewerage", ro: "Canalizare", en: "Sewerage", color: "#475569", dept: "UTIL", sla: 7,
    subs: [
      { slug: "sewer-blocked", ro: "Gură de canal înfundată", en: "Blocked drain" },
      { slug: "sewer-lid", ro: "Capac de canal lipsă", en: "Missing manhole cover" },
    ],
  },
  {
    slug: "buildings", ro: "Clădiri publice", en: "Public buildings", color: "#9333ea", dept: "BUILD", sla: 30,
    subs: [
      { slug: "buildings-schools", ro: "Școli și grădinițe", en: "Schools & kindergartens" },
      { slug: "buildings-facade", ro: "Fațade periculoase", en: "Dangerous facades" },
    ],
  },
  {
    slug: "other", ro: "Altele", en: "Other", color: "#64748b", dept: "BUILD", sla: 30,
    subs: [],
  },
  {
    slug: "integrity", ro: "Probleme de integritate", en: "Integrity concerns", color: "#1f2937", dept: "BUILD", sla: 30, sensitive: true,
    notice: {
      ro: "Sesizările din această categorie nu sunt publicate pe hartă.",
      en: "Reports in this category are never published on the map.",
    },
    subs: [],
  },
];

/** Report text templates per top-level category – fictional. */
export const TEMPLATES: Record<string, { sub?: string; title: string; description: string }[]> = {
  roads: [
    { sub: "roads-potholes", title: "Groapă mare în carosabil", description: "Pe banda din dreapta s-a format o groapă adâncă de aproximativ 15 cm. Mașinile trec pe contrasens ca să o ocolească, ceea ce este periculos, mai ales seara." },
    { sub: "roads-sidewalk", title: "Dale de trotuar desprinse", description: "Mai multe dale de pe trotuar sunt desprinse și se mișcă atunci când calci pe ele. Am văzut deja o persoană în vârstă împiedicându-se. Vă rog să le refaceți." },
    { sub: "roads-curb", title: "Rigolă colmatată, apa băltește", description: "După fiecare ploaie apa rămâne pe carosabil pentru că rigola este plină de pământ și frunze. Pietonii sunt stropiți de mașini." },
  ],
  lighting: [
    { sub: "lighting-off", title: "Stâlp de iluminat nefuncțional", description: "Stâlpul de iluminat din dreptul intrării în parc nu mai funcționează de aproximativ o săptămână. Zona este foarte întunecată seara." },
    { sub: "lighting-daytime", title: "Iluminatul rămâne aprins ziua", description: "Toate lămpile de pe tronsonul dintre intersecții rămân aprinse și pe timp de zi. Probabil senzorul este defect." },
    { sub: "lighting-damaged", title: "Stâlp înclinat după furtună", description: "După furtuna de aseară stâlpul s-a înclinat vizibil spre carosabil. Pare că baza este deteriorată și ar putea cădea." },
  ],
  waste: [
    { sub: "waste-illegal", title: "Moloz abandonat lângă garaje", description: "Cineva a descărcat saci cu moloz și resturi de mobilier în spatele garajelor. Grămada crește de la o zi la alta." },
    { sub: "waste-bins", title: "Containere pline de câteva zile", description: "Containerele de la punctul de colectare nu au mai fost golite de trei zile. Gunoiul este pus lângă ele și este împrăștiat de câini." },
    { sub: "waste-street", title: "Frunze și gunoaie pe trotuar", description: "Trotuarul nu a mai fost măturat de mult timp. Sunt multe frunze ude, alunecoase, și ambalaje aruncate." },
  ],
  green: [
    { sub: "green-trees", title: "Crengi uscate deasupra aleii", description: "Un arbore are câteva crengi mari uscate chiar deasupra aleii pietonale. La vânt puternic cad bucăți din ele. Solicit toaletarea." },
    { sub: "green-grass", title: "Iarba nu a fost cosită", description: "Iarba din scuarul dintre blocuri a ajuns la jumătate de metru. Au apărut căpușe și mulți țânțari." },
    { sub: "green-playground", title: "Leagăn rupt la locul de joacă", description: "Unul dintre leagănele de la locul de joacă are lanțul rupt și scaunul atârnă. Copiii se pot răni. Vă rog să îl reparați sau să îl demontați temporar." },
  ],
  infrastructure: [
    { sub: "infra-benches", title: "Bancă ruptă în parc", description: "Scândurile de la două bănci sunt rupte și au cuie ieșite în afară. Este periculos pentru copii." },
    { sub: "infra-bus-stop", title: "Geam spart la stația de autobuz", description: "Peretele de sticlă al stației este spart, iar cioburile sunt încă pe jos. Oamenii așteaptă autobuzul printre cioburi." },
    { sub: "infra-bridges", title: "Balustradă deteriorată pe pasarelă", description: "Balustrada pasarelei pietonale are o porțiune desprinsă. Există riscul ca cineva să cadă." },
  ],
  traffic: [
    { sub: "traffic-signs", title: "Indicator de oprire căzut", description: "Indicatorul STOP de la intersecție este căzut la pământ. Șoferii nu mai respectă prioritatea și s-au produs deja situații periculoase." },
    { sub: "traffic-lights", title: "Semafor pentru pietoni defect", description: "Semaforul pentru pietoni rămâne tot timpul pe roșu. Oamenii traversează pe roșu după ce așteaptă mult timp." },
    { sub: "traffic-markings", title: "Trecere de pietoni ștearsă", description: "Marcajul trecerii de pietoni aproape că nu se mai vede. Șoferii nu observă trecerea, mai ales noaptea." },
  ],
  parking: [
    { sub: "parking-illegal", title: "Mașini parcate pe trotuar", description: "Zilnic mașinile sunt parcate pe tot trotuarul, iar pietonii și părinții cu cărucioare sunt nevoiți să meargă pe carosabil." },
    { sub: "parking-abandoned", title: "Autoturism abandonat de luni de zile", description: "Un autoturism fără numere de înmatriculare stă abandonat în parcare de câteva luni și ocupă un loc de parcare." },
  ],
  noise: [
    { sub: "noise-night", title: "Muzică tare după ora 23", description: "Din localul de la parter se aude muzică foarte tare până după miezul nopții, aproape în fiecare seară din weekend." },
    { sub: "noise-works", title: "Lucrări de construcție la ora 6 dimineața", description: "Pe șantierul din apropiere se lucrează cu utilaje grele începând cu ora 6 dimineața, inclusiv duminica." },
  ],
  water: [
    { sub: "water-leak", title: "Apă curge pe carosabil", description: "De câteva zile curge apă curată din asfalt, probabil o conductă spartă. Se formează gheață dimineața." },
    { sub: "water-hydrant", title: "Hidrant lovit și înclinat", description: "Hidrantul de pe colț a fost lovit de o mașină și este înclinat, pierde puțină apă." },
  ],
  sewerage: [
    { sub: "sewer-blocked", title: "Gura de canal este înfundată", description: "La fiecare ploaie se formează o baltă mare pentru că gura de canal este înfundată cu frunze și nisip." },
    { sub: "sewer-lid", title: "Capac de canal lipsă", description: "Lipsește capacul unui cămin de canalizare de pe trotuar. Cineva a pus o creangă ca avertizare, dar este foarte periculos." },
  ],
  buildings: [
    { sub: "buildings-schools", title: "Gard deteriorat la grădiniță", description: "Gardul grădiniței are o porțiune căzută, iar copiii pot ieși în stradă în timpul pauzelor." },
    { sub: "buildings-facade", title: "Tencuială care cade de pe fațadă", description: "De pe fațada clădirii publice cad bucăți de tencuială direct pe trotuar. Zona ar trebui împrejmuită." },
  ],
  other: [
    { title: "Câini fără stăpân în parc", description: "O haită de câini fără stăpân stă în parc în fiecare dimineață și sperie copiii care merg la școală." },
    { title: "Graffiti pe zidul bibliotecii", description: "Zidul bibliotecii de cartier a fost acoperit cu graffiti vulgare. Vă rog să fie curățat." },
  ],
  integrity: [
    { title: "Solicitare de bani pentru o autorizație", description: "Descriere fictivă pentru date demonstrative: o persoană a sugerat că procesul ar putea fi „grăbit” contra cost." },
  ],
};

export const STREETS = [
  "Strada Castanilor", "Strada Teilor", "Bulevardul Unirii", "Strada Florilor", "Strada Morii",
  "Strada Lalelelor", "Aleea Parcului", "Strada Școlii", "Strada Gării", "Strada Viilor",
  "Strada Plopilor", "Calea Nordului", "Strada Fântânii", "Strada Livezii", "Strada Podului",
  "Strada Salcâmilor", "Strada Meșteșugarilor", "Aleea Trandafirilor", "Strada Păcii", "Calea Sudului",
];
export const DISTRICTS = ["Centru", "Cartierul Nord", "Cartierul Sud", "Zona Est", "Grădini", "Industrial Vest"];

export const CITIZENS = [
  ["Ana", "Popescu"], ["Mihai", "Ionescu"], ["Elena", "Dumitrescu"], ["Andrei", "Stan"], ["Ioana", "Marin"],
  ["Radu", "Georgescu"], ["Maria", "Tudor"], ["Alex", "Petrescu"], ["Cristina", "Neagu"], ["Dan", "Barbu"],
  ["Sofia", "Lungu"], ["Victor", "Enache"],
];

export const PUBLIC_UPDATES = [
  "Sesizarea a fost preluată de echipa de teren. Vom reveni cu detalii.",
  "Echipa a verificat situația la fața locului. Lucrarea a fost inclusă în programul de intervenții.",
  "Intervenția este programată în cursul săptămânii viitoare, în funcție de condițiile meteo.",
  "Lucrările au început. Vă mulțumim pentru răbdare.",
];
export const RESPONSES = [
  "Problema semnalată a fost remediată. Vă mulțumim pentru sesizare!",
  "Echipa noastră a finalizat intervenția. Dacă problema reapare, vă rugăm să ne anunțați.",
  "Lucrarea a fost executată conform programului. Vă mulțumim pentru implicare.",
];
export const INTERNAL_NOTES = [
  "Verificat cu echipa de teren – necesită utilaj, programat.",
  "Duplicat probabil cu o sesizare din aceeași zonă, de urmărit.",
  "Contactat petentul telefonic pentru detalii suplimentare.",
];
export const REDIRECT_TARGETS = ["Compania Regională de Apă", "Distribuitorul de energie electrică", "Administrația Drumurilor Naționale"];
