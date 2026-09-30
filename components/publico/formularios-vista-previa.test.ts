/**
 * Formularios públicos dentro de la vista previa del admin (DT-034). El
 * proyecto no tiene entorno DOM para tests, así que se renderizan en el
 * servidor con `renderToString`: basta para comprobar que cada formulario lee
 * el contexto de vista previa y avisa de que no se envía. El bloqueo en sí
 * (botón deshabilitado y salida temprana antes del fetch) usa la regla pura
 * `envioPermitido`, cubierta en lib/vista-previa/envio.test.ts; aquí no se
 * puede distinguir de "formulario vacío" porque en SSR no se pueden rellenar
 * los campos.
 */

import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VistaPreviaProvider } from "@/components/publico/VistaPrevia";
import IntencionForm from "@/components/publico/IntencionForm";
import ComentarioForm from "@/components/publico/ComentarioForm";
import RespuestaForm from "@/components/publico/RespuestaForm";
import { TEXTOS_POR_DEFECTO } from "@/lib/textos/defaults";
import { AVISO_ENVIO_EN_VISTA_PREVIA } from "@/lib/vista-previa/envio";

const textos = TEXTOS_POR_DEFECTO;
const slug = "santi-ago";

const FORMULARIOS: [string, () => ReactElement][] = [
  ["IntencionForm", () => createElement(IntencionForm, { textos, slug })],
  ["ComentarioForm", () => createElement(ComentarioForm, { textos, slug })],
  [
    "RespuestaForm",
    () => createElement(RespuestaForm, { textos, slug, parentId: 1, destinatario: "Ana", onRespondido: () => undefined }),
  ],
];

function renderizar(formulario: ReactElement, vistaPrevia: boolean): string {
  return renderToString(createElement(VistaPreviaProvider, { activa: vistaPrevia }, formulario));
}

describe.each(FORMULARIOS)("%s", (_nombre, crear) => {
  it("con la vista previa activa avisa de que no se envía", () => {
    expect(renderizar(crear(), true)).toContain(AVISO_ENVIO_EN_VISTA_PREVIA);
  });

  it("fuera de la vista previa no muestra el aviso", () => {
    expect(renderizar(crear(), false)).not.toContain(AVISO_ENVIO_EN_VISTA_PREVIA);
  });

  it("sin proveedor (la web pública de siempre) tampoco lo muestra", () => {
    expect(renderToString(crear())).not.toContain(AVISO_ENVIO_EN_VISTA_PREVIA);
  });
});
