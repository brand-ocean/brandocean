# FORZ OS — Herziene Offerte Fase 1

---

| | |
|---|---|
| **Aan:** | FORZ Consultancy B.V. |
| **T.a.v.:** | Ben Roz |
| **Datum:** | 16 mei 2026 |
| **Geldig tot:** | 12 juni 2026 |
| **Tarief voor FORZ:** | € 100,- per uur |
| **Effectief uurtarief:** | **€ 76,09 per uur** |
| **Vaste prijs:** | **€ 8.750,- (excl. 21% BTW) — € 10.587,50 incl. BTW** |
| **Uren:** | **115 uur** |

---

## Hi Ben,

Bedankt voor de uitgebreide herziening van de scope. De keuze om Commissions, Analytics, gamification en de volledige CRM-replacement door te schuiven naar latere fases maakt Fase 1 strakker en logischer: één operationele rode draad van placement → admin approval → starter dossier → contracten → contractor book → timesheets → self-bill → finance, in plaats van zeven brede modules tegelijk.

Tegelijk komt er ook nieuwe scope bij. Vooral het Starter Dossier / Onboarding Portal is een volwaardige nieuwe hoofdmodule (kandidaat- en klantportaal met magic-links, document-validatie, expiration tracking, 8-status workflow). Daarnaast wordt Extensions een zelfstandige workflow in plaats van een simpele change request, en komt er een tweede flow erbij voor External Client Timesheets (Flow B) met handmatige upload + admin-validatie van PDF/Excel/CSV/screenshot.

Per saldo levert dat 10 extra uren op ten opzichte van de offerte van 13 mei. De effectieve prijs voor jullie blijft op hetzelfde uurtarief (**€ 76 per uur** effectief, tegenover € 100 nominaal) — geen verborgen opslag, gewoon eerlijke uitbreiding van de scope tegen hetzelfde tarief. Een deel van de extra scope vangen we sowieso op door shared infrastructure tussen modules (één auth/magic-link laag, één email engine, één state machine pattern, één audit log voor alle modules).

Eén afbakening expliciet voor onze gezamenlijke duidelijkheid: deze offerte dekt de scope zoals jij hem op 15 mei hebt uitgewerkt. Komt er tijdens de bouw scope bij die daar materieel buiten valt — bijvoorbeeld nieuwe modules of fundamentele datamodel-changes — dan bespreken we dat als losse mini-scope. Dat houdt beide kanten beschermd.

**Scope: clean build vanaf placement-data**

We starten met een clean build, zonder migratie van historische data uit TimeChimp of Excel. Bullhorn blijft de bron voor candidates, clients, jobs en hiring managers; FORZ OS bouwt daar bovenop. Vanaf go-live registreren consultants placements direct in FORZ OS, de approved placement wordt teruggeschreven naar Bullhorn.

## Uren-overzicht per module

| # | Module | Sub-modules | Uren |
|---|---|---|---|
| 1 | Placements (incl. Extensions & Change Requests) | 5 | **24 u** |
| 2 | Starter Dossier / Onboarding Portal | 7 | **26 u** |
| 3 | Legal Contracts | 3 | **10 u** |
| 4 | Contractor Book | 5 | **10 u** |
| 5 | Timesheets (Flow A + Flow B) | 5 | **22 u** |
| 6 | Finance / WeFact Sync | 4 | **8 u** |
|  | *Fundament & cross-cutting* | *6* | *15 u* |
| | **TOTAAL** | **35** | **115 u** |

---

## 1. Placements · 24 uur

De Placements-module is het kloppend hart van FORZ OS. Tegenover de vorige offerte zit er meer detail in de intake (extra velden voor compliance/invoicing) en is Extensions nu een zelfstandige workflow geworden in plaats van een simpele change request — dat scheelt later veel issues met audit en rapportage.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Deal intake** | Volledig intake-formulier met alle 4 contract setup types (Freelancer / External Payroll met Yellowstone NL + Northern Partners DK prefill / External Company / FORZ Payroll als future-disabled stub). Uitgebreide velden: client legal info (KvK, BTW, address, invoice email, finance contact, voorkeurstaal, PO, payment term, billing frequency, notice period), FORZ-contract vs klantcontract logica, signatory velden, G-rekening waar relevant, projectlocatie en assignment description. | 9 u |
| **Approval flow** | State machine: Draft → Pending Approval → Approved → Synced → Active → Extension Pending / Extension → Completed / Terminated / Non-Starter → Closed. Rolgebaseerde rechten: consultant maakt + submit, alleen Admin/Manager/Founder kan approven en integraties triggeren. Audit trail per transitie. | 4 u |
| **Extensions (NIEUW als aparte workflow)** | Parent-child placement structuur: originele placement wordt Completed, extension is een gekoppelde nieuwe placement met eigen rates, dates, PO en signatory indien nodig. Extension history (1e, 2e, 3e extension) zichtbaar in Contractor Book. Contract amendment trigger wanneer rates/scope wijzigen. | 6 u |
| **Change requests** | Volledige change requests na approval voor termination, non-starter, rate change, hours change, end-date, client data, candidate/company data, commission split (data only in Fase 1), hiring manager. Impact preview welke systemen beïnvloed worden. Admin-only approval. Audit log. | 2 u |
| **Bullhorn sync** | Tweerichtings sync: read van candidates / jobs / clients / hiring managers voor selectie in intake form, write van approved placements terug naar Bullhorn inclusief Bullhorn Placement ID koppeling. OAuth, rate limit handling, retry logic. | 3 u |

