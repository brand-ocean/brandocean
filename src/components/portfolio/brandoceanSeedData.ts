// Scraped from brandocean.nl on 2026-05-05.
// One-time seed data for the portfolioItems table. Edit after import via the
// admin UI (/portfolio) — e.g. swap image URLs to Bunny CDN, refine copy.

const SITE = "https://brandocean.nl";
const img = (path: string) => `${SITE}/images/${path}`;

export type SeedItem = {
	title: string;
	category: string;
	project: string;
	ctaLabel: string;
	slug: string;
	summary?: string;
	heroImageUrl?: string;
	gallery?: string[];
	livePages?: string[];
	industry?: string;
	externalUrl: string;
	tags?: string[];
	published?: boolean;
	featured?: boolean;
};

export const BRANDOCEAN_SEED: SeedItem[] = [
	{
		title: "Azur Ibiza",
		category: "Social & Web Development",
		project: "Hospitality Brand · 2024",
		ctaLabel: "View Case",
		slug: "azur-ibiza",
		summary:
			"Conversion-optimised webshop voor een ambitieus zwemkledingmerk gelanceerd in 2023, in lijn met hun merkstijl. Aangevuld met social-media-advertising over meerdere kanalen om bereik en omzet te schalen.",
		heroImageUrl: img("10-20kopie-cc-88ren.avif"),
		gallery: [
			img("10-20kopie-cc-88ren-1.avif"),
			img("img_4741-20-1-.avif"),
			img("img_5889.avif"),
		],
		externalUrl: "https://www.azuribiza.com",
		industry: "SWIMWEAR",
		tags: ["Branding", "E-commerce", "Web Development", "Social Advertising"],
		featured: true,
	},
	{
		title: "Vesting Finance",
		category: "Design & Web Development",
		project: "Finance Platform · 2024",
		ctaLabel: "View Case",
		slug: "vesting-finance",
		summary:
			"Volledig herontworpen website plus een webapp met API-integratie naar bestaande systemen voor veilige account-toegang en financieel beheer. Branding en webdevelopment om een professionele identiteit te bouwen rond hun missie 'Building better financial futures.' Bedient zowel consumenten als zakelijke klanten met debiteurenbeheer, incasso en monitoring.",
		heroImageUrl: img("65e8dc958012c733c79ba2c2_dztiwhlwsay1bjc-p-2600.avif"),
		externalUrl: "https://vestingfinance.nl",
		industry: "FINANCE",
		tags: ["Branding", "Web Design", "Web App", "API Integration"],
	},
	{
		title: "Nerds",
		category: "Web Development",
		project: "IT Consultancy · 2024",
		ctaLabel: "View Case",
		slug: "nerds",
		summary:
			"Volledige website-redesign voor een IT-consultancy. Focus op user experience en het scherp communiceren van de value proposition naar bestaande en nieuwe klanten. Streamlined navigatie en conversie-gericht ontwerp leverden 360% meer conversies — bezoekers vinden services sneller, wat resulteert in meer leads en business.",
		heroImageUrl: img("nerds.avif"),
		gallery: [img("nerds-1.avif")],
		externalUrl: "https://www.nerds.nl",
		industry: "AGENCY",
		tags: ["Web Development", "UX/UI", "Redesign"],
	},
	{
		title: "Eye Filmmuseum",
		category: "Film & Social Advertising",
		project: "Cultural Campaign · 2024",
		ctaLabel: "View Case",
		slug: "eye-filmmuseum",
		summary:
			"Campagne rond Jean Desmet's nalatenschap in de Nederlandse filmgeschiedenis. Geanimeerde banners voor het 'Back to 1916' initiatief combineren historische beelden met moderne animatie. Targeted advertising over meerdere kanalen voor film-liefhebbers en cultuur-historisch publiek — subtiele bewegingen en special effects mengen vroeg-20e-eeuwse cinema-nostalgie met hedendaagse productie.",
		heroImageUrl: img("filmmuseum-20eye.avif"),
		externalUrl: "https://www.eyefilm.nl",
		industry: "CULTURE",
		tags: ["Film", "Social Advertising", "Animation", "Banner Design"],
	},
	{
		title: "Bruhn",
		category: "Branding & Web Development",
		project: "Barbershop Rebrand · 2024",
		ctaLabel: "View Case",
		slug: "bruhn",
		summary:
			"Volledige rebranding voor een groeiende moderne barbershop: visuele identiteit, herontworpen website geoptimaliseerd voor afspraken-boeken, fotografie en videografie van de sfeer en het vakmanschap, en een advertising-campagne om de lokale zichtbaarheid en klantenbasis te laten groeien.",
		heroImageUrl: img("bruhn.avif"),
		gallery: [
			img("img-200392-201920x2400.avif"),
			img("img-200398-201920x2400.avif"),
			img("651c1dfdd7519f80b62ff3d8_img_0391.avif"),
		],
		externalUrl: "https://www.bruhn.nl",
		industry: "BARBERSHOP",
		tags: [
			"Branding",
			"Visual Identity",
			"Web Development",
			"Photography",
			"Videography",
			"Advertising",
		],
		featured: true,
	},
	{
		title: "BRUHN Barbershop",
		category: "Branding & Web Development",
		project: "Barbershop · 2023",
		ctaLabel: "View Case",
		slug: "bruhn-barbershop",
		summary:
			"Online aanwezigheid voor een barbershop in Amsterdam-De Pijp: scherpe huisstijl en een conversiegerichte website voor knipafspraken, fades en beard trims door gecertificeerde barbers.",
		heroImageUrl:
			"https://cdn.prod.website-files.com/642843be0da449a9eaf4accd/651c1dfdaaca2da0c4742ec0_IMG_0392.webp",
		externalUrl: "https://bruhn.nl",
		industry: "BARBERSHOP",
		tags: ["Branding", "Web Development", "Hospitality", "Local Business"],
	},
	{
		title: "Kiesbeter",
		category: "Product & Web Development",
		project: "Vergelijkingsplatform · 2025",
		ctaLabel: "View Case",
		slug: "kiesbeter",
		summary:
			"Een Nederlands vergelijkingsplatform voor internet, TV en mobiele abonnementen — inclusief cashback-voordelen en gratis overstapservice. Volledig product-design, frontend en data-integraties.",
		heroImageUrl: "https://kiesbeter.app/_built/home-hero-2025-768-870330795b.jpg",
		externalUrl: "https://kiesbeter.app",
		industry: "COMPARISON",
		tags: [
			"Product Design",
			"Web Development",
			"Telecom",
			"Comparison",
			"Cashback",
		],
		featured: true,
	},
	{
		title: "LayerOne",
		category: "Branding & Web Development",
		project: "Tech Sales Recruitment · 2025",
		ctaLabel: "View Case",
		slug: "layerone",
		summary:
			"Recruitment hub voor Account Executives en sales-professionals in de Nederlandse tech-sector. Curatieve matching tussen toptalent en toonaangevende technologiebedrijven, voorzien van een nieuw merk en website.",
		externalUrl: "https://layerone.nl",
		industry: "RECRUITMENT",
		tags: ["Branding", "Web Development", "Recruitment", "Tech Sales", "B2B"],
	},
	{
		title: "Vergeten Bladzijden",
		category: "Design & Web Development",
		project: "Historische Kalender · 2024",
		ctaLabel: "View Case",
		slug: "vergeten-bladzijden",
		summary:
			"Interactieve digitale tijdlijn over onderbelichte gebeurtenissen, personen en momenten uit de Nederlandse koloniale- en slavernijgeschiedenis, aangevuld met recente momenten rondom Zwarte emancipatie.",
		heroImageUrl:
			"https://cdn.prod.website-files.com/68dfd56a579b2f7c60d66808/68e7ba5334391b1f5a58b10d_vergetenbladzijde-min.avif",
		externalUrl: "https://www.vergetenbladzijden.nl",
		industry: "CULTURE",
		tags: [
			"Design",
			"Web Development",
			"Cultural Heritage",
			"Storytelling",
			"Interactive",
		],
	},
	{
		title: "Neem het Stokje Over",
		category: "Branding & Web Development",
		project: "Civic Campaign · 2024",
		ctaLabel: "View Case",
		slug: "neem-het-stokje-over",
		summary:
			"Campagne-platform van 'Nederland wordt beter' dat Nederlanders oproept zich in te zetten tegen institutioneel racisme, woningcrisis, klimaatverandering en kansenongelijkheid via persoonlijke commitments.",
		externalUrl: "https://neemhetstokjeover.nl",
		industry: "CAMPAIGN",
		tags: [
			"Branding",
			"Web Development",
			"Non-profit",
			"Civic Engagement",
			"Campaign",
		],
	},
	{
		title: "Dag van Empathie",
		category: "Branding & Web Development",
		project: "Community Initiative · 2023",
		ctaLabel: "View Case",
		slug: "dag-van-empathie",
		summary:
			"Jaarlijks Nederlands initiatief op 3 mei waarop diverse gemeenschappen samenkomen voor verbinding, verhaaluitwisseling en empathische activiteiten. Merkidentiteit en website voor de beweging.",
		heroImageUrl:
			"https://cdn.prod.website-files.com/67c331a234dc7fa1e6e46041/67c33946bc7c4a621ddf8d1e_Dag%20van%20Empathie%203%20Mei%202023%20by%20Isaac%20Owusu.avif",
		externalUrl: "https://www.dagvanempathie.nl",
		industry: "COMMUNITY",
		tags: [
			"Branding",
			"Web Development",
			"Community",
			"Non-profit",
			"Event",
		],
	},
	{
		title: "PROSTAFFING",
		category: "Branding & Web Development",
		project: "Data Recruitment Hub · 2024",
		ctaLabel: "View Case",
		slug: "prostaffing",
		summary:
			"Recruitment-specialist die top data-professionals koppelt aan organisaties in Nederland — data engineering, analytics en AI-rollen. Volledig merk plus een conversion-gerichte website.",
		heroImageUrl:
			"https://cdn.prod.website-files.com/676bf6dce478bf337a54df2c/6773185f5a8000f04b61c348_Person%20Engaged%20with%20Digital%20Display.avif",
		externalUrl: "https://pro-staffing.com",
		industry: "RECRUITMENT",
		tags: [
			"Branding",
			"Web Development",
			"Recruitment",
			"Data",
			"AI/ML",
		],
	},
	{
		title: "J The Agency",
		category: "Branding & Web Development",
		project: "Events & Marketing Agency · 2025",
		ctaLabel: "View Case",
		slug: "j-the-agency",
		summary:
			"Full-service agency die exclusieve events, strategische marketing en professioneel horecatalent combineert onder één dak. Volledige merkidentiteit en een website die de drie pijlers naadloos integreert.",
		heroImageUrl:
			"https://cdn.prod.website-files.com/68c95fdeeddd3b8f814a1600/69395cf79caae07f7d4a6887_tmpahwh8b8l.avif",
		externalUrl: "https://www.jtheagency.nl",
		livePages: [
			"https://www.jtheagency.nl/",
			"https://www.jtheagency.nl/events",
			"https://www.jtheagency.nl/marketing",
			"https://www.jtheagency.nl/hospitality",
			"https://www.jtheagency.nl/contact",
		],
		industry: "AGENCY",
		tags: [
			"Branding",
			"Web Development",
			"Events",
			"Marketing",
			"Hospitality",
		],
		featured: true,
	},
	{
		title: "Ace & Tate",
		category: "E-commerce & Web Development",
		project: "Eyewear Brand · 2024",
		ctaLabel: "View Case",
		slug: "ace-and-tate",
		summary:
			"Handgemaakte brillen op sterkte en zonnebrillen, met persoonlijke services zoals gratis oogmetingen en getinte glazen. Internationale e-commerce flow en localisatie voor de Nederlandse markt.",
		heroImageUrl:
			"https://ctfassets.aceandtate.com/cdn-cgi/image/fit=scale-down,quality=75,width=3840/utaji99zkvj6/dplijxHXTq47nmEClBwwp/175a863bb2c82542416e112a5e16790f/Hero_Banner.jpg",
		externalUrl: "https://www.aceandtate.com/nl",
		livePages: [
			"https://www.aceandtate.com/nl",
			"https://www.aceandtate.com/nl/glasses",
			"https://www.aceandtate.com/nl/sunglasses",
			"https://www.aceandtate.com/nl/stores",
		],
		industry: "E-COMMERCE",
		tags: [
			"E-commerce",
			"Fashion",
			"Eyewear",
			"Web Development",
			"Localisation",
		],
	},
	{
		title: "BRONS",
		category: "Branding & Web Development",
		project: "Café & Restaurant · 2025",
		ctaLabel: "View Case",
		slug: "brons",
		summary:
			"Koffiezaak, lunchplek, kroeg en eetcafé aan het water in Amsterdam-West. Ontspannen in gevoel, eigentijds in uitvoering — een complete merkidentiteit en website met menu, momenten en sfeer.",
		heroImageUrl: "https://brons.nl/home/about-3.jpg",
		externalUrl: "https://brons.wild-bread-8832.workers.dev",
		livePages: [
			"https://brons.wild-bread-8832.workers.dev/",
			"https://brons.wild-bread-8832.workers.dev/#about",
			"https://brons.wild-bread-8832.workers.dev/#menu",
			"https://brons.wild-bread-8832.workers.dev/#momenten",
			"https://brons.wild-bread-8832.workers.dev/#reviews",
		],
		industry: "RESTAURANT",
		tags: [
			"Branding",
			"Web Development",
			"Hospitality",
			"Amsterdam",
			"Café",
		],
		featured: true,
	},
	{
		title: "Paradiso",
		category: "Web Development & Culture",
		project: "Iconic Amsterdam Venue · 2024",
		ctaLabel: "View Case",
		slug: "paradiso",
		summary:
			"Een iconische Amsterdamse culturele instelling met 58 jaar geschiedenis: concerten, clubnachten en diverse culturele evenementen. Werk rond website, ticketing-flow en redactionele content.",
		heroImageUrl:
			"https://assets.paradiso.nl/images/transforms/event/_73x91_crop_center-center_35_none/LEAD-IMAGE-pc-Luke-Rogers-1776762508.jpg",
		externalUrl: "https://www.paradiso.nl",
		livePages: [
			"https://www.paradiso.nl/",
			"https://www.paradiso.nl/nieuws",
			"https://www.paradiso.nl/bezoek",
			"https://www.paradiso.nl/info/over-ons",
			"https://www.paradiso.nl/lidmaatschap",
		],
		industry: "VENUE",
		tags: [
			"Web Development",
			"Live Music",
			"Culture",
			"Amsterdam",
			"Ticketing",
		],
	},
];
