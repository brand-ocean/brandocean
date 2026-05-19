# FORZ OS — Offerte

**Centrale Bedrijfsapplicatie**

---

| | |
|---|---|
| **Voor:** | FORZ Consultancy B.V. |
| **T.a.v.:** | Ben Roz |
| **Van:** | Brandocean, Rooswijck 5A, 1081 AJ Amsterdam |
| **Datum:** | 12 mei 2026 |
| **Geldig tot:** | 9 juni 2026 |
| **Tarief voor FORZ:** | € 100,- per uur (excl. 21% BTW) |
| **Effectief uurtarief:** | **€ 76,19 per uur (excl. 21% BTW)** |
| **Vaste prijs:** | **€ 8.000,- (excl. 21% BTW)** |

---

## Hi Ben,

Allereerst dank voor de uitgebreide procesbeschrijvingen en de tijd die je hebt genomen om de FORZ OS visie zo helder uit te werken. Op basis daarvan heb ik een grondige analyse gemaakt van wat er nodig is om jullie centrale bedrijfsapplicatie te bouwen.

In onze meeting noemde ik een range van **€ 5.000 tot € 8.000**. Het uurtarief dat ik voor FORZ hanteer is **€ 100,- per uur**, onder mijn reguliere tarief, zoals besproken. Bij de volledige uitwerking van de scope (28 sub-modules, 7 modules, 3 integraties, plus het fundament) liep de uren-inschatting hoger op dan die range toelaat. Op een aantal modules heb ik scherp gerekend om binnen mijn eigen woord te blijven.

Vaste prijs **€ 8.000,-** voor 105 uur werk, effectief **€ 76,19 per uur**. Bovenkant van de range, alles erin, geen verrassingen achteraf.

**Scope:** we starten met een clean build, zonder migratie van historische data uit TimeChimp of Excel. Bullhorn blijft de bron voor candidates, clients, jobs en activity-notes; FORZ OS bouwt daar bovenop. Vanaf go-live registreren consultants placements, timesheets en commissies direct in FORZ OS.

## Over mij

Even kort over wie er voor je gaat bouwen.

Twintig jaar ervaring als developer en full-stack generalist: front-end, back-end, branding, design, marketing, CRO, UI/UX, data en automatisering. Eén aanspreekpunt in plaats van een bureau plus drie freelancers. Wat normaal verdeeld wordt over een developer, designer, marketeer, CRO-specialist en data-analist, pak ik in één hand op, met de onderlinge samenhang die je anders kwijt raakt.

**Concreet voor FORZ:** ik run de bouw én het beheer van FORZ OS in één hand. Niet alleen taken afvinken, maar de applicatie, de data-architectuur, de UI/UX per rol en de integraties met Bullhorn, WeFact en DocuSign als geheel ontwerpen en automatiseren waar dat kan.

## Uren-overzicht per module

| # | Module | Sub-modules | Uren |
|---|---|---|---|
| 1 | Analytics | 5 | **10 u** |
| 2 | Placements | 3 | **18 u** |
| 3 | Legal Contracts | 3 | **10 u** |
| 4 | Contractor Book | 4 | **8 u** |
| 5 | Timesheets | 4 | **17 u** |
| 6 | Commissions | 3 | **14 u** |
| 7 | Finance | 6 | **15 u** |
|  | *Fundament & cross-cutting* |  | *13 u* |
| | **TOTAAL** | **28** | **105 u** |

---

## 1. Analytics · 10 uur