**Wat dit oplevert:** Eén centrale plek waar deals worden ingevoerd, goedgekeurd en gemonitord. Geen invoicing-fouten meer door verkeerde client-namen. Consultants kunnen geen integraties triggeren, alleen na admin-approval. Extensions zijn traceerbaar en audit-proof, geen losse Excel-aantekeningen meer.

---

## 2. Starter Dossier / Onboarding Portal · 26 uur — NIEUW

Volledig nieuwe hoofdmodule. Na placement approval maakt FORZ OS automatisch een starter dossier aan en stuurt mails naar kandidaat en klant met beveiligde links waarop ze hun gegevens en documenten kunnen aanleveren. Centraal opgeslagen, met document-validatie en expiration tracking.

Principe: geen actieve contractor zonder compleet starter dossier, tenzij admin/manager/founder override.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Kandidaatportaal** | Beveiligde magic-link mail naar kandidaat. Portal zonder login waarop kandidaat formulieren invult (NAW, BSN, IBAN, geboortedatum, nationaliteit) en documenten uploadt (ID, CoC indien freelancer, verzekeringen, KvK-uittreksel). Multi-step form met save-and-resume. NL + EN. | 6 u |
| **Klantportaal** | Soortgelijke magic-link flow voor klant: KvK-gegevens, BTW, factuuradres, financiële contactpersoon, signing officer details, PO-nummer indien van toepassing. Pre-fill vanuit Bullhorn waar mogelijk. | 4 u |
| **Document upload & storage** | Versleutelde document storage (Cloudflare R2 of Convex file storage). Per document: type, upload date, expiration date waar relevant, uploaded by. Versie-historie bij re-uploads. | 3 u |
| **Document validatie-regels** | Configureerbare validatie per documenttype: KvK-uittreksel max 3 maanden oud, ID nog niet verlopen, verzekeringspolis loopt nog x maanden door, BTW-nummer formaat-check. Auto-flag bij issues. Admin override mogelijk. | 4 u |
| **Status workflow** | 8-status workflow voor het dossier (Created → Sent → In Progress → Submitted → Under Review → Issues → Approved → Active). Per status: wie kan welke acties uitvoeren, welke notificaties worden getriggerd. | 3 u |
| **Email notificaties** | Trigger-based mails: dossier aangemaakt, reminder na X dagen, klant moet nog aanvullen, dossier compleet → admin review, issues → kandidaat aanvullen. Templated, NL+EN, brand-consistent. | 2 u |
| **Admin review-scherm** | Centrale view voor admin om alle open dossiers, dossiers met issues, en bijna-startende contractors zonder compleet dossier te zien. Click-through naar individueel dossier met alle uploads, status van velden, en approval-action. | 4 u |

**Wat dit oplevert:** Compliance is geborgd vóór startdatum, niet erna. Geen onvolledige dossiers meer in mappen op de drive. Documenten met expiration dates worden actief gemonitord. Kandidaat en klant hebben een professionele, branded onboarding-ervaring met magic-links — geen gedoe met accounts of wachtwoorden.

---

## 3. Legal Contracts · 10 uur

Automatisering van de contractgeneratie na approved placement. Per contract setup type wordt het juiste template gegenereerd, naar de juiste partijen gestuurd via DocuSign, en status real-time bijgehouden in FORZ OS.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Contract generation** | Templated PDF generation vanuit FORZ-templates (NL + EN Interim Staffing Service Agreement, NL Consultant Agreement). Variabelen automatisch ingevuld vanuit placement: partijen, rates, dates, scope, G-rekening, notice period, etc. Verschillende templates per contract setup type. | 6 u |
| **DocuSign status sync** | DocuSign Connect webhook voor real-time status: Sent → Delivered → Signed door iedere partij → Completed. Status zichtbaar per contract in FORZ OS. RSA keypair-based JWT auth. | 3 u |
| **Contract archief** | Getekende contracten centraal opgeslagen per placement, per contractor, doorzoekbaar. Direct opvraagbaar bij verlengingen of disputes. | 1 u |

