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

- Clicca un campo, scrivi il valore e premi **Invio**. **Esc** annulla.
- **↑ / ↓** cambiano il valore di 1, con **Maiusc** di 10, e applicano subito la modifica.
- Accetta operazioni: `590/2`, `120+15`. Se il testo inizia con un operatore, l'operazione si applica al valore attuale: `+20`, `*2`, `/2`. Per sottrarre al valore attuale scrivi `--20` (`-20` resta un numero negativo).
- Spostando un nodo con X/Y, le sue maniglie lo seguono.
- **W / H** ridimensionano la selezione a partire dal punto di riferimento.
- Le modifiche a contorni e metriche valgono per tutti i master che stai modificando insieme, e ogni master parte dal proprio valore.
- Il **kerning** vale per il master su cui ti trovi, come nello strumento Metriche di Fontra. Se esiste già una coppia (tra glifi o tra gruppi) modifica quella, altrimenti crea la coppia tra i gruppi, se i glifi ne hanno uno. Svuota il campo per togliere il kerning da quel master.
- Tutto si annulla con **⌘Z / Ctrl+Z**, anche kerning e gruppi.
- Trascina il pannello dalla maniglia **⋮⋮**. Un doppio clic sulla maniglia lo riporta al centro. Il pulsante **–** lo riduce al solo nome del glifo.
- Si nasconde insieme agli altri elementi quando attivi la vista pulita di Fontra.

## Installazione

1. Crea un repository **pubblico** su GitHub, per esempio `fontra-infobar`.
2. Carica `plugin.json` e `infobar.js` (va bene anche questo README) nella radice del repository.
3. Crea una release con tag `v1.0.0`.
4. In Fontra apri **Fontra → Plugin Manager**, premi **+** e scrivi `https://cdn.jsdelivr.net/gh/TUONOME/fontra-infobar@v1.0.0`.
5. Ricarica l'editor.

## Limiti

- Con componenti selezionati puoi spostarli con X/Y, ma non ridimensionarli con W/H.
- Il kerning si modifica solo quando ti trovi esattamente su un master, non su una posizione intermedia.
- Se il font usa una feature `kern` scritta a mano, Fontra non applica il kerning della tabella.
