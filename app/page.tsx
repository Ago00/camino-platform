import { redirect } from "next/navigation";

// FP2: redirigir al reto activo desde Supabase cuando existan múltiples retos.
export default function Home() {
  redirect("/portuguesa-110");
}