**Wat dit oplevert:** Contracten zijn binnen minuten ondertekend in plaats van dagen. Geen handmatige Word-merge meer. Volledig audit trail van wie wanneer ondertekend heeft.

---

## 4. Contractor Book · 10 uur

Realtime overzicht van alle actieve en oud-contractors, met focus op proactieve signalering: welke contracten lopen binnenkort af, welke moeten worden verlengd, en wat is de GP per contractor.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Actieve contractors** | Lijst met filters (consultant, klant, contract type, einddatum, GP-range). Per contractor: huidige placement, rate, GP, dossier-status, dagen tot einddatum. | 3 u |
| **Ex-contractors** | Historie van afgeronde / terminated contractors met reden van eind en optie tot re-engagement. | 1 u |
| **Ending soon tracker** | Configureerbare attentiezones: < 14 dagen / < 30 dagen / < 60 dagen tot einde contract. Visuele indicators in lijst. | 2 u |
| **Weekly alert engine** | Wekelijkse mail naar consultant + admin team met overzicht van placements die binnen X dagen aflopen. Per placement: actie nodig (verlengen, terminaten, evalueren). | 1 u |
| **Extension history & GP-tracking** | Per contractor: 1e, 2e, 3e extension zichtbaar met rate-verloop en cumulatieve GP over hele engagement-historie. | 3 u |

**Wat dit oplevert:** Geen verlengingen meer die last-minute geregeld worden. Consultants weten 30 dagen vooruit waar actie nodig is. Margin-zicht per contractor over de tijd, niet alleen per losse placement.

---

## 5. Timesheets · 22 uur

Twee parallelle flows voor uren-registratie: Flow A voor contractors waar FORZ direct factureert (interne registratie + approval), Flow B voor external client timesheets (klant levert uren aan in eigen format, admin valideert).

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Tijdregistratie (Flow A)** | Wekelijkse uren-invoer door contractor: dagen, uren, project-context, eventuele opmerkingen. Mobile-friendly. Save draft, submit voor approval. | 5 u |
| **External upload (Flow B)** | Upload-interface voor klant-timesheets in willekeurig format (PDF / Excel / CSV / screenshot). Bestand wordt centraal opgeslagen en gekoppeld aan placement-periode. Geen OCR/AI parsing in Fase 1 — dat staat in Phase 2. | 3 u |
| **Approval flow** | Approval door client manager (Flow A) of admin (Flow B). State machine: Submitted → Approved / Rejected (met reden) → Locked voor invoicing. Per regel bij Flow A, per geüploade timesheet bij Flow B. | 5 u |
| **Self-billing** | Genereer self-billing invoice naar leverancier (freelancer / external company) op basis van approved hours × agreed rate. PDF + email. Status tracking: Generated → Sent → Paid. | 5 u |
| **Invoice prep voor klant** | Aggregatie van approved hours per klant per periode, klaar voor sync naar WeFact als sales invoice. | 4 u |

**Wat dit oplevert:** Uren-flow van registratie tot self-bill tot klant-invoice in één systeem. Geen kopieer-werk tussen Excel en TimeChimp en WeFact meer. External client timesheets gestructureerd opgeslagen, basis voor latere OCR/AI parsing in Phase 2.

---

## 6. Finance / WeFact Sync · 8 uur

Lichtgewicht finance-laag in Fase 1: zicht op outstanding invoices, sales/purchase status, en sync met WeFact. Geen volledige BI of forecasting — dat is bewust Phase 2.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Finance dashboard** | Overzicht van open sales invoices, open purchase invoices, MTD revenue, MTD GP. Doorklik naar detail. | 3 u |
| **Sales invoices** | Sync van klant-invoices naar WeFact: aanmaken, status (Sent / Paid / Overdue) terug naar FORZ OS. | 2 u |
| **Purchase invoices** | Inkoop-invoices (self-billing naar leveranciers, payroll-partner facturen) gesynchroniseerd met WeFact. | 1 u |
| **WeFact sync layer** | Generieke sync layer met retry / error handling. IP-whitelist voor productie. | 2 u |

**Wat dit oplevert:** Live zicht op cash-positie binnen FORZ OS, zonder WeFact te hoeven openen. Boekhouder werkt verder ongestoord in WeFact.

---

## 7. Fundament & cross-cutting · 15 uur

