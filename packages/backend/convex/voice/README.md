# Bellen — opzet

De agent belt klantenservices namens Brandocean: providers, leveranciers,
verzekeraars. Het werk dat vooral uit wachten bestaat.

Dit is bewust **niet** klanten bellen. Sinds 1 juli 2026 is de klantrelatie-
uitzondering in art. 11.7 Tw geschrapt en heb je voor commercieel bellen naar
consumenten én zzp'ers vooraf expliciete toestemming nodig. Zelf je eigen
leverancier bellen valt daarbuiten — je bent daar de klant, niet de verkoper.
Wat wél geldt is AI Act art. 50 (sinds 2 augustus 2026): de agent moet hoorbaar
zeggen dat hij een machine is en namens wie hij belt. Dat zit vast in
`prompt.ts:firstMessage` en er is een test die het daar houdt.

## Wat je zelf moet regelen

1. **Twilio-nummer, +31.** Vereist een regulatory bundle met een geverifieerd
   NL-adres — de BV volstaat. Neem een nummer dat je aan Brandocean wilt
   koppelen, want het is het nummer dat in hun systeem belandt.
2. **ElevenLabs Agents account.** Maak een agent aan, koppel het Twilio-nummer,
   en noteer de `agent_id` en de `agent_phone_number_id`.
3. **Post-call webhook** in de ElevenLabs-instellingen op
   `https://<jouw-convex-site>/voice/webhook`. Bewaar het signing secret.

## Environment

```bash
npx convex env set ELEVENLABS_API_KEY          sk_...
npx convex env set ELEVENLABS_AGENT_ID         agent_...
npx convex env set ELEVENLABS_PHONE_NUMBER_ID  phnum_...
npx convex env set ELEVENLABS_WEBHOOK_SECRET   wsec_...
npx convex env set VOICE_CALLER_NAME           "Arin Issa"
npx convex env set VOICE_ORG_NAME              "Brandocean"
```

Zonder deze vier gooit `voice.call.start` meteen `voice_not_configured`, in
plaats van halverwege een gesprek stuk te lopen.

## De drie tools op de agent

Zet ze in het ElevenLabs-dashboard als webhook tools. Elke tool stuurt
`call_token` mee in de body — die waarde komt uit de dynamic variable
`{{call_token}}` die we per gesprek meegeven. Het token opent precies één taak
en vervalt zodra het gesprek eindigt.

| Tool | `POST` | Body | Waarvoor |
|---|---|---|---|
| `get_fact` | `/voice/fact` | `{ call_token, label }` | Eén gegeven ophalen bij verificatie |
| `request_handoff` | `/voice/handoff` | `{ call_token, reason }` | Er moet een mens bij |
| `log_outcome` | `/voice/outcome` | `{ call_token, outcome, resolved }` | Afronden |

Alle drie geven `{ "text": "..." }` terug — dat is wat de agent voorgelezen
krijgt. Ze geven nooit een foutcode terug, want een agent die midden in een
gesprek "500 Internal Server Error" voorleest is erger dan een agent die zegt
dat hij dat gegeven niet heeft.

## Een taak maken en bellen

```ts
const taskId = await createVoiceTask({
  company: "KPN Zakelijk",
  toNumber: "0800 0403",
  goal: "de storing op de zakelijke lijn laten inplannen, liefst deze week",
  constraints: "Geen upgrade, geen nieuw abonnement. Alleen de storing.",
  facts: [
    { label: "klantnummer", value: "..." },
    { label: "postcode", value: "..." },
  ],
});
await startVoiceCall({ taskId });
```

`goal` gaat letterlijk de prompt in, dus schrijf het zoals je het tegen een
stagiair zou zeggen. `constraints` is de grens: alles daarbuiten wordt een
handoff in plaats van een besluit.

## Hoe de gegevens werken

De waarden staan in `voiceTasks.facts` en gaan **niet** mee in de prompt. De
agent moet ze per stuk opvragen, exact op label, en elke keer dat dat gebeurt
wordt `disclosedAt` gezet. Daardoor staat er achteraf precies in de database wat
er over de lijn is gegaan. `list` en `getWithCalls` geven alleen de labels terug,
nooit de waarden.

## Statussen

`draft` → `calling` → `done` | `failed` | `needs_me`.

`needs_me` wint altijd van `done`: als de agent om een mens heeft gevraagd is de
taak niet af, wat hij aan het eind ook rapporteert. Hangt de andere kant op
zonder dat `log_outcome` is aangeroepen, dan zet de webhook de taak op `failed`
in plaats van hem op `calling` te laten staan — anders verdwijnt hij stil uit je
overzicht.

## Eerst testen op jezelf

Zet `toNumber` op je eigen mobiel, geef een onschuldig doel op, en luister of het
Nederlands standhoudt. Dat is de test die telt: niet of de API 200 teruggeeft,
maar of je het een echte medewerker aan zou durven doen.