De Analytics-module is jullie commerciële cockpit: alle sales-activiteiten, consultant-prestaties en gamification op één plek. Dit voedt de cultuur van het team en het management-dashboard. Activity-data (calls, meetings, intakes) wordt opgehaald uit Bullhorn. Consultants blijven loggen zoals nu, FORZ OS aggregeert.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Sales Activity Dashboard** | Real-time overzicht van activity-data uit Bullhorn: client calls, candidate calls, meetings, intakes, per consultant en per team. Filterable op periode en consultant. Vergelijking met targets en team-gemiddelden. | 3 u |
| **Consultant KPI Dashboard** | Persoonlijk dashboard per consultant met submissions, interviews, deals closed, conversion ratios en target progress (week/maand/kwartaal). | 2 u |
| **Conversion Dashboard** | Conversie-funnel: call → meeting, submission → interview, interview → placement. Per consultant en team. | 2 u |
| **Gamification** | Leaderboard en ranking-scherm op basis van activiteiten en deals. Eenvoudig ontwerp met 1 à 2 visuele varianten. | 2 u |
| **Big Screen Mode** | Kantoor-TV dashboard met live deal announcements en leaderboard. Fullscreen view voor op een groot scherm. | 1 u |

**Wat dit oplevert:** Het team ziet real-time hoe ze presteren. Management ziet welke consultants moeten worden gecoacht. Deal closures worden gevierd op de TV. Excel-rapportages verdwijnen.

---

## 2. Placements · 18 uur

De Placements-module is het kloppend hart van FORZ OS: alle deals lopen hier doorheen. Dit is waar deal-data wordt vastgelegd, gevalideerd wordt, goedgekeurd en doorgezet naar alle andere systemen.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Deal intake** | Volledig intake-formulier voor placements: client legal info (KvK, BTW, address, invoice email, PO), alle 4 contracttypes (Freelancer / External Payroll met Yellowstone NL + Northern Partners DK dropdown + prefill / External Company / FORZ Payroll stub), commission split engine met 25%-blokken (default 50/50 maar volledig flexibel), FORZ-contract conditionele logica met signatory velden. | 8 u |
| **Approval flow** | State machine: Draft → Pending Approval → Approved → Synced → Active → Closed. Rolgebaseerde rechten: Consultant maakt + submit, Admin/Manager/Founder kan approven. Audit trail. Volledige change-approval: termination, non-starter, rate change, hours change, end-date, client data, commission split, hiring manager, met impact preview. | 5 u |
| **Bullhorn sync** | Tweerichtings sync met Bullhorn: read van candidates/jobs/clients voor selectie in intake form, write van approved placements terug naar Bullhorn, én pull van activity notes (calls, meetings, intakes) die de Analytics-module voedt. OAuth authenticatie, rate limit handling, retry logic. | 5 u |

**Wat dit oplevert:** Eén centrale plek waar deals worden ingevoerd, goedgekeurd en gemonitord. Geen invoicing-fouten meer door verkeerde client-namen. Consultants kunnen niet meer direct integraties triggeren, alleen na admin-approval.

---

## 3. Legal Contracts · 10 uur

De Legal Contracts-module beheert alle contracten met kandidaten, klanten, freelancers en payroll-partners. Gekoppeld aan DocuSign voor digitale ondertekening en met een centraal archief voor compliance.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Contract generation** | Template-engine met auto-fill vanuit placement data. Templates voor freelancer agreement, client agreement, extension, amendment en termination. Token-based field mapping zodat templates eenvoudig aangepast kunnen worden door FORZ-jurist. | 6 u |
| **DocuSign status** | Real-time status van elk contract: sent, viewed, signed, completed, declined. DocuSign Connect webhook integratie voor live updates. JWT Grant authenticatie en retry logic. | 3 u |
| **Contract archive** | Centraal archief van alle ondertekende en lopende contracten. Zoekfunctie op kandidaat, klant, contracttype, datum. Expiration tracking met alerts vooraf. | 1 u |

**Wat dit oplevert:** Contracten worden in seconden gegenereerd in plaats van handmatig opgesteld. Geen verloren contracten meer. Volledig audit trail voor compliance en accountantsdoeleinden.

---

## 4. Contractor Book · 8 uur

