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

1. **Nome e Unicode** del glifo. Con il plugin "Rinomina e duplica glifi" installato, un doppio clic sul nome rinomina il glifo.
2. **Trasformazioni**, solo con una selezione attiva. Per un nodo mostra X e Y. Per più elementi mostra anche W e H, con la griglia 3×3 per scegliere il punto di riferimento. Per una maniglia mostra anche lo scarto Δ dal suo nodo.
3. **Side bearing**: LSB, larghezza e RSB. Ai lati c'è il **kerning** con il glifo precedente (◀) e con quello successivo (▶) nella riga di testo. Sopra ogni campo di kerning compare il nome del glifo vicino.
4. **Gruppi di kerning**: il sinistro sotto l'LSB, il destro sotto l'RSB.

## Come si usa

- Clicca un campo, scrivi il valore e conferma con **Invio**, con **Tab** o semplicemente uscendo dal campo (cliccando sul canvas o altrove). **Esc** annulla.
- **↑ / ↓** cambiano il valore di 1, con **Maiusc** di 10, e applicano subito la modifica.
- Accetta operazioni: `590/2`, `120+15`. Se il testo inizia con un operatore, l'operazione si applica al valore attuale: `+20`, `*2`, `/2`. Per sottrarre al valore attuale scrivi `--20` (`-20` resta un numero negativo).
- **Nome di un glifo** in LSB, RSB e larghezza, come in Glyphs: il margine resta collegato a quel glifo. Vedi sotto.
- Spostando un nodo con X/Y, le sue maniglie lo seguono.
- **W / H** ridimensionano la selezione a partire dal punto di riferimento.
- Il **kerning** usa la coppia già esistente (tra glifi o tra gruppi) e la modifica; altrimenti crea la coppia tra i gruppi, se i glifi ne hanno uno. Svuota il campo per togliere il kerning.
- Tutto si annulla con **⌘Z / Ctrl+Z**, anche kerning e gruppi.
- Trascina il pannello dalla maniglia **⋮⋮**. Un doppio clic sulla maniglia lo riporta al centro. Il pulsante **–** lo riduce al solo nome del glifo.
- Si nasconde insieme agli altri elementi quando attivi la vista pulita di Fontra.

## Margini collegati

In LSB, RSB e larghezza puoi scrivere il **nome di un glifo** invece del numero, come in Glyphs. Il campo resta **collegato** a quel glifo: quando lo modifichi, il glifo collegato si aggiorna da solo.

Per esempio, H ha 40 a sinistra e a destra. Nella `I` scrivi `H` in LSB e in RSB: la I prende 40 e 40. Se poi porti H a 45, anche la I passa a 45, in tutti i master.

| Scrivi | Nell'LSB | Nell'RSB |
|---|---|---|
| `H` o `=H` | l'LSB di H | l'RSB di H |
| `=\|H` | l'RSB di H (lato opposto) | l'LSB di H |
| `H+10`, `=H-5`, `H*2` | l'LSB di H con il calcolo | l'RSB di H con il calcolo |

- **Come si riconosce**: il valore è blu e sopra il campo compare il collegamento, per esempio `LSB =H`. Cliccando nel campo vedi e puoi cambiare il collegamento.
- **Vale per tutti i master** del glifo, anche se stai modificando solo il master corrente: il Bold della I segue il Bold della H, e così via. Se H non ha un master in quella posizione, si usa il suo valore interpolato.
- **Per scollegare** scrivi un numero (o usa ↑ ↓). RSB e larghezza si escludono, perché decidono tutti e due la larghezza: un collegamento o un numero in uno dei due toglie il collegamento dall'altro.
- **Si aggiorna sempre**: qualunque modifica a H (spostare punti, cambiare margini qui o nella panoramica, annullare) aggiorna i glifi collegati. Anche a catena: se B è collegata a D e D a H, cambiando H cambiano D e B. E anche attraverso i componenti: un glifo collegato a `kacute` segue la `k`.
- **Il glifo collegato tiene il suo valore**: se sposti i punti della I, il margine torna quello di H, come in Glyphs.
- Va bene anche il carattere: `è` vale come `egrave`. I numeri restano numeri: `1` è il valore 1, non il glifo `one`.
- I collegamenti sono salvati nel font, quindi restano quando lo riapri. Se rinomini H con "Rinomina e duplica glifi" 1.0.2, i collegamenti seguono il nuovo nome; duplicando un glifo, la copia ha gli stessi collegamenti.
- Lo stesso collegamento si vede e si modifica anche nella panoramica, con "Testi di kerning" 1.4.0.

## Modifica di più master

Con la modifica multimaster attiva, LSB, RSB e kerning valgono per tutti i master che stai modificando insieme:

- Un **valore** (`30`, `60/2`) dà a tutti i master lo stesso valore.
- Un'**operazione relativa** (`+20`, `--10`, `*2`) e le **frecce** partono dal valore di ciascun master: `+20` aggiunge 20 a ogni master.
- Il campo vuoto nel kerning toglie la coppia da tutti i master in modifica.
- Riscrivere il valore già mostrato, o premere **Invio** senza cambiarlo, lo applica a tutti i master: è il modo più veloce per allinearli. Entrare in un campo e uscire senza scrivere non cambia niente.
- I master su cui agisce sono quelli spuntati come "in modifica" nel pannello delle sorgenti del glifo selezionato.

Senza modifica multimaster, LSB e RSB valgono per il master corrente e il kerning per il master su cui ti trovi.

La **larghezza** e le **trasformazioni** (X, Y, W, H) si comportano come prima: la differenza si applica a ogni master in modifica, a partire dal suo valore. Con il nome di un glifo, invece, il collegamento vale per tutti i master del glifo.

## Installazione

1. Crea un repository **pubblico** su GitHub, per esempio `fontra-infobar`.
2. Carica `plugin.json` e `infobar.js` (va bene anche questo README) nella radice del repository.
3. Crea una release con tag `v1.4.0`.
4. In Fontra apri **Fontra → Plugin Manager**, premi **+** e scrivi `https://cdn.jsdelivr.net/gh/TUONOME/fontra-infobar@v1.4.0`.
5. Ricarica l'editor.

Per aggiornare da una versione precedente: crea la nuova release, rimuovi dal Plugin Manager l'indirizzo con il vecchio tag e aggiungi quello nuovo.

## Limiti

- Con componenti selezionati puoi spostarli con X/Y, ma non ridimensionarli con W/H.
- Senza modifica multimaster, il kerning si modifica solo quando ti trovi esattamente su un master, non su una posizione intermedia.
- Le sorgenti intermedie di un glifo (brace layer) non sono master del font: in modifica multimaster ricevono LSB e RSB, ma non il kerning.
- Se il font usa una feature `kern` scritta a mano, Fontra non applica il kerning della tabella.
