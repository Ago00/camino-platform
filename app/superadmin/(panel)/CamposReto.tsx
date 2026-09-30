// Piezas de presentación compartidas por los formularios de crear y editar
// reto del panel superadmin, y el mensaje de resultado de sus acciones.

import Link from "next/link";
import { RUTAS_PREDEFINIDAS } from "@/lib/rutas/catalogo";

export const COLORES_SUPERADMIN = {
  paper: "#F4F3EF",
  ink: "#1B211D",
  eucalipto: "#2F5D50",
  rojo: "#B03A2E",
  gris: "#6B7280",
} as const;

const C = COLORES_SUPERADMIN;

export function CampoTexto({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  pattern,
  maxLength,
  ayuda,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  maxLength?: number;
  ayuda?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">
        {label}
        {required && <span style={{ color: C.rojo }}> *</span>}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        pattern={pattern}
        maxLength={maxLength}
        title={ayuda}
        className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
        style={{ borderColor: "#00000015" }}
      />
      {ayuda && (
        <p className="mt-1 text-[12px]" style={{ color: C.gris }}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

export function SelectorTipoRuta({ defaultValue }: { defaultValue: "predefinida" | "libre" }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">Tipo de ruta</label>
      <select
        name="ruta_tipo"
        defaultValue={defaultValue}
        className="w-full rounded-lg border px-3 py-2 text-[14px]"
        style={{ borderColor: "#00000015" }}
      >
        <option value="predefinida">Predefinida</option>
        <option value="libre">Libre</option>
      </select>
    </div>
  );
}

// Solo se tiene en cuenta si el tipo de ruta es "predefinida".
export function SelectorRuta({ defaultValue }: { defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">Ruta predefinida</label>
      <select
        name="ruta_id"
        defaultValue={defaultValue ?? RUTAS_PREDEFINIDAS[0]?.id}
        className="w-full rounded-lg border px-3 py-2 text-[14px]"
        style={{ borderColor: "#00000015" }}
      >
        {RUTAS_PREDEFINIDAS.map((ruta) => (
          <option key={ruta.id} value={ruta.id}>
            {ruta.nombre}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[12px]" style={{ color: C.gris }}>
        Se ignora si el tipo de ruta es libre.
      </p>
    </div>
  );
}

// Contraseña del panel admin del reto (FP2.6, DT-029). Sin defaultValue
// nunca: la contraseña no se puede leer (solo se guarda su hash).
export function CampoPasswordAdmin({ required, placeholder }: { required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">
        Contraseña del panel admin
        {required && <span style={{ color: C.rojo }}> *</span>}
      </label>
      <input
        type="password"
        name="password_admin"
        autoComplete="new-password"
        minLength={8}
        maxLength={200}
        required={required}
        placeholder={placeholder ?? "Mínimo 8 caracteres"}
        className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
        style={{ borderColor: "#00000015" }}
      />
    </div>
  );
}

/**
 * Mensaje de resultado de una acción: verde con role="status" si fue bien,
 * rojo con role="alert" si falló (los lectores de pantalla lo anuncian ya).
 */
export function MensajeResultado({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      role={ok ? "status" : "alert"}
      className="rounded-lg border px-3 py-2 text-[13px]"
      style={
        ok
          ? { borderColor: `${C.eucalipto}40`, background: `${C.eucalipto}10`, color: C.eucalipto }
          : { borderColor: `${C.rojo}40`, background: `${C.rojo}10`, color: C.rojo }
      }
    >
      {children}
    </div>
  );
}

/** Enlaces a la web pública y al panel admin de un reto, en pestaña nueva. */
export function EnlacesReto({ slug }: { slug: string }) {
  const clase = "rounded-lg border px-3 py-1.5 text-[13px] font-medium";
  return (
    <>
      <Link href={`/${slug}`} target="_blank" rel="noopener noreferrer" className={clase} style={{ borderColor: "#00000018" }}>
        Ver web
      </Link>
      <Link
        href={`/${slug}/admin`}
        target="_blank"
        rel="noopener noreferrer"
        className={clase}
        style={{ borderColor: "#00000018" }}
      >
        Panel admin
      </Link>
    </>
  );
}