De Contractor Book is jullie operationele cockpit: één overzicht van alle huidige en ex-contractors, met financiële prestaties en (cruciaal) wie bijna afloopt zodat extensions tijdig kunnen worden besproken.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Active contractors** | Volledige lijst actieve contractors met status, klant, recruiter, contracttype, start- en einddatum. Kleurcodering op einddatum (groen >3mnd, geel <3mnd, oranje <2mnd, rood <1mnd) voor directe risico-zichtbaarheid. Filterable en sorteerbaar. | 3 u |
| **Ex-contractors** | Filterbare tab binnen Active Contractors met afgeronde placements en reden van beëindiging. Voor historische analyse en re-engagement. | 1 u |
| **Ending soon tracking** | Dedicated dashboard voor contractors die binnen 1, 2 of 3 maanden aflopen. Met extension queue, automatische reminders en owner-actiepunten. Helpt jullie retention te maximaliseren. | 2 u |
| **GP overview** | GP per contractor zichtbaar in detail-view, plus rollups per recruiter en per klant. Aggregaties berekend op basis van placement-data en self-billing facturen. | 2 u |

**Wat dit oplevert:** Jullie zien in één oogopslag welke contractors verlengd moeten worden, wat ze opleveren, en waar het risico zit. Geen verrassende einddatums meer.

---

## 5. Timesheets · 17 uur

Volledige vervanging van TimeChimp. Eigen urenregistratie met approval flows, self-billing en doorzet naar de facturatie-pipeline. Geen TimeChimp-abonnement meer.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Time registration** | Day-view en week-view voor consultants om uren in te voeren. Mobile-responsive zodat het ook onderweg werkt. Validatie op overlappende uren, max-hours per dag, en placement-status. Bulk-entry voor terugkijkende registratie. | 5 u |
| **Approval** | Client approval flow via magic-link email (geen login nodig voor klant). Reminder engine voor uitstaande approvals. Lock periods per maand zodat goedgekeurde uren niet meer worden gewijzigd. Audit trail per goedkeuring. | 5 u |
| **Self-billing** | Automatische self-billing invoice generatie na approval voor freelancers. PDF-generatie met FORZ branding, opslag in archief, automatische verzending naar freelancer per email. BTW-handling per contracttype. | 5 u |
| **Invoice preparation** | Voorbereiding van klant-facturen op basis van goedgekeurde uren. Aggregatie per klant en periode. Concept-facturen worden via WeFact-sync klaargezet voor de Finance-module. | 2 u |

**Wat dit oplevert:** Geen TimeChimp meer. Geen handmatige self-billing PDF's meer. Klanten keuren uren goed via een simpele email-link zonder login. Facturen staan automatisch klaar in WeFact.

---

## 6. Commissions · 14 uur

Volledige vervanging van het Excel commissie-systeem. Event-driven engine die automatisch hercalculeert bij rate changes, terminations en extensions. Geen Excel-fouten meer.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Commission forecast** | Voorspelde commissies per consultant en resourcer op basis van actieve placements. Per maand, kwartaal en jaar. Inclusief verwachte extensions. Helpt consultants zien wat ze "in de pijplijn" hebben. | 5 u |
| **Realized commissions** | Gerealiseerd commissies op basis van daadwerkelijk gefactureerde en betaalde uren. Event-driven recalc: bij rate change cascadeert dit automatisch door alle gerelateerde commissies. Margin calc per consultant en resourcer. | 6 u |
| **Adjustments** | Handmatige aanpassingen door admin met audit trail. Retroactieve correcties die volledig doorlopen naar de Finance-module. Bonussen, malus, eenmalige uitkeringen. | 3 u |

**Wat dit oplevert:** Commissies kloppen automatisch, ook bij wijzigingen achteraf. Consultants zien transparant wat ze hebben verdiend en gaan verdienen. Geen Excel-discussies meer.

---

## 7. Finance · 15 uur

