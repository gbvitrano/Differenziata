# Raccolta Differenziata in Sicilia

Mappa interattiva della percentuale di raccolta differenziata dei rifiuti urbani nei comuni siciliani, dal 2010 al 2024.

![Screenshot della mappa](img/italy.png)

---

## Demo

Apri `index.html` con un server locale:

```bash
cd Differenziata
python -m http.server 8080
```

Poi vai su [http://localhost:8080](http://localhost:8080)

> ⚠️ Non aprire direttamente con `file://`: il browser blocca `fetch()` su file locali.

---

## Funzionalità

- **Mappa coropletica** dei comuni siciliani colorati per % di raccolta differenziata
- **Slider anno** per navigare tra il 2010 e il 2024
- **Filtro per provincia** con zoom automatico sull'area selezionata
- **Tooltip** al passaggio del mouse con nome comune e percentuale
- **Pannello dettaglio** al click: dati del comune + grafico trend storico 2010–2024
- **Statistiche** in tempo reale: media regionale, numero comuni sopra il 65%
- **Tema chiaro / scuro**

### Scala colori

Il colore indica la percentuale di raccolta differenziata:

| Colore | % RD | Significato |
|--------|------|-------------|
| 🔴 Rosso scuro | 0 – 25% | Obiettivo lontano |
| 🟠 Arancione | 25 – 50% | In via di miglioramento |
| 🟡 Giallo | 50 – 65% | Prossimo all'obiettivo |
| 🟢 Verde | 65 – 100% | **Sopra l'obiettivo di legge** |

La soglia di legge per i comuni italiani è **65%** (D.Lgs. 152/2006).

---

## Struttura del progetto

```
Differenziata/
├── index.html          # App principale
├── js/
│   └── app.js          # Logica mappa, parsing CSV, grafici
├── css/
│   └── style.css       # Stili (tema chiaro/scuro)
└── dati/
    └── sicilia.csv     # Dati elaborati (tutti gli anni, solo Sicilia)
```

---

## Dati

### Raccolta differenziata

I dati provengono dal **Catasto Rifiuti ISPRA** – Istituto Superiore per la Protezione e la Ricerca Ambientale:

> **[Catasto Rifiuti – ISPRA](https://www.catasto-rifiuti.isprambiente.it/index.php?pg=nazione)**

Vengono pubblicati annualmente nel *Rapporto Rifiuti Urbani* e contengono, per ciascun comune italiano:

- Quantità (tonnellate) per frazione merceologica: organico, verde, carta, vetro, legno, plastica, metallo, RAEE, tessili, ecc.
- Totale raccolta differenziata (t)
- Totale rifiuti urbani (t)
- **Percentuale di raccolta differenziata (%)**

Il file `dati/sicilia.csv` è ottenuto unendo i file CSV annuali (2010–2024), aggiungendo la colonna `anno` e filtrando i soli comuni della Sicilia (codice ISTAT regione `19`).

### Confini comunali

I poligoni dei comuni italiani sono serviti tramite **PMTiles** dal progetto [ANNCSU](https://gbvitrano.github.io/ANNCSU):

```
https://gbvitrano.github.io/ANNCSU/dati/comuni.pmtiles
```

Fonte originale: ISTAT via [confini-amministrativi.it](https://confini-amministrativi.it) (OnData).

---

## Elaborazione dati

Lo script `csv/merge_sicilia.py` (Python 3) unisce i file CSV ISPRA, aggiunge la colonna `anno` (estratta dal nome file), rimuove il prefisso regionale dal codice ISTAT e filtra i comuni siciliani:

```bash
cd Differenziata
python csv/merge_sicilia.py
```

Output:
- `dati/sicilia.csv` — 5.853 righe, comuni siciliani 2010–2024

---

## Tecnologie

| Libreria | Versione | Uso |
|----------|----------|-----|
| [MapLibre GL JS](https://maplibre.org/) | 5 | Rendering mappa vettoriale |
| [PMTiles](https://protomaps.com/pmtiles) | 4 | Tile vettoriali compressi |
| [Chart.js](https://www.chartjs.org/) | 4.4 | Grafico trend storico |
| [CARTO Basemaps](https://carto.com/basemaps/) | — | Sfondo cartografico |

Applicazione **100% client-side**, nessun backend.

---

## Licenza

I dati del Catasto Rifiuti ISPRA sono pubblicati in licenza aperta per uso non commerciale; si prega di citare la fonte originale.

Il codice sorgente è rilasciato sotto licenza [MIT](https://opensource.org/licenses/MIT).

---

## Credits

- Dati rifiuti: [ISPRA – Catasto Rifiuti](https://www.catasto-rifiuti.isprambiente.it/index.php?pg=nazione)
- Confini comunali: [ISTAT](https://www.istat.it/) via [confini-amministrativi.it](https://confini-amministrativi.it)
- PMTiles comuni: [gbvitrano/ANNCSU](https://github.com/gbvitrano/ANNCSU)
- Basemap: © [OpenStreetMap](https://www.openstreetmap.org/) contributors, © [CARTO](https://carto.com/)