De onderliggende laag waar alle modules op draaien. Eenmalig opzetten betekent dat extra modules in Phase 2 sneller te bouwen zijn.

| Sub-module | Omschrijving | Uren |
|---|---|---|
| **Project setup** | Repo, monorepo structuur, CI/CD pipeline, environment management (dev / staging / prod), secret management. | 2 u |
| **Auth & 6-role permissions** | Magic-link auth voor portals (kandidaat / klant), email+password voor interne users. Six-role model: Consultant / Resourcer / Admin / Finance / Manager / Founder. Role-based én ownership-based: consultants zien alleen eigen placements, contractors, timesheets en documenten. Granulair per module / per actie. | 3 u |
| **Database schema** | Convex schema design voor alle modules: placements, extensions, contractors, dossiers, documenten, timesheets, invoices. Relaties, indexes, soft deletes. | 3 u |
| **Design system** | Tailwind + shadcn base components, FORZ-brand kleuren / typografie, consistent UI-patroon over alle modules. NL+EN i18n setup. | 2 u |
| **Audit logging & event bus** | Centrale audit log waar elke state-transition, approval, en mutatie geregistreerd wordt. Event bus tussen modules (placement.approved → trigger dossier creation, etc.). | 3 u |
| **Testing & deployment** | E2E tests voor critical flows, monitoring (Cloudflare Analytics + Sentry voor errors), deployment runbook. | 2 u |

**Wat dit oplevert:** Alles wat in Phase 2 gebouwd wordt (Commissions engine, volledige Analytics, Gamification, OCR voor timesheets) bouwt voort op deze fundering — dus die fases worden goedkoper en sneller dan Phase 1.

---

## Wat FORZ aanlevert

Om soepel te kunnen starten, vraag ik FORZ de volgende zaken voor kick-off klaar te zetten:

- Bullhorn API key + system user (voor Placements sync + activity notes pull)
- WeFact API key + IP-whitelist toegang (voor Finance sync)
- DocuSign Integration Key + RSA keypair (voor Legal Contracts)
- Contracttemplate teksten (definitieve versies door FORZ-jurist)
- Logo + huisstijl assets (kleuren, fonts, logo)
- Beschikbaarheid van een vaste contactpersoon ~2 uur per week voor reviews

## Wat zit er standaard bij

- Volledige eigendom van de code: FORZ krijgt vanaf dag 1 toegang tot de GitHub repository
- Productie-deployment op Cloudflare met Convex backend, geen vendor lock-in
- NDA + DPA (verwerkersovereenkomst) bij contractondertekening
- Wekelijkse demo-sessie van 30 minuten tijdens de bouw
- Technische documentatie + admin-handleiding voor FORZ
- 2 trainingssessies van 1,5 uur na oplevering
- Vaste prijs, geen verrassingen achteraf bij scope binnen deze offerte

## Fase 2: ideeën voor later

Belangrijk: onderstaande punten zijn niet inbegrepen in deze offerte. Het is een lijstje van uitbreidingen waar we in Fase 1 een goede basis voor leggen, maar die we bewust later oppakken zodra FORZ OS in productie staat en jullie zien wat er echt meerwaarde toevoegt. Voor Fase 2 stuur ik te zijner tijd een aparte offerte met scope en uren.

### Analytics & gamification

- Uitgebreide gamification: badges, streaks, achievements, weekly challenges
- Big Screen Mode polish: 4K-optimalisatie, custom animaties bij deal closures, geluidseffecten
- Predictive analytics: forecasting per consultant op basis van historische conversion
- Custom dashboards die managers zelf kunnen samenstellen

### Commissions & finance

- Commissions engine (25% block-structuur, tier-progressie, payouts)
- Uitgebreide 30/60/90 dagen cashflow forecast met scenario-modeling
- Multi-dimensionale margin rollups (sector, recruiter, klant-segment, contract-type)
- Automatische rapportage-export naar boekhouder per maand
- Klant-portal waar klanten hun openstaande facturen en uren kunnen inzien

### CRM & operations

- Volledige Bullhorn-replacement / eigen CRM
- OCR / AI parsing van external client timesheets (Flow B blijft handmatige upload in Fase 1)

### Hoe gaan we hiermee om?

Tijdens Fase 1 verzamelen we feedback van het team over wat het meest gemist wordt. Op basis daarvan prioriteren we samen wat er in Fase 2 komt. Je betaalt nooit voor iets dat we niet hebben afgesproken.

## Hoe verder?

Eén "ja" is genoeg. Ik stuur je dan de officiële factuur, en zodra de eerste 50% is voldaan start ik binnen 5 werkdagen met de bouw.

Met vriendelijke groet,

Brandocean
