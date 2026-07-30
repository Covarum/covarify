import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

function manifestKey(key: string) {
  return `${key}.manifest`;
}

async function removeChunks(key: string, count: number) {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
  );
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await SecureStore.getItemAsync(manifestKey(key));
    if (!manifest) return null;

    const count = Number.parseInt(manifest, 10);
    if (!Number.isSafeInteger(count) || count < 1) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    return chunks.every((chunk): chunk is string => chunk !== null)
      ? chunks.join("")
      : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousManifest = await SecureStore.getItemAsync(manifestKey(key));
    const previousCount = Number.parseInt(previousManifest ?? "0", 10) || 0;
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [""];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(manifestKey(key), String(chunks.length));

    if (previousCount > chunks.length) {
      await Promise.all(
        Array.from(
          { length: previousCount - chunks.length },
          (_, offset) =>
            SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset)),
        ),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const manifest = await SecureStore.getItemAsync(manifestKey(key));
    const count = Number.parseInt(manifest ?? "0", 10) || 0;
    await removeChunks(key, count);
    await SecureStore.deleteItemAsync(manifestKey(key));
  },
};