De Finance-module is jullie business intelligence layer. Alle financiële data, marges, cashflow en facturatie via één dashboard, met directe WeFact-sync.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Finance dashboard** | Executive dashboard met alle financiële kerncijfers: omzet, kosten, GP, cashflow op één scherm. Per dag/maand/jaar/klant/sector. Visualisaties met trends. Eerste scherm voor management bij ochtend-check. | 4 u |
| **Sales invoices** | Volledig overzicht van uitgaande facturen: concept, verzonden, betaald, openstaand, verlopen. Filterable op klant, periode, status. Drill-down naar individuele facturen en placements. | 3 u |
| **Purchase invoices** | Volledig overzicht van inkomende facturen (freelancer self-billing, payroll-partners, leveranciers). Status tracking, goedkeuringsworkflow voor betaling, koppeling aan placements voor margin-berekening. | 2 u |
| **Margin / GP** | Margin en Gross Profit analyse per placement en per klant. Weekly en monthly views. Vergelijking met targets. | 2 u |
| **Cashflow** | Overzicht van openstaande facturen en verwachte ontvangsten op basis van betaaltermijnen. Aging analysis per klant. | 2 u |
| **WeFact sync** | Tweerichtings integratie met WeFact: debtors, facturen en credit notes. Concept-facturen vanuit Timesheets-module worden automatisch in WeFact aangemaakt. Payment-status wordt opgehaald uit WeFact terug naar Finance dashboard. IP-whitelist routing via Convex actions. | 2 u |

**Wat dit oplevert:** Eén centrale financiële cockpit. Real-time inzicht in margin per placement, cashflow en welke klanten te laat betalen. Volledig gekoppeld aan WeFact voor de daadwerkelijke facturatie.

---

## Fundament & Cross-cutting · 13 uur

Naast de modules zelf is er onzichtbaar fundament-werk nodig om de applicatie veilig, schaalbaar en stabiel te maken. Deze uren zitten bij de prijs in maar zijn de "plumbing" die alles laat werken.

| Onderdeel | Wat wordt gebouwd | Uren |
|---|---|---|
| **Project setup & infrastructuur** | Convex backend project, TanStack Start frontend, Cloudflare deployment, CI/CD via GitHub Actions, environments (dev/staging/prod). | 2 u |
| **Authenticatie & rechten** | 6-rollen model (Consultant / Resourcer / Manager / Admin / Finance / Founder) met eigendoms-scoping. Consultants zien alleen eigen data in Commissions/Timesheets/Placements. Login + session management. | 3 u |
| **Database schema & data model** | Schema-ontwerp voor alle entiteiten: placements, candidates, clients, contractors, timesheets, commissions, invoices, contracts, audit log. Relaties en indices. | 2 u |
| **Design system & UI primitives** | Op maat gemaakte component library met FORZ huisstijl (kleur, typografie, logo) bovenop Tailwind/shadcn fundament. Responsive design voor desktop én mobiel. Consistente look & feel door alle modules. | 2 u |
| **Audit logging & event systeem** | Centraal audit log voor alle wijzigingen (wie, wat, wanneer). Event-driven architectuur zodat modules elkaar netjes triggeren (bv. placement.approved → commission.created). | 2 u |
| **Testing, deployment & oplevering** | End-to-end testing van kritische flows, productie-deployment, training (2× 1,5u sessie), admin-documentatie en technische handover. | 2 u |

---

## Totaal & investering

| | | |
|---|---|---|
| Module 1: Analytics | 5 sub-modules | **10 u** |
| Module 2: Placements | 3 sub-modules | **18 u** |
| Module 3: Legal Contracts | 3 sub-modules | **10 u** |
| Module 4: Contractor Book | 4 sub-modules | **8 u** |
| Module 5: Timesheets | 4 sub-modules | **17 u** |
| Module 6: Commissions | 3 sub-modules | **14 u** |
| Module 7: Finance | 6 sub-modules | **15 u** |
| *Fundament & cross-cutting* | *6 onderdelen* | *13 u* |
| **TOTAAL UREN** | **28 sub-modules** | **105 u** |
| Effectief uurtarief (105 u × € 76,19) | | € 8.000,- |
| **VASTE PRIJS (excl. 21% BTW)** |  | **€ 8.000,-** |

**Inclusief BTW:** € 9.680,- (21% BTW = € 1.680,-)

---

## Wat zit er standaard bij

- **Volledige eigendom van de code: FORZ krijgt vanaf dag 1 toegang tot de GitHub repository**
- Productie-deployment op Cloudflare met Convex backend, geen vendor lock-in
- Technische documentatie + admin-handleiding voor FORZ
- 2 trainingssessies van 1,5 uur na oplevering
- 30 dagen garantie op kritische bugs na oplevering
- Vaste prijs, geen verrassingen achteraf bij scope binnen deze offerte

