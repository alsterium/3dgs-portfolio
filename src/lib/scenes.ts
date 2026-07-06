import { useQuery } from "@tanstack/react-query";
import { resolveAppUrl } from "./assetUrl";
import { manifestSchema, type SceneManifest } from "./sceneSchema";

export async function fetchSceneManifest(): Promise<SceneManifest> {
  const res = await fetch(resolveAppUrl("scenes.json"));
  if (!res.ok) {
    throw new Error(`Failed to fetch scenes.json: ${res.status}`);
  }
  return manifestSchema.parse(await res.json());
}

export function useScenesQuery() {
  return useQuery({
    queryKey: ["scenes"],
    queryFn: fetchSceneManifest,
    staleTime: Infinity,
  });
}
