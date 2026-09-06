# 📖 Radovedni — revija stripov, ilustracij in zgodb

Radovedni je izobraževalna in razvedrilna spletna revija za mlade in osnovnošolce.
Namenjena je objavljanju **stripov** (ki jih bralec bere panel za panelom, v formatu
9:16, prijaznem za telefon) in **ilustriranih zgodb za branje** (z besedilom, slikami
vmes in galerijo na koncu).

Stran je narejena kot **statična spletna stran** (HTML/CSS/JS brez potrebe po
strežniku ali gradnji) in deluje odlično na **GitHub Pages**.

---

## 🚀 Kako objaviti stran na GitHub Pages

1. Ustvari nov **javni** repozitorij na GitHubu, npr. `radovedni` (lahko tudi
   `<uporabnik>.github.io`, če želiš, da bo to tvoja glavna stran).
2. Naloži vso vsebino te mape (`index.html`, `style.css`, `app.js`, `articles.json`, ...)
   v koren repozitorija (lahko z "Add file → Upload files" na GitHubu, ali z gitom).
3. Pojdi v **Settings → Pages** repozitorija, pod "Build and deployment" izberi
   vejo (branch), npr. `main`, in mapo `/ (root)`. Shrani.
4. Po nekaj minutah bo stran dostopna na `https://<uporabnik>.github.io/<repo>/`.

To je to! Stran samodejno prebere `articles.json` in prikaže vse članke.

---

## ✍️ Kako dodajati nove stripe in zgodbe

Na strani klikni ikono ključa 🔑 (zgoraj desno) za **uredniško prijavo**.
Ob prvi prijavi vnesi novo geslo — to geslo se odtlej uporablja za prijavo v tem
brskalniku (shranjeno lokalno, v `localStorage`).

Ko si prijavljen kot urednik, se prikaže rumena vrstica z gumbom **„+ Nov članek“**.

### Objava neposredno na GitHub (priporočeno)

Da lahko novi članki samodejno pristanejo v `articles.json` v tvojem GitHub
repozitoriju (in se torej takoj prikažejo vsem obiskovalcem), moraš enkrat
nastaviti povezavo:

1. Klikni na ⚙️ **Nastavitve** (vidno, ko si prijavljen kot urednik).
2. Ustvari **GitHub Personal Access Token**:
   - Pojdi na GitHub → **Settings → Developer settings → Personal access tokens
     → Fine-grained tokens → Generate new token**.
   - Izberi svoj repozitorij (`Repository access` → `Only select repositories`
     → izberi `radovedni`).
   - Pod **Permissions** nastavi **Contents: Read and write**.
   - Ustvari žeton in ga kopiraj (prikaže se samo enkrat!).
3. V nastavitvah strani vnesi:
   - **GitHub žeton** (token iz prejšnjega koraka)
   - **Lastnik repozitorija** (tvoje uporabniško ime na GitHubu)
   - **Ime repozitorija** (npr. `radovedni`)
   - **Veja** (običajno `main`)
   - **Pot do articles.json** (privzeto `articles.json`)
4. Klikni **„Preveri povezavo“**, nato **„Shrani nastavitve“**.

Od zdaj naprej se vsak nov članek, urejanje ali brisanje **samodejno commita**
neposredno v tvoj GitHub repozitorij (datoteka `articles.json`) — brez ročnega
nalaganja datotek!

> ⚠️ Žeton se shrani samo lokalno v tvojem brskalniku (localStorage) in se nikoli
> ne pošlje kam drugam kot na GitHub API. Kljub temu ga ne deli z drugimi in ga
> ne uporabljaj na skupnih/javnih računalnikih.

### Brez GitHub povezave (ročna objava)

Če GitHub povezave ne nastaviš, lahko članke še vedno dodajaš in urejaš —
spremembe pa ostanejo shranjene le lokalno v brskalniku (ne bodo vidne drugim
obiskovalcem). V Nastavitvah lahko kadarkoli klikneš **„⬇ Prenesi articles.json“**
in prenešeno datoteko ročno naložiš v svoj GitHub repozitorij (zamenjaš obstoječo).

---

## 🖼️ Dodajanje slik in stripov

Vse slike (paneli stripov, naslovnice, ilustracije, galerije) se dodajajo **preko
spletnih povezav (URL)**, npr. `https://moja-stran.si/slika.jpg`. Priporočamo brezplačne
storitve za gostovanje slik, kot so imgur.com, ali nalaganje slik v svoj GitHub
repozitorij (v mapo `assets/`) in uporabo GitHubove "raw" povezave.

### Format stripov (9:16)

Ko dodajaš nov strip, dodajaš **panel za panelom** — vsak panel je ena slika z
lastno URL povezavo. Priporočen format je **9:16** (pokončen, kot zaslon telefona),
da je branje na mobilnem telefonu čim bolj naravno — bralec panel enostavno
prelista s tapom ali podrsom v levo/desno. Podprti so tudi drugi formati
(kvadrat 1:1, 4:5, 16:9 ali izvirno razmerje slike).

### Format zgodb za branje

Zgodbe so sestavljene iz poljubnega zaporedja **odstavkov besedila** in **slik**
(z neobveznim podnapisom), pod celotnim člankom pa se lahko prikaže še
**galerija** dodatnih slik (npr. skic, fotografij, ilustracij).

---

## 🗂️ Rubrike

Privzete rubrike: Matematika, Fizika, Kemija, Biologija, Geografija, Zgodovina,
Slovenščina in Razvedrilo. V Nastavitvah lahko urednik kadarkoli **doda novo
rubriko** ali **izbriše obstoječo** (če je rubrika v uporabi, aplikacija opozori
pred brisanjem).

---

## 📁 Struktura projekta

```
radovedni/
├── index.html        (glavna stran, vsi modali za urejanje)
├── style.css          (celoten dizajn)
├── app.js             (vsa logika: branje, urejanje, GitHub objava)
├── articles.json      (vsi članki + nastavitve rubrik/naslova)
└── README.md
```

`articles.json` ima obliko:

```json
{
  "settings": {
    "title": "Radovedni",
    "subtitle": "...",
    "categories": ["Matematika", "Fizika", "..."]
  },
  "articles": [
    {
      "id": "...",
      "type": "strip",
      "category": "Fizika",
      "title": "...",
      "author": "...",
      "summary": "...",
      "coverImage": "https://...",
      "date": "2026-09-06",
      "panels": [
        { "url": "https://...", "format": "9:16" }
      ]
    },
    {
      "id": "...",
      "type": "zgodba",
      "category": "Biologija",
      "title": "...",
      "author": "...",
      "summary": "...",
      "coverImage": "https://...",
      "date": "2026-09-06",
      "content": [
        { "type": "text", "value": "..." },
        { "type": "image", "url": "https://...", "caption": "..." }
      ],
      "gallery": ["https://...", "https://..."]
    }
  ]
}
```

---

## 🧪 Lokalno testiranje

Ker stran uporablja `fetch()` za nalaganje `articles.json`, je ne moreš samo
odpreti kot lokalno datoteko (`file://`) — brskalnik bo blokiral zahtevo. Namesto
tega zaženi preprost lokalni strežnik v mapi projekta, npr.:

```bash
python3 -m http.server 8000
```

nato v brskalniku odpri `http://localhost:8000`.

---

Uživajte pri ustvarjanju in objavljanju novih stripov ter zgodb! ✏️🔎
