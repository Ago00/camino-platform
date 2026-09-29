/**
 * Tests de subirFotoMinutoAMinuto: validación de tipo MIME y tamaño (borde
 * del sistema, antes de tocar Storage), construcción del nombre único, y
 * propagación de errores de Supabase con mensaje apto para el usuario.
 *
 * Mock de lib/supabase/admin (mismo patrón que app/admin/actions.test.ts).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadSpy = vi.fn().mockResolvedValue({ error: null });
const getPublicUrlSpy = vi.fn(() => ({
  data: { publicUrl: "https://supabase.example.com/storage/v1/object/public/minuto-a-minuto/foo.jpg" },
}));

const removeSpy = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: uploadSpy,
        getPublicUrl: getPublicUrlSpy,
        remove: removeSpy,
      })),
    },
  })),
}));

const {
  subirFotoMinutoAMinuto,
  subirFotoLlegada,
  subirFotoQuienCamina,
  rutaObjetoDelReto,
  borrarObjeto,
  ErrorDeSubidaDeFoto,
} = await import("@/lib/supabase/storage");
const { TAMANO_MAXIMO_FOTO_BYTES, PRESUPUESTO_COMPRESION_BYTES } = await import(
  "@/lib/imagen/limites-subida"
);

function crearArchivo(opciones: { type: string; size: number }): File {
  const contenido = new Uint8Array(opciones.size);
  return new File([contenido], "foto", { type: opciones.type });
}

beforeEach(() => {
  uploadSpy.mockClear();
  getPublicUrlSpy.mockClear();
  removeSpy.mockClear();
});

describe("subirFotoMinutoAMinuto — validación de tipo MIME", () => {
  it("acepta image/jpeg", async () => {
    const url = await subirFotoMinutoAMinuto(crearArchivo({ type: "image/jpeg", size: 100 }));
    expect(url).toContain("minuto-a-minuto");
    expect(uploadSpy).toHaveBeenCalled();
  });

  it("acepta image/png", async () => {
    await subirFotoMinutoAMinuto(crearArchivo({ type: "image/png", size: 100 }));
    expect(uploadSpy).toHaveBeenCalled();
  });

  it("acepta image/webp", async () => {
    await subirFotoMinutoAMinuto(crearArchivo({ type: "image/webp", size: 100 }));
    expect(uploadSpy).toHaveBeenCalled();
  });

  it("rechaza un tipo MIME no permitido (p. ej. application/pdf) sin llamar a Storage", async () => {
    await expect(
      subirFotoMinutoAMinuto(crearArchivo({ type: "application/pdf", size: 100 }))
    ).rejects.toThrow(/formato/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("rechaza image/gif (parece imagen pero no está en la lista permitida)", async () => {
    await expect(
      subirFotoMinutoAMinuto(crearArchivo({ type: "image/gif", size: 100 }))
    ).rejects.toThrow(/formato/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});

describe("subirFotoMinutoAMinuto — validación de tamaño", () => {
  it("acepta un fichero justo en el tamaño máximo permitido", async () => {
    await subirFotoMinutoAMinuto(
      crearArchivo({ type: "image/jpeg", size: TAMANO_MAXIMO_FOTO_BYTES })
    );
    expect(uploadSpy).toHaveBeenCalled();
  });

  it("rechaza un fichero que supera el tamaño máximo sin llamar a Storage", async () => {
    await expect(
      subirFotoMinutoAMinuto(crearArchivo({ type: "image/jpeg", size: TAMANO_MAXIMO_FOTO_BYTES + 1 }))
    ).rejects.toThrow(/máximo/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("mantiene el tope por debajo del corte del edge de Vercel (~4,5 MB), que es el que de verdad manda", () => {
    // Regresión de DT-017: con el tope anterior (8 MB) la validación era
    // inalcanzable — Vercel cortaba la petición con 413 antes de llegar aquí.
    expect(TAMANO_MAXIMO_FOTO_BYTES).toBeLessThan(4.4 * 1024 * 1024);
  });

  it("deja margen entre el presupuesto del compresor del navegador y el tope del servidor", () => {
    expect(PRESUPUESTO_COMPRESION_BYTES).toBeLessThan(TAMANO_MAXIMO_FOTO_BYTES);
  });
});

describe("subirFotoMinutoAMinuto — nombre único y URL pública", () => {
  it("sube con un nombre que incluye la extensión correspondiente al MIME", async () => {
    await subirFotoMinutoAMinuto(crearArchivo({ type: "image/png", size: 100 }));
    const [nombreSubido] = uploadSpy.mock.calls[0] as [string, File, unknown];
    expect(nombreSubido).toMatch(/\.png$/);
  });

  it("devuelve la URL pública obtenida de getPublicUrl", async () => {
    const url = await subirFotoMinutoAMinuto(crearArchivo({ type: "image/jpeg", size: 100 }));
    expect(url).toBe("https://supabase.example.com/storage/v1/object/public/minuto-a-minuto/foo.jpg");
  });
});

describe("subirFotoMinutoAMinuto — error de Storage", () => {
  it("lanza un mensaje apto para el usuario si Supabase devuelve error", async () => {
    uploadSpy.mockResolvedValueOnce({ error: new Error("fallo de red") });
    await expect(
      subirFotoMinutoAMinuto(crearArchivo({ type: "image/jpeg", size: 100 }))
    ).rejects.toThrow(/no se pudo subir/i);
  });

  it("marca sus fallos como ErrorDeSubidaDeFoto, que es lo que la Server Action puede enseñar al usuario", async () => {
    await expect(
      subirFotoMinutoAMinuto(crearArchivo({ type: "image/gif", size: 100 }))
    ).rejects.toBeInstanceOf(ErrorDeSubidaDeFoto);
  });
});

describe("subirFotoLlegada (DT-024) — mismo bucket, prefijo distinto en el nombre", () => {
  it("sube al mismo bucket público minuto-a-minuto con un nombre prefijado 'llegada-'", async () => {
    const url = await subirFotoLlegada(crearArchivo({ type: "image/jpeg", size: 100 }));

    expect(url).toContain("minuto-a-minuto");
    const [nombreSubido] = uploadSpy.mock.calls[0] as [string, File, unknown];
    expect(nombreSubido).toMatch(/^llegada-.*\.jpg$/);
  });

  it("no colisiona con el nombre que generaría subirFotoMinutoAMinuto para el mismo instante (prefijo distinto)", async () => {
    await subirFotoMinutoAMinuto(crearArchivo({ type: "image/png", size: 100 }));
    const [nombreFeed] = uploadSpy.mock.calls[0] as [string, File, unknown];

    await subirFotoLlegada(crearArchivo({ type: "image/png", size: 100 }));
    const [nombreLlegada] = uploadSpy.mock.calls[1] as [string, File, unknown];

    expect(nombreLlegada).not.toBe(nombreFeed);
    expect(nombreLlegada.startsWith("llegada-")).toBe(true);
    expect(nombreFeed.startsWith("llegada-")).toBe(false);
  });

  it("aplica las mismas reglas de validación (tipo MIME, tamaño máximo) que subirFotoMinutoAMinuto", async () => {
    await expect(
      subirFotoLlegada(crearArchivo({ type: "application/pdf", size: 100 }))
    ).rejects.toThrow(/formato/i);
    await expect(
      subirFotoLlegada(crearArchivo({ type: "image/jpeg", size: TAMANO_MAXIMO_FOTO_BYTES + 1 }))
    ).rejects.toThrow(/máximo/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("lanza ErrorDeSubidaDeFoto si Supabase devuelve error al subir", async () => {
    uploadSpy.mockResolvedValueOnce({ error: new Error("fallo de red") });
    await expect(
      subirFotoLlegada(crearArchivo({ type: "image/jpeg", size: 100 }))
    ).rejects.toBeInstanceOf(ErrorDeSubidaDeFoto);
  });
});

describe("subirFotoQuienCamina (FP3c) — carpeta del reto", () => {
  it("sube bajo <retoId>/quien-camina- con la extensión del MIME", async () => {
    await subirFotoQuienCamina(crearArchivo({ type: "image/webp", size: 100 }), 7);

    const [nombreSubido] = uploadSpy.mock.calls[0] as [string, File, unknown];
    expect(nombreSubido).toMatch(/^7\/quien-camina-\d+-[0-9a-f-]+\.webp$/);
  });

  it("el nombre generado lo reconoce rutaObjetoDelReto para ese reto y no para otro", async () => {
    await subirFotoQuienCamina(crearArchivo({ type: "image/jpeg", size: 100 }), 7);
    const [nombreSubido] = uploadSpy.mock.calls[0] as [string, File, unknown];
    const url = `https://x.supabase.co/storage/v1/object/public/minuto-a-minuto/${nombreSubido}`;

    expect(rutaObjetoDelReto(url, 7)).toBe(nombreSubido);
    expect(rutaObjetoDelReto(url, 8)).toBeNull();
  });

  it("aplica las mismas validaciones de tipo y tamaño sin tocar Storage", async () => {
    await expect(subirFotoQuienCamina(crearArchivo({ type: "image/gif", size: 100 }), 7)).rejects.toBeInstanceOf(
      ErrorDeSubidaDeFoto
    );
    await expect(
      subirFotoQuienCamina(crearArchivo({ type: "image/jpeg", size: TAMANO_MAXIMO_FOTO_BYTES + 1 }), 7)
    ).rejects.toThrow(/máximo/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});

describe("rutaObjetoDelReto — solo reconoce fotos de quién camina del reto", () => {
  const BASE = "https://x.supabase.co/storage/v1/object/public/minuto-a-minuto/";
  const NOMBRE = "1727700000000-3f2b8c1e-0a1b-4c2d-9e8f-123456789abc.jpg";

  it("devuelve la ruta del objeto para una foto del reto", () => {
    expect(rutaObjetoDelReto(`${BASE}3/quien-camina-${NOMBRE}`, 3)).toBe(`3/quien-camina-${NOMBRE}`);
  });

  it("ignora la query string de la URL", () => {
    expect(rutaObjetoDelReto(`${BASE}3/quien-camina-${NOMBRE}?v=2`, 3)).toBe(`3/quien-camina-${NOMBRE}`);
  });

  it("null para una ruta de /public heredada como /santi.jpg", () => {
    expect(rutaObjetoDelReto("/santi.jpg", 3)).toBeNull();
  });

  it("null para la foto de otro reto (incluido un id que empieza igual)", () => {
    expect(rutaObjetoDelReto(`${BASE}4/quien-camina-${NOMBRE}`, 3)).toBeNull();
    expect(rutaObjetoDelReto(`${BASE}31/quien-camina-${NOMBRE}`, 3)).toBeNull();
  });

  it("null para fotos del feed o de llegada del mismo bucket", () => {
    expect(rutaObjetoDelReto(`${BASE}${NOMBRE}`, 3)).toBeNull();
    expect(rutaObjetoDelReto(`${BASE}llegada-${NOMBRE}`, 3)).toBeNull();
  });

  it("null si el nombre intenta salir de la carpeta o no tiene la forma generada", () => {
    expect(rutaObjetoDelReto(`${BASE}3/quien-camina-../../4/quien-camina-${NOMBRE}`, 3)).toBeNull();
    expect(rutaObjetoDelReto(`${BASE}3/quien-camina-%2F..%2F4%2F${NOMBRE}`, 3)).toBeNull();
    expect(rutaObjetoDelReto(`${BASE}3/quien-camina-foto.gif`, 3)).toBeNull();
  });

  it("null para una URL con codificación inválida", () => {
    expect(rutaObjetoDelReto(`${BASE}3/quien-camina-%E0%A4%A.jpg`, 3)).toBeNull();
  });
});

describe("borrarObjeto — no lanza", () => {
  it("pide a Storage borrar exactamente la ruta indicada", async () => {
    await borrarObjeto("3/quien-camina-1-abc.jpg");
    expect(removeSpy).toHaveBeenCalledWith(["3/quien-camina-1-abc.jpg"]);
  });

  it("si Storage devuelve error o lanza, resuelve sin lanzar", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
    removeSpy.mockResolvedValueOnce({ error: { message: "no existe" } });
    await expect(borrarObjeto("3/quien-camina-1-abc.jpg")).resolves.toBeUndefined();
    removeSpy.mockRejectedValueOnce(new Error("red"));
    await expect(borrarObjeto("3/quien-camina-1-abc.jpg")).resolves.toBeUndefined();
    consola.mockRestore();
  });
});
