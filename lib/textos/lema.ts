/**
 * Frase bajo el título de la portada. El texto es libre; una palabra o frase
 * entre *asteriscos* sale destacada. Se parte en trozos para pintarla con JSX
 * (nunca como HTML), así que ningún texto del admin puede inyectar marcado.
 */

export interface TrozoLema {
  texto: string;
  enfasis: boolean;
}

export function partirLema(lema: string): TrozoLema[] {
  const trozos: TrozoLema[] = [];
  const patron = /\*([^*]+)\*/g;
  let desde = 0;
  for (const coincidencia of lema.matchAll(patron)) {
    const inicio = coincidencia.index ?? 0;
    if (inicio > desde) trozos.push({ texto: lema.slice(desde, inicio), enfasis: false });
    trozos.push({ texto: coincidencia[1], enfasis: true });
    desde = inicio + coincidencia[0].length;
  }
  if (desde < lema.length) trozos.push({ texto: lema.slice(desde), enfasis: false });
  // Asteriscos sueltos que no cierran se quedan como texto normal.
  return trozos.length > 0 ? trozos : [{ texto: lema, enfasis: false }];
}
