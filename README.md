# Barra info — plugin per Fontra

Un pannello fluttuante in basso al centro del canvas, come l'info box di Glyphs. Le informazioni che in Fontra sono sparse nei pannelli laterali restano sempre sotto gli occhi.

```
 ⋮⋮              O  U+004F               –
 ─────────────────────────────────────────
 ▫▫▫   X [ 170 ]           Y [   0 ]
 ▫▫▫   W [ 390 ]           H [ 560 ]
 ─────────────────────────────────────────
  ◀ H     LSB   Larghezza   RSB     H ▶
 [-40]   [30]    [590]     [30]   [-20]
   Gruppo kerning sx      Gruppo kerning dx
 [ round       ]         [             ]
```

## Cosa mostra, dall'alto in basso

1. **Nome e Unicode** del glifo.
2. **Trasformazioni**, solo con una selezione attiva. Per un nodo mostra X e Y. Per più elementi mostra anche W e H, con la griglia 3×3 per scegliere il punto di riferimento. Per una maniglia mostra anche lo scarto Δ dal suo nodo.
3. **Side bearing**: LSB, larghezza e RSB. Ai lati c'è il **kerning** con il glifo precedente (◀) e con quello successivo (▶) nella riga di testo. Sopra ogni campo di kerning compare il nome del glifo vicino.
4. **Gruppi di kerning**: il sinistro sotto l'LSB, il destro sotto l'RSB.

## Come si usa

- Clicca un campo, scrivi il valore e conferma con **Invio**, con **Tab** o semplicemente uscendo dal campo (cliccando sul canvas o altrove). **Esc** annulla.
- **↑ / ↓** cambiano il valore di 1, con **Maiusc** di 10, e applicano subito la modifica.
- Accetta operazioni: `590/2`, `120+15`. Se il testo inizia con un operatore, l'operazione si applica al valore attuale: `+20`, `*2`, `/2`. Per sottrarre al valore attuale scrivi `--20` (`-20` resta un numero negativo).
- Spostando un nodo con X/Y, le sue maniglie lo seguono.
- **W / H** ridimensionano la selezione a partire dal punto di riferimento.
- Il **kerning** usa la coppia già esistente (tra glifi o tra gruppi) e la modifica; altrimenti crea la coppia tra i gruppi, se i glifi ne hanno uno. Svuota il campo per togliere il kerning.
- Tutto si annulla con **⌘Z / Ctrl+Z**, anche kerning e gruppi.
- Trascina il pannello dalla maniglia **⋮⋮**. Un doppio clic sulla maniglia lo riporta al centro. Il pulsante **–** lo riduce al solo nome del glifo.
- Si nasconde insieme agli altri elementi quando attivi la vista pulita di Fontra.

## Modifica di più master

Con la modifica multimaster attiva, LSB, RSB e kerning valgono per tutti i master che stai modificando insieme:

- Un **valore** (`30`, `60/2`) dà a tutti i master lo stesso valore.
- Un'**operazione relativa** (`+20`, `--10`, `*2`) e le **frecce** partono dal valore di ciascun master: `+20` aggiunge 20 a ogni master.
- Il campo vuoto nel kerning toglie la coppia da tutti i master in modifica.
- Riscrivere il valore già mostrato, o premere **Invio** senza cambiarlo, lo applica a tutti i master: è il modo più veloce per allinearli. Entrare in un campo e uscire senza scrivere non cambia niente.
- I master su cui agisce sono quelli spuntati come "in modifica" nel pannello delle sorgenti del glifo selezionato.

Senza modifica multimaster, LSB e RSB valgono per il master corrente e il kerning per il master su cui ti trovi.

La **larghezza** e le **trasformazioni** (X, Y, W, H) si comportano come prima: la differenza si applica a ogni master in modifica, a partire dal suo valore.

## Installazione

1. Crea un repository **pubblico** su GitHub, per esempio `fontra-infobar`.
2. Carica `plugin.json` e `infobar.js` (va bene anche questo README) nella radice del repository.
3. Crea una release con tag `v1.1.1`.
4. In Fontra apri **Fontra → Plugin Manager**, premi **+** e scrivi `https://cdn.jsdelivr.net/gh/TUONOME/fontra-infobar@v1.1.1`.
5. Ricarica l'editor.

Per aggiornare da una versione precedente: crea la nuova release, rimuovi dal Plugin Manager l'indirizzo con il vecchio tag e aggiungi quello nuovo.

## Limiti

- Con componenti selezionati puoi spostarli con X/Y, ma non ridimensionarli con W/H.
- Senza modifica multimaster, il kerning si modifica solo quando ti trovi esattamente su un master, non su una posizione intermedia.
- Le sorgenti intermedie di un glifo (brace layer) non sono master del font: in modifica multimaster ricevono LSB e RSB, ma non il kerning.
- Se il font usa una feature `kern` scritta a mano, Fontra non applica il kerning della tabella.
