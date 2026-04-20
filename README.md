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
- **Selezione anno** per navigare tra il 2010 e il 2024
- **Filtro per provincia** con zoom automatico sull'area selezionata (padding responsivo, adattivo alla risoluzione del monitor)
- **Indicatori tematici** selezionabili: oltre alla % RD, è possibile visualizzare sulla mappa ogni singola frazione merceologica (umido, carta, vetro, plastica, RAEE, verde, legno, metallo, tessili, ecc.) in kg/abitante
- **Tooltip** al passaggio del mouse con nome comune, provincia e valore dell'indicatore selezionato
- **Pannello dettaglio** al click: dati del comune, grafico trend storico 2010–2024, grafico composizione frazioni, tabella dati esportabile
- **Statistiche regionali** in tempo reale: media RD, numero e percentuale comuni sopra il 65%, totale rifiuti urbani
- **Modale analisi 2010–2024** con tabelle e grafici sull'evoluzione regionale, provinciale, per composizione e per comuni virtuosi/in difficoltà
- **Export CSV** dei dati filtrati (anno, provincia, comune)
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
├── index.html               # App principale
├── js/
│   └── app.js               # Logica mappa, parsing CSV, grafici, indicatori tematici
├── css/
│   └── style.css            # Stili (tema chiaro/scuro)
├── dati/
│   └── sicilia.csv          # Dati elaborati (tutti gli anni, solo Sicilia)
├── csv/
│   ├── merge_sicilia.py     # Script di unione e pulizia dei CSV ISPRA
│   └── genera_grafici.py    # Script di generazione dei grafici per l'analisi
├── doc/
│   ├── post-analisi-2010-2024.md   # Analisi approfondita in formato Markdown
│   └── post-analisi-2010-2024.pdf  # Analisi in PDF (generato da pandoc)
└── img/
    ├── post-analisi/        # Grafici generati da genera_grafici.py
    │   ├── 01_trend_regionale.png
    │   ├── 02_trend_province.png
    │   ├── 03_province_2024.png
    │   ├── 04_composizione_2024.png
    │   ├── 05_top_bottom.png
    │   └── 06_share_above_65.png
    └── ...
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
- Percentuale di raccolta differenziata (%)

Il file `dati/sicilia.csv` è ottenuto unendo i file CSV annuali (2010–2024), aggiungendo la colonna `anno` e filtrando i soli comuni della Sicilia (codice ISTAT regione `19`). I numeri decimali nei file sorgente ISPRA usano la virgola come separatore: il processo di unione li converte in punto per compatibilità con i parser JavaScript standard.

### Confini comunali

I poligoni dei comuni italiani sono serviti tramite **PMTiles** dal progetto [ANNCSU](https://gbvitrano.github.io/ANNCSU):

```
https://gbvitrano.github.io/ANNCSU/dati/comuni.pmtiles
```

Fonte originale: ISTAT via [confini-amministrativi.it](https://confini-amministrativi.it) (OnData).

---

## Elaborazione dati

### 1. Unione CSV ISPRA → `sicilia.csv`

Lo script `csv/merge_sicilia.py` (Python 3) unisce i file CSV ISPRA, corregge il formato decimale italiano (virgola → punto), aggiunge la colonna `anno`, rimuove il prefisso regionale dal codice ISTAT e filtra i soli comuni siciliani:

```bash
cd /mnt/f/Differenziata   # percorso WSL
python3 csv/merge_sicilia.py
```

Output:
- `tutti_comuni.csv` — tutti i comuni italiani (tutti gli anni)
- `sicilia.csv` → copiare in `dati/sicilia.csv` — 5.853 righe, 391 comuni siciliani, anni 2010–2024

### 2. Generazione grafici per l'analisi

Lo script `csv/genera_grafici.py` (Python 3, richiede `pandas` e `matplotlib`) legge `dati/sicilia.csv` e rigenera i 6 grafici usati nel modale di analisi e nel documento PDF:

```bash
pip install pandas matplotlib --break-system-packages
python3 csv/genera_grafici.py
```

Output: 6 file PNG in `img/post-analisi/`

### 3. Generazione PDF analisi

Il documento `doc/post-analisi-2010-2024.pdf` è generato dal Markdown con pandoc + xelatex:

```bash
cd doc
pandoc post-analisi-2010-2024.md -o post-analisi-2010-2024.pdf \
  --pdf-engine=xelatex -V geometry:margin=2.5cm -V lang=it
```

---

## Tecnologie

| Libreria | Versione | Uso |
|----------|----------|-----|
| [MapLibre GL JS](https://maplibre.org/) | 5 | Rendering mappa vettoriale |
| [PMTiles](https://protomaps.com/pmtiles) | 4 | Tile vettoriali compressi |
| [Chart.js](https://www.chartjs.org/) | 4.4 | Grafici trend e composizione frazioni |
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