### Wat FORZ aanlevert

Om soepel te kunnen starten, vraag ik FORZ de volgende zaken voor kick-off klaar te zetten:

- Bullhorn API key + system user (voor Placements sync + activity notes pull)
- WeFact API key + IP-whitelist toegang (voor Finance sync)
- DocuSign Integration Key + RSA keypair (voor Legal Contracts)
- Contracttemplate teksten (definitieve versies door FORZ-jurist)
- Logo + huisstijl assets (kleuren, fonts, logo)
- Beschikbaarheid van een vaste contactpersoon ~2 uur per week voor reviews

---

## Fase 2: ideeën voor later

**Belangrijk:** onderstaande punten zijn **niet inbegrepen** in deze offerte. Het is een lijstje van uitbreidingen waar we in fase 1 een goede basis voor leggen, maar die we bewust later oppakken zodra FORZ OS in productie staat en jullie zien wat er echt meerwaarde toevoegt. Voor fase 2 stuur ik te zijner tijd een aparte offerte met scope en uren.

### Analytics & gamification
- Uitgebreide gamification: badges, streaks, achievements, weekly challenges
- Big Screen Mode polish: 4K-optimalisatie, custom animaties bij deal closures, geluidseffecten
- Predictive analytics: forecasting per consultant op basis van historische conversion
- Custom dashboards die managers zelf kunnen samenstellen

### Finance & reporting
- Uitgebreide 30/60/90 dagen cashflow forecast met scenario-modeling
- Multi-dimensionale margin rollups (sector, recruiter, klant-segment, contract-type)
- Automatische rapportage-export naar boekhouder per maand
- Klant-portal waar klanten hun openstaande facturen en uren kunnen inzien

### Workflow & automatisering
- Email-notificaties bij approval, contract sign, timesheet submit, end-date approaching
- Slack-integratie voor real-time deal announcements en alerts
- Automatische extension-reminders 60/30/14 dagen voor end-date
- Document AI: contracten parsen en data automatisch invullen

### Operationeel
- Mobile app (native iOS/Android) voor timesheets en activity logging onderweg
- Diepere Yellowstone en Northern Partners integratie met echte API-uitwisseling
- FORZ Payroll module volledig uitwerken (nu alleen stub-veld)
- Training-portaal voor nieuwe consultants en onboarding-flow
- Geavanceerde audit logging met search en filtering (Slack-style audit trail)

**Hoe gaan we hiermee om?**

Tijdens fase 1 verzamelen we feedback van het team over wat het meest gemist wordt. Op basis daarvan prioriteren we samen wat er in fase 2 komt. Je betaalt nooit voor iets dat we niet hebben afgesproken.

---

## Aanvaarding

Om te starten heb ik nodig:

- **Een ondertekend exemplaar van deze offerte**
- Ondertekende NDA + DPA (lever ik aan)
- Kick-off meeting ingepland (90 minuten)

Na ontvangst start ik binnen **5 werkdagen** met de bouw.

### Akkoord

| Voor FORZ Consultancy B.V. | Voor Brandocean |
|---|---|
| Naam: ____________________ | Naam: ____________________ |
| Functie: __________________ | Functie: __________________ |
| Datum: ____________________ | Datum: ____________________ |
| Handtekening: _____________ | Handtekening: _____________ |

---

Met vriendelijke groet,

**Brandocean**
Rooswijck 5A · 1081 AJ Amsterdam
info@brandocean.nl · 06 4132 4721 · KvK 86415441

---

*Deze offerte is geldig tot 9 juni 2026. Vaste prijs van € 8.000,- excl. 21% BTW (105 uur werk, effectief tarief € 76,19 per uur). Bij scope-uitbreiding tijdens de bouw volgt een meerwerk-offerte ter goedkeuring vooraf. Op deze offerte zijn mijn algemene voorwaarden van toepassing.*
