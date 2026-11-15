# Performance (CWV) · 96/100

## Lo que funciona
- LCP 0,44–0,71 s en celular
- CLS 0–0,023
- Casi sin tareas largas
- 15–23 peticiones y 128–425 KB por página

## Hallazgos
### [Info] El loader añade ~0,9 s al LCP de la primera visita
LCP 1,47 s con loader frente a 0,56 s sin él; sigue por debajo de 2,5 s y solo ocurre una vez por visita.

**Recomendación:** Sin acción. Vigilar si se alarga la animación.

